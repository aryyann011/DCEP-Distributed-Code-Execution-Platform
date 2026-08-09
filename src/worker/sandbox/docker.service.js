import Docker from 'dockerode';
const docker = new Docker();

export const compileCpp = async (jobDir, fileName, outputName) => {
    const compilerContainer = await docker.createContainer({
        Image: 'cpp-sandbox',
        Tty: false,
        Cmd: ['g++', '/app/' + fileName, '-O2', '-o', '/app/' + outputName],
        HostConfig: {
            Binds: [`${jobDir}:/app`],
            Memory: 512 * 1024 * 1024, 
            NetworkMode: 'none',
            NanoCpus: 1000000000,                  
            PidsLimit: 32,                         
            SecurityOpt: ['no-new-privileges:true'] 
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

export const executeCpp = async (jobDir, outputName, inputName, memory_limit, time_limit) => {
    const startTime = Date.now();
    const runnerContainer = await docker.createContainer({
        Image: 'cpp-sandbox',
        Tty: false,
        Cmd: ['sh', '-c', `/app/${outputName} < /app/${inputName}`],
        HostConfig: {
            Binds: [`${jobDir}:/app`], 
            Memory: memory_limit * 1024 * 1024,   
            NetworkMode: 'none',                 
            NanoCpus: 1000000000,                  
            PidsLimit: 32,                         
            SecurityOpt: ['no-new-privileges:true'] 
        }
    });

    await runnerContainer.start();

    const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => { reject(new Error("TIME_LIMIT_EXCEEDED")); }, time_limit);
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
        executionTime = Date.now() - startTime;

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