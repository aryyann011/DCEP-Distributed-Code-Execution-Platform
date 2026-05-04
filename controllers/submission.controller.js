import { writeFileSync } from 'fs';
import { exec } from 'child_process';
import util from 'util';
import crypto from 'crypto'; 

const execPromise = util.promisify(exec);

export const RunTheCode = async (req, res) => {
    try {
        const code = req.body.code;

        const jobId = crypto.randomUUID();
        const fileName = `${jobId}.cpp`;
        const outputName = `${jobId}.out`;

        console.log(`[${jobId}] Writing file...`);
        writeFileSync(fileName, code);

        console.log(`[${jobId}] Compiling...`);
        await execPromise(`g++ ${fileName} -o ${outputName}`);

        console.log(`[${jobId}] Running...`);
        const { stdout, stderr } = await execPromise(`./${outputName}`);

        if (stderr) {
            return res.status(400).json({ success: false, error: stderr });
        }

        return res.status(200).json({ success: true, output: stdout });

    } catch (err) {
        const errorMessage = err.stderr ? err.stderr : err.message;
        return res.status(500).json({ success: false, error: errorMessage });
    }
};