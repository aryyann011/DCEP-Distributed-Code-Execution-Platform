import { Worker } from "bullmq";
import { connection } from "../shared/queues/connection.js";
import { compile, execute, LANG_CONFIG } from "./sandbox/docker.service.js";
import { isCorrectOutput } from "./evaluators/grader.service.js";

import { logger } from "../shared/utils/logger.js";
import * as fsHelper from "./fs-helper.js";
import * as dbHelper from "./db-helper.js";
import * as telemetry from "./telmetry.js";

logger.info("Worker is online listening to submission queue...");

export const processSubmission = async (job) => {
    const submissionId = job.data.submissionId;
    const jobId = job.opts?.jobId || submissionId; 
    
    logger.info({ jobId, submissionId }, "Starting processing for Submission");

    const jobDir = fsHelper.setupJobDirectory(submissionId);

    try {
        await dbHelper.updateSubmissionStatus(submissionId, 'RUNNING');

        const submission = await dbHelper.fetchSubmission(submissionId);
        if (!submission) throw new Error(`Submission ${submissionId} not found.`);
        const { problem_id, code, language } = submission;

        const langConfig = LANG_CONFIG[language];
        if (!langConfig) {
            await dbHelper.updateSubmissionStatus(submissionId, 'SYSTEM_ERROR');
            throw new Error(`Unsupported language: ${language}`);
        }

        const testCases = await dbHelper.fetchTestCases(problem_id);
        if (testCases.length === 0) {
            await dbHelper.updateSubmissionStatus(submissionId, 'SYSTEM_ERROR');
            throw new Error(`No test cases found for problem ${problem_id}.`);
        }

        const limits = await dbHelper.fetchProblemLimits(problem_id);
        const { time_limit, memory_limit } = limits;

        fsHelper.writeSourceCode(jobDir, langConfig.srcFile, code);

        let overallStatus = 'ACCEPTED';
        let maxExecutionTime = 0;
        let maxMemoryUsed = 0;

        if (langConfig.needsCompilation) {
            logger.info({ jobId, language, stage: 'COMPILING' }, 'Compiling source code');
            telemetry.broadcastProgress(submissionId, { stage: 'COMPILING' });

            const compileStart = Date.now();
            const { statusCode, errorOutput } = await compile(jobDir, language);
            const compilationTime = Date.now() - compileStart;
            
            if (statusCode !== 0) {
                logger.error({ jobId, stage: 'COMPILE_ERROR' }, 'Compilation failed');
                const sanitizedError = errorOutput.replace(/\/app\//g, '').replace(/[A-Z]:\\[^\s]*/gi, '');

                telemetry.broadcastProgress(submissionId, { stage: 'COMPILE_FAILED', error: sanitizedError });
                await dbHelper.updateSubmissionStatus(submissionId, 'COMPILE_ERROR');
                telemetry.broadcastResult(submissionId, { status: 'COMPILE_ERROR', error: sanitizedError });
                return; 
            }

            logger.info({ jobId, compilationTime }, 'Compilation Successful');
            telemetry.broadcastProgress(submissionId, { stage: 'COMPILED', compilationTime });
        } else {
            logger.info({ jobId, language }, 'Interpreted language — skipping compilation');
            telemetry.broadcastProgress(submissionId, { stage: 'COMPILED', compilationTime: 0 });
        }

        logger.info({ jobId, totalTests: testCases.length }, 'Running test cases');

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            logger.info({ jobId, testCaseId: testCase.id }, `Running Test Case ${i + 1}/${testCases.length}`);

            telemetry.broadcastProgress(submissionId, {
                stage: 'RUNNING_TEST',
                testIndex: i + 1,
                totalTests: testCases.length,
            });

            fsHelper.writeTestCaseInput(jobDir, testCase.input);

            let runStatus = 'ACCEPTED';
            let memoryUsed = 0; 
            
            const { containerStatus, actualOutput: execOutput, executionTime: execTime, isOom, exitCode } = await execute(jobDir, language, memory_limit, time_limit);

            let actualOutput = execOutput;
            let executionTime = execTime;

            if (containerStatus === 'TIME_LIMIT_EXCEEDED' || executionTime > time_limit) {
                logger.warn({ jobId }, 'Time Limit Exceeded');
                runStatus = 'TIME_LIMIT_EXCEEDED';
                if (executionTime > time_limit) actualOutput = `Error: Execution Time Limit Exceeded (${time_limit}ms)`;
            } else if (isOom) {
                logger.warn({ jobId }, 'Memory Limit Exceeded');
                runStatus = 'MEMORY_LIMIT_EXCEEDED';
                actualOutput = `Error: Memory Limit Exceeded (${memory_limit}MB)`;
            } else if (exitCode !== 0) {
                logger.warn({ jobId, exitCode }, 'Runtime Error');
                runStatus = 'RUNTIME_ERROR';
            } else if (!isCorrectOutput(actualOutput, testCase.expected_output)) {
                runStatus = 'WRONG_ANSWER';
            }

            if (executionTime > maxExecutionTime) maxExecutionTime = executionTime;
            if (runStatus === 'MEMORY_LIMIT_EXCEEDED') maxMemoryUsed = memory_limit; 
            
            await dbHelper.saveTestResult(submissionId, testCase.id, runStatus, actualOutput, executionTime, memoryUsed);

            telemetry.broadcastProgress(submissionId, {
                stage: 'TEST_RESULT',
                testIndex: i + 1,
                status: runStatus,
                executionTime,
                actualOutput: testCase.is_hidden ? null : actualOutput,
            });

            if (runStatus !== 'ACCEPTED' && overallStatus === 'ACCEPTED') overallStatus = runStatus; 
        }

        await dbHelper.finalizeSubmission(submissionId, overallStatus, maxExecutionTime, maxMemoryUsed);
        logger.info({ jobId, overallStatus }, 'Finished processing submission');

        telemetry.broadcastResult(submissionId, { status: overallStatus, executionTime: maxExecutionTime });

    } catch (error) {
        logger.error({ jobId, err: error }, 'Error in worker processor');
        await dbHelper.updateSubmissionStatus(submissionId, 'SYSTEM_ERROR');
    } finally {
        fsHelper.cleanupJobDirectory(jobDir);
    }
};

const worker = new Worker('submissions', processSubmission, { 
    connection,
    concurrency: 5,
    lockDuration: 30000, 
    limiter: { max: 50, duration: 1000 }
});

worker.on('completed', (job) => {
    logger.info({ jobId: job.opts?.jobId }, 'Removed from queue successfully');
});

worker.on('failed', (job, error) => {
    logger.error({ jobId: job?.opts?.jobId, err: error }, 'Queue processing failure');
});

worker.on('error', (err) => {
    logger.error({ err }, 'Worker Instance Error (Redis Disconnect?)');
});

worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'Job stalled. Node event loop may be blocked. Queue recovering it.');
});