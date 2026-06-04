import { Worker } from "bullmq";
import Docker from 'dockerode';
import { writeFileSync } from 'fs';
import IORedis from 'ioredis';
import * as dotenv from 'dotenv'

dotenv.config()

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const connection = new IORedis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });
const docker = new Docker();
const redisPublisher = new IORedis({ host: redisHost, port: redisPort });

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
        console.log(`[${jobId}] Container started. Clock is ticking.....`)

        const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("TIME_LIMIT_EXCEEDED"))
            }, 2000)
        })
        
        let output = "";
        try {
            await Promise.race([container.wait(), timeoutPromise])
            const logs = await container.logs({ stdout: true, stderr: true });
            output = logs.toString('utf-8').replace(/[^\x20-\x7E\n]/g, '').trim();
        }  catch (error) {
            if(error.message === 'TIME_LIMIT_EXCEEDED'){
                console.log(`[${jobId}] 🛑 TIME LIMIT EXCEEDED. Assassinating container...`);
                await container.kill();
                output = "Error: Execution Time Limit Exceeded (2.0s)";
            }
            else{
                output = "Error: Internal Server Execution Failure";
                console.error(error);
            }
        }
        finally{
            console.log(`[${jobId}] Destroying Sandbox...`);
            await container.remove()
        }
        
        console.log(`[${jobId}] Publishing result to Intercom...`);
        redisPublisher.publish('job-results', JSON.stringify({
            jobId: jobId,
            output: output
        }));
        return output;
    },
    { connection }
);

worker.on('failed', (job, error)=>{
    console.log(`[${job?.opts?.jobId}] failed due to the error ${error.message}`);
});