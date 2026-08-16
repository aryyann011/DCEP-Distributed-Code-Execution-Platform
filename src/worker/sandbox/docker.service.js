import Docker from 'dockerode';
const docker = new Docker();

const SANDBOX_IMAGE = 'code-sandbox';

const SANDBOX_SECURITY = {
    NetworkMode: 'none',
    NanoCpus: 1000000000,
    PidsLimit: 32,
    SecurityOpt: ['no-new-privileges:true']
};


const LANG_CONFIG = {
    cpp: {
        srcFile: 'main.cpp',
        binFile: 'a.out',
        needsCompilation: true,
        compileCmd: (src, bin) => ['g++', `/app/${src}`, '-O2', '-o', `/app/${bin}`],
        executeCmd: (bin, input) => ['sh', '-c', `/app/${bin} < /app/${input}`],
    },
    python: {
        srcFile: 'main.py',
        binFile: null,
        needsCompilation: false,
        compileCmd: null,
        executeCmd: (_, input) => ['sh', '-c', `python3 /app/main.py < /app/${input}`],
    },
    java: {
        srcFile: 'Main.java',
        binFile: 'Main',
        needsCompilation: true,
        compileCmd: (src) => ['javac', `/app/${src}`],
        executeCmd: (bin, input) => ['sh', '-c', `java -cp /app ${bin} < /app/${input}`],
    },
};


export const compile = async (jobDir, language) => {
    const config = LANG_CONFIG[language];

    if (!config || !config.needsCompilation) {
        return { statusCode: 0, errorOutput: '' };
    }

    const compilerContainer = await docker.createContainer({
        Image: SANDBOX_IMAGE,
        Tty: false,
        Cmd: config.compileCmd(config.srcFile, config.binFile),
        HostConfig: {
            Binds: [`${jobDir}:/app`],
            Memory: 512 * 1024 * 1024,
            ...SANDBOX_SECURITY,
        }
    });

    await compilerContainer.start();
    const compilerExit = await compilerContainer.wait();

    let errorOutput = '';
    if (compilerExit.StatusCode !== 0) {
        const compilerLogs = await compilerContainer.logs({ stdout: true, stderr: true });
        errorOutput = compilerLogs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();
    }

    await compilerContainer.remove();

    return {
        statusCode: compilerExit.StatusCode,
        errorOutput
    };
};


export const execute = async (jobDir, language, memory_limit, time_limit) => {
    const config = LANG_CONFIG[language];
    const inputName = 'input.txt';

    const runnerContainer = await docker.createContainer({
        Image: SANDBOX_IMAGE,
        Tty: false,
        Cmd: config.executeCmd(config.binFile, inputName),
        HostConfig: {
            Binds: [`${jobDir}:/app`],
            Memory: memory_limit * 1024 * 1024,
            ...SANDBOX_SECURITY,
        }
    });

    await runnerContainer.start();

    // Hard timeout includes a 2-second grace period for Docker overhead
    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => { reject(new Error("TIME_LIMIT_EXCEEDED")); }, time_limit + 2000);
    });

    let actualOutput = '';
    let executionTime = 0;
    let containerStatus = 'COMPLETED';
    let isOom = false;
    let exitCode = 0;

    try {
        const runExit = await Promise.race([runnerContainer.wait(), timeoutPromise]);

        const inspectData = await runnerContainer.inspect();
        isOom = inspectData.State?.OOMKilled || false;
        exitCode = runExit.StatusCode;

        const logs = await runnerContainer.logs({ stdout: true, stderr: true });
        actualOutput = logs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();
        
        // Calculate exact execution time from container state to ignore Docker overhead
        const startedAt = new Date(inspectData.State.StartedAt).getTime();
        const finishedAt = new Date(inspectData.State.FinishedAt).getTime();
        executionTime = Math.max(0, finishedAt - startedAt);

    } catch (error) {
        if (error.message === 'TIME_LIMIT_EXCEEDED') {
            try { await runnerContainer.kill(); } catch (e) { /* ignore if already dead */ }
            actualOutput = `Error: Execution Time Limit Exceeded (${time_limit}ms)`;
            containerStatus = 'TIME_LIMIT_EXCEEDED';
            executionTime = time_limit;
        } else {
            throw error;
        }
    } finally {
        await runnerContainer.remove();
    }

    return { containerStatus, actualOutput, executionTime, isOom, exitCode };
};

export { LANG_CONFIG };