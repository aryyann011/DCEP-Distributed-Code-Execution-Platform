import { Queue } from 'bullmq';
import crypto from 'crypto';

const submissionQueue = new Queue('submissions', {
    connection : {
        host : '127.0.0.1',
        port : 6379
    }
});

export const RunTheCode = async (req, res) => {
    try {
        const jobId = crypto.randomUUID();
        const code = req.body.code;

        await submissionQueue.add('Compile-job', { code : code }, {jobId : jobId});

        return res.status(200).json({
            success : true,
            status : 'QUEUED',
            jobId : jobId,
            message : "code successfully queued"
        });

    } catch (error) {
        console.error("Queue Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}