import { Worker } from "bullmq";
import Docker from 'dockerode';
import { writeFileSync } from 'fs';
import IORedis from 'ioredis';

const connection = new IORedis({ host : '127.0.0.1', port : 6379, maxRetriesPerRequest : null });
const docker = new Docker();

console.log("Worker is online listening to submission queue");

const worker = new Worker(
    'submissions', 
    async job => {
        const code = job.data.code;
        const jobId = job.opts.jobId;
        
        const fileName = `${jobId}.cpp`;
        const outputName = `${jobId}.out`;
        
        writeFileSync(fileName, code);
        console.log(`[${jobId}] Processing code:\n${code}`);
        const currentDirectory = process.cwd();

        console.log(`[${jobId}] Spinning up Docker Sandbox...`);

        const container = await docker.createContainer({
            Image: 'cpp-sandbox',
            Tty: false,
            Cmd: ['sh', '-c', `g++ ${fileName} -o ${outputName} && ./${outputName}`],
            HostConfig: {
                Binds: [`${currentDirectory}:/app`], 
                Memory: 256 * 1024 * 1024,           
                NetworkMode: 'none',                 
            }
        });

        await container.start();
        await container.wait();

        const logs = await container.logs({ stdout: true, stderr: true });
        const output = logs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();

        console.log(`[${jobId}] Destroying Sandbox...`);
        await container.remove();

        return output;
    },
    { connection }
);

worker.on('failed', (job, error)=>{
    console.log(`[${job?.opts?.jobId}] failed due to the error ${error.message}`);
});