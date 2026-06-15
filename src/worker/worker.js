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

    const fileName = `main.cpp`;
    const outputName = `a.out`;
    const inputName = `input.txt`;

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
            `SELECT id, input, expected_output FROM test_cases WHERE problem_id = $1;`, 
            [problem_id]
        );
        const testCases = testCasesResult.rows;

        if (testCases.length === 0) {
            await query(`UPDATE submissions SET status = 'SYSTEM_ERROR', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [submissionId]);
            throw new Error(`No test cases found for problem ${problem_id}.`);
        }

        writeFileSync(path.join(jobDir, fileName), code);

        let overallStatus = 'ACCEPTED';
        let maxExecutionTime = 0;
        let maxMemoryUsed = 0;

        console.log(`[${jobId}] STAGE 1: Compiling C++ binary...`);
        
        // --- COMPILATION SERVICE CALL ---
        const { statusCode, errorOutput } = await compileCpp(jobDir, fileName, outputName);
        
        if (statusCode !== 0) {
            console.log(`[${jobId}] 🛑 COMPILE ERROR.`);
            
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

        for (const testCase of testCases) {
            console.log(`[${jobId}] Running Test Case: ${testCase.id}`);

            writeFileSync(path.join(jobDir, inputName), testCase.input);

            let runStatus = 'ACCEPTED';
            let memoryUsed = 0; 
            
            // --- EXECUTION SERVICE CALL ---
            const { 
                containerStatus, 
                actualOutput: execOutput, 
                executionTime: execTime, 
                isOom, 
                exitCode 
            } = await executeCpp(jobDir, outputName, inputName);

            let actualOutput = execOutput;
            let executionTime = execTime;

            // --- GRADING EVALUATION ---
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

const worker = new Worker('submissions', processSubmission, { connection });

worker.on('failed', (job, error) => {
    console.log(`[${job?.opts?.jobId}] Queue failure: ${error.message}`);
});