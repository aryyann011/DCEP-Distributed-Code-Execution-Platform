import Docker from 'dockerode';
import path from 'path';

const docker = new Docker();

// When the worker runs as a container, jobDir lives at /app/jobs inside it,
// which the Docker daemon cannot see as a bind source. In that mode
// SANDBOX_HOST_JOBS_DIR provides the host-side directory the daemon CAN see,
// and we substitute only the basename. On a host-run worker it is unset and
// the original behaviour (bind jobDir directly) is preserved.
const resolveBindSource = (jobDir) => {
    // Container mode: JOBS_DIR is set AND SANDBOX_HOST_JOBS_DIR (a compose
    // interpolation from .env) names the host-side directory the daemon sees.
    if (process.env.JOBS_DIR && process.env.SANDBOX_HOST_JOBS_DIR) {
        return `${process.env.SANDBOX_HOST_JOBS_DIR}/${path.basename(jobDir)}`;
    }

    // Host mode: bind jobDir directly (existing behaviour).
    return jobDir;
};

const Binds = (jobDir) => [`${resolveBindSource(jobDir)}:/app`];

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


// Captures container logs as text. Docker streams logs as multiplexed
// 8-byte-framed chunks (1 byte stream type + 4 byte big-endian size header
// per frame); we demux them so stdout/stderr arrive as plain text.
const containerLogs = async (container) => {
    const stream = await container.logs({ follow: true, stdout: true, stderr: true });
    const chunks = [];

    await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
    });

    const buf = Buffer.concat(chunks.map((c) => Buffer.isBuffer(c) ? c : Buffer.from(c)));
    let text = '';

    let offset = 0;
    while (offset + 8 <= buf.length) {
        const frameSize = buf.readUInt32BE(offset + 4);
        const frameStart = offset + 8;
        const frameEnd = Math.min(frameStart + frameSize, buf.length);
        text += buf.slice(frameStart, frameEnd).toString('utf-8');
        offset = frameEnd;
    }

    if (!text && buf.length > 0) {
        text = buf.toString('utf-8');
    }

    return text;
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
            Binds: Binds(jobDir),
            Memory: 512 * 1024 * 1024,
            ...SANDBOX_SECURITY,
        }
    });

    await compilerContainer.start();
    const compilerExit = await compilerContainer.wait();

    let errorOutput = '';
    if (compilerExit.StatusCode !== 0) {
        errorOutput = await containerLogs(compilerContainer);
        errorOutput = errorOutput.replace(/[^\x20-\x7E\n]/g, '').trim();
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
            Binds: Binds(jobDir),
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

        const rawLogs = await containerLogs(runnerContainer);
        actualOutput = rawLogs.replace(/[^\x20-\x7E\n]/g, '').trim();
        
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