import { writeFileSync } from 'fs';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const RunTheCode = async (req, res) => {
    try {
        const code = req.body.code;

        const fileName = 'temp.cpp';
        const outputName = 'temp.out';

        console.log("Writing file...");
        writeFileSync(fileName, code);

        console.log("Compiling...");
        await execPromise(`g++ ${fileName} -o ${outputName}`);

        console.log("Running...");
        const { stdout, stderr } = await execPromise(`${outputName}`);

        if (stderr) {
            return res.status(400).json({
                success: false,
                error: stderr
            });
        }

        return res.status(200).json({
            success: true,
            output: stdout
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
};