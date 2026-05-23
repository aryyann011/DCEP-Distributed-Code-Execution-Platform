import { Worker } from "bullmq";
import Docker from 'dockerode';
import { writeFileSync } from 'fs';
import IORedis from 'ioredis';


const connection = new IORedis({ host : '127.0.0.1', port : 6379, maxRetriesPerRequest : null });
const docker = new Docker();
const redisPublisher = new IORedis({ host: '127.0.0.1', port: 6379 });

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
        } catch (error) {
            if(error.message === 'TIME_LIMIT_EXCEEDED'){
                console.log(`[${jobId}] 🛑 TIME LIMIT EXCEEDED. Assassinating container...`);

                await container.kill();

                output = "Error : Execution Time Limit, Execeeded(2.0s)"
            }
            else{
                output = "Error : Interval server Execiton failure"
                console.error(error)
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