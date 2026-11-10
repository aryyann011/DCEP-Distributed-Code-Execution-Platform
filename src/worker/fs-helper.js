import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

export const setupJobDirectory = (submissionId) => {
    const baseDir = process.env.JOBS_DIR || os.tmpdir();
    const jobDir = path.join(baseDir, `job_${submissionId}`);
    if (!existsSync(jobDir)) {
        mkdirSync(jobDir);
    }
    return jobDir;
};

export const writeSourceCode = (jobDir, fileName, code) => {
    const srcFilePath = path.join(jobDir, fileName);
    writeFileSync(srcFilePath, code);
};

export const writeTestCaseInput = (jobDir, input) => {
    const inputFilePath = path.join(jobDir, 'input.txt');
    writeFileSync(inputFilePath, input);
    return inputFilePath;
};

export const cleanupJobDirectory = (jobDir) => {
    if (existsSync(jobDir)) {
        rmSync(jobDir, { recursive: true, force: true });
    }
};