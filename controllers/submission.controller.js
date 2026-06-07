import express from 'express';
import { query } from '../database/db.js';
import { Queue } from 'bullmq'; 

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;
const submissionQueue = new Queue('submissions', {
    connection: { host: redisHost, port: redisPort }
});

const router = express.Router();

const RunTheCode = async (req, res) => {
    const { problemId, language, code } = req.body;

    if (!problemId || !language || !code) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: problemId, language, or code.' 
        });
    }

    try {
        const sql = `
            INSERT INTO submissions (problem_id, language, code, status)
            VALUES ($1, $2, $3, 'PENDING')
            RETURNING id;
        `;
        const params = [problemId, language, code];
        
        const dbResult = await query(sql, params);
        
        if (!dbResult || dbResult.rows.length === 0) {
            throw new Error('Failed to insert submission into database.');
        }

        const submissionId = dbResult.rows[0].id;

        await submissionQueue.add('execute-code', { submissionId });

        return res.status(202).json({
            success: true,
            message: 'Submission received and queued.',
            submissionId: submissionId,
            status: 'PENDING'
        });

    } catch (error) {
        console.error('Error handling submission:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Internal server error while processing submission.' 
        });
    }
};

export default router;