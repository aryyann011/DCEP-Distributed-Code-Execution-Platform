import { Worker } from "bullmq";
import Docker from 'dockerode';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv';
import { query } from './database/db.js'; 

dotenv.config();

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const connection = new IORedis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });
const docker = new Docker();
const redisPublisher = new IORedis({ host: redisHost, port: redisPort });

console.log("Worker is online listening to submission queue...");

export const processSubmission = async (job) => {
    const submissionId = job.data.submissionId;
    const jobId = job.opts?.jobId || submissionId; 
    console.log(`\n[${jobId}] Starting processing for Submission ID: ${submissionId}`);

    const currentDirectory = process.cwd();
    const fileName = `${submissionId}.cpp`;
    const outputName = `${submissionId}.out`;
    const inputName = `${submissionId}_input.txt`;

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

        writeFileSync(fileName, code);

        let overallStatus = 'ACCEPTED';
        let maxExecutionTime = 0;
        let maxMemoryUsed = 0;

        console.log(`[${jobId}] STAGE 1: Compiling C++ binary...`);
        const compilerContainer = await docker.createContainer({
            Image: 'cpp-sandbox',
            Tty: false,
            Cmd: ['g++', '/app/' + fileName, '-O2', '-o', '/app/' + outputName],
            HostConfig: {
                Binds: [`${currentDirectory}:/app`],
                Memory: 512 * 1024 * 1024, 
                NetworkMode: 'none',
                NanoCpus: 1000000000,                  
                PidsLimit: 32,                         
                SecurityOpt: ['no-new-privileges:true'] 
            }
        });

        await compilerContainer.start();
        
        const compilerExit = await compilerContainer.wait();
        
        if (compilerExit.StatusCode !== 0) {
            const compilerLogs = await compilerContainer.logs({ stdout: true, stderr: true });
            const compileErrorOutput = compilerLogs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();
            
            console.log(`[${jobId}] 🛑 COMPILE ERROR.`);
            await compilerContainer.remove();
            
            await query(
                `UPDATE submissions SET status = 'COMPILE_ERROR', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, 
                [submissionId]
            );
            
            redisPublisher.publish('job-results', JSON.stringify({
                jobId: submissionId, 
                status: 'COMPILE_ERROR', 
                error: compileErrorOutput
            }));
            
            return; 
        }

        await compilerContainer.remove();
        console.log(`[${jobId}] Compilation Successful. Moving to Execution phase.`);

        
        for (const testCase of testCases) {
            console.log(`[${jobId}] Running Test Case: ${testCase.id}`);

            writeFileSync(inputName, testCase.input);

            let runStatus = 'ACCEPTED';
            let actualOutput = '';      
            let executionTime = 0;      
            let memoryUsed = 0; 
            
            const startTime = Date.now();

            const runnerContainer = await docker.createContainer({
                Image: 'cpp-sandbox',
                Tty: false,
                Cmd: ['sh', '-c', `/app/${outputName} < /app/${inputName}`],
                HostConfig: {
                    Binds: [`${currentDirectory}:/app`], 
                    Memory: 256 * 1024 * 1024,   
                    NetworkMode: 'none',                 
                    NanoCpus: 1000000000,                  
                    PidsLimit: 32,                         
                    SecurityOpt: ['no-new-privileges:true'] 
                }
            });

            await runnerContainer.start();

            const timeoutPromise = new Promise((resolve, reject) => {
                setTimeout(() => { reject(new Error("TIME_LIMIT_EXCEEDED")); }, 2000);
            });
            
            try {
                const runExit = await Promise.race([runnerContainer.wait(), timeoutPromise]);

                const inspectData = await runnerContainer.inspect();
                const isOomKilled = inspectData.State?.OOMKilled || false;
                const logs = await runnerContainer.logs({ stdout: true, stderr: true });
                actualOutput = logs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();
                

                executionTime = Date.now() - startTime;

                if (isOomKilled) {
                    console.log(`[${jobId}] 🛑 MEMORY LIMIT EXCEEDED.`);
                    runStatus = 'MEMORY_LIMIT_EXCEEDED';
                    actualOutput = "Error: Memory Limit Exceeded (256MB)";
                } else if (runExit.StatusCode !== 0) {
                    // Handle normal runtime crashes (Segfaults, non-zero exits)
                    console.log(`[${jobId}] 🛑 RUNTIME ERROR. Exit Code: ${runExit.StatusCode}`);
                    runStatus = 'RUNTIME_ERROR';
                } else if (actualOutput !== testCase.expected_output.trim()) {
                    runStatus = 'WRONG_ANSWER';
                }

            } catch (error) {
                if (error.message === 'TIME_LIMIT_EXCEEDED') {
                    console.log(`[${jobId}] 🛑 TIME LIMIT EXCEEDED. Assassinating container...`);
                    await runnerContainer.kill();
                    actualOutput = "Error: Execution Time Limit Exceeded (2.0s)";
                    runStatus = 'TIME_LIMIT_EXCEEDED';
                    executionTime = 2000;
                } else {
                    actualOutput = "Error: Internal Server Execution Failure";
                    runStatus = 'SYSTEM_ERROR';
                    console.error(error);
                }
            } finally {
                await runnerContainer.remove();
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
        if (existsSync(fileName)) unlinkSync(fileName);
        if (existsSync(outputName)) unlinkSync(outputName);
        if (existsSync(inputName)) unlinkSync(inputName);
    }
};

const worker = new Worker('submissions', processSubmission, { connection });

worker.on('failed', (job, error) => {
    console.log(`[${job?.opts?.jobId}] Queue failure: ${error.message}`);
});