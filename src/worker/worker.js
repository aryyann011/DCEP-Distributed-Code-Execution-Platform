import { Worker } from "bullmq";
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import { query } from "../shared/database/db.js";
import { isCorrectOutput } from "./evaluators/grader.service.js";
import { connection, redisPublisher } from "../shared/queues/connection.js";
import { compileCpp, executeCpp } from "./sandbox/docker.service.js";

console.log("Worker is online listening to submission queue...");

export const processSubmission = async (job) => {
    const submissionId = job.data.submissionId;
    const jobId = job.opts?.jobId || submissionId; 
    console.log(`\n[${jobId}] Starting processing for Submission ID: ${submissionId}`);

    const jobDir = path.join(os.tmpdir(), `job_${submissionId}`);
    if (!existsSync(jobDir)) {
        mkdirSync(jobDir);
    }

    const fileName = path.join(jobDir, `main.cpp`);
    const outputName = path.join(jobDir, `a.out`);
    const inputName = path.join(jobDir, `input.txt`);

    try {
        await query(
            `UPDATE submissions SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [submissionId]
        );

        const submissionResult = await query(
            `SELECT id, problem_id, language, code FROM submissions WHERE id = $1;`,
            [submissionId]
        );
        
        if (submissionResult.rows.length === 0) throw new Error(`Submission ${submissionId} not found.`);
        const { problem_id, code } = submissionResult.rows[0];

        const testCasesResult = await query(
            `SELECT id, input, expected_output, is_hidden FROM test_cases WHERE problem_id = $1;`, 
            [problem_id]
        );
        const testCases = testCasesResult.rows;
        
        if (testCases.length === 0) {
            await query(`UPDATE submissions SET status = 'SYSTEM_ERROR', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [submissionId]);
            throw new Error(`No test cases found for problem ${problem_id}.`);
        }

        writeFileSync(fileName, code);

        const problem = await query(
            `SELECT TIME_LIMIT, MEMORY_LIMIT FROM problems WHERE id = $1`,
            [problem_id]
        )
        const {time_limit, memory_limit} = problem.rows[0];

        let overallStatus = 'ACCEPTED';
        let maxExecutionTime = 0;
        let maxMemoryUsed = 0;

        console.log(`[${jobId}] STAGE 1: Compiling C++ binary...`);

        redisPublisher.publish('job-progress', JSON.stringify({
            jobId: submissionId,
            stage: 'COMPILING',
        }));

        const compileStart = Date.now();
        const { statusCode, errorOutput } = await compileCpp(jobDir, fileName, outputName);
        const compilationTime = Date.now() - compileStart;
        
        if (statusCode !== 0) {
            console.log(`[${jobId}] 🛑 COMPILE ERROR.`);

            redisPublisher.publish('job-progress', JSON.stringify({
                jobId: submissionId,
                stage: 'COMPILE_FAILED',
                error: errorOutput,
            }));
            
            await query(
                `UPDATE submissions SET status = 'COMPILE_ERROR', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, 
                [submissionId]
            );
            
            redisPublisher.publish('job-results', JSON.stringify({
                jobId: submissionId, 
                status: 'COMPILE_ERROR', 
                error: errorOutput
            }));
            
            return; 
        }

        console.log(`[${jobId}] Compilation Successful. Moving to Execution phase.`);

        redisPublisher.publish('job-progress', JSON.stringify({
            jobId: submissionId,
            stage: 'COMPILED',
            compilationTime,
        }));

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            console.log(`[${jobId}] Running Test Case: ${testCase.id}`);

            redisPublisher.publish('job-progress', JSON.stringify({
                jobId: submissionId,
                stage: 'RUNNING_TEST',
                testIndex: i + 1,
                totalTests: testCases.length,
            }));

            writeFileSync(inputName, testCase.input);

            let runStatus = 'ACCEPTED';
            let memoryUsed = 0; 
            
            const { 
                containerStatus, 
                actualOutput: execOutput, 
                executionTime: execTime, 
                isOom, 
                exitCode 
            } = await executeCpp(jobDir, outputName, inputName, memory_limit, time_limit);

            let actualOutput = execOutput;
            let executionTime = execTime;

            if (containerStatus === 'TIME_LIMIT_EXCEEDED') {
                console.log(`[${jobId}] 🛑 TIME LIMIT EXCEEDED. Assassinating container...`);
                runStatus = 'TIME_LIMIT_EXCEEDED';
            } else if (isOom) {
                console.log(`[${jobId}] 🛑 MEMORY LIMIT EXCEEDED.`);
                runStatus = 'MEMORY_LIMIT_EXCEEDED';
                actualOutput = "Error: Memory Limit Exceeded (256MB)";
            } else if (exitCode !== 0) {
                console.log(`[${jobId}] 🛑 RUNTIME ERROR. Exit Code: ${exitCode}`);
                runStatus = 'RUNTIME_ERROR';
            } else if (!isCorrectOutput(actualOutput, testCase.expected_output)) {
                runStatus = 'WRONG_ANSWER';
            }

            if (executionTime > maxExecutionTime) maxExecutionTime = executionTime;
            
            await query(
                `INSERT INTO submission_results (submission_id, test_case_id, status, actual_output, execution_time, memory_used) VALUES ($1, $2, $3, $4, $5, $6);`, 
                [submissionId, testCase.id, runStatus, actualOutput, executionTime, memoryUsed]
            );

            redisPublisher.publish('job-progress', JSON.stringify({
                jobId: submissionId,
                stage: 'TEST_RESULT',
                testIndex: i + 1,
                status: runStatus,
                executionTime,
                actualOutput: testCase.is_hidden ? null : actualOutput,
            }));

            if (runStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') {
                overallStatus = runStatus; 
            }
            if (runStatus === 'MEMORY_LIMIT_EXCEEDED') {
                maxMemoryUsed = 256; 
            }
        }

        await query(
            `UPDATE submissions SET status = $1, execution_time = $2, memory_used = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4;`, 
            [overallStatus, maxExecutionTime, maxMemoryUsed, submissionId]
        );
        
        console.log(`[${jobId}] Finished processing. Verdict: ${overallStatus}`);

        redisPublisher.publish('job-results', JSON.stringify({
            jobId: submissionId,
            status: overallStatus,
            executionTime: maxExecutionTime
        }));

    } catch (error) {
        console.error(`[${jobId}] Error in worker processor:`, error);
        await query(`UPDATE submissions SET status = 'SYSTEM_ERROR', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [submissionId]);
    } finally {
        if (existsSync(jobDir)) {
            rmSync(jobDir, { recursive: true, force: true });
        }
    }
};

const worker = new Worker('submissions', processSubmission, { 
    connection,
    concurrency: 5,
    lockDuration: 30000, 
    limiter: {
        max: 50,         
        duration: 1000   
    }
});

worker.on('completed', (job) => {
    console.log(`[${job.opts?.jobId}] ✅ Removed from queue successfully.`);
});

worker.on('failed', (job, error) => {
    console.error(`[${job?.opts?.jobId}] ❌ Queue processing failure: ${error.message}`);
});

worker.on('error', (err) => {
    console.error('⚠️ Worker Instance Error (Redis Disconnect?):', err);
});

worker.on('stalled', (jobId) => {
    console.warn(`[${jobId}] ⚠️ Job stalled. Node event loop may be blocked. Queue is recovering it.`);
});