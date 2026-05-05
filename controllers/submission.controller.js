import { writeFileSync } from 'fs';
import crypto from 'crypto';
import Docker from 'dockerode'; 
const docker = new Docker();

export const RunTheCode = async (req, res) => {
    try {
        const code = req.body.code;
        const jobId = crypto.randomUUID();
        const fileName = `${jobId}.cpp`;
        const outputName = `${jobId}.out`;

        console.log(`[${jobId}] Writing file to host...`);
        writeFileSync(fileName, code);

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

        return res.status(200).json({ success: true, output: output });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};