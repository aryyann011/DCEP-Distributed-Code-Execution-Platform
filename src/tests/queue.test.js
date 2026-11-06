import request from 'supertest';
import { Queue } from 'bullmq';
import 'dotenv/config';

const API_URL = 'http://localhost:3000';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const QUEUE_NAME = 'submissions';

const queue = new Queue(QUEUE_NAME, {
    connection: { host: REDIS_HOST, port: REDIS_PORT }
});

const JOB_STATES = ['waiting', 'active', 'delayed', 'completed', 'failed'];

async function findJobInQueue(submissionId, { timeoutMs = 5000, intervalMs = 100 } = {}) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const jobs = await queue.getJobs(JOB_STATES, 0, 50);
        const match = jobs.find((job) => job?.data?.submissionId === submissionId);

        if (match) return match;

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return null;
}

afterAll(async () => {
    await queue.close();
});

describe('POST /api/submit (Happy Path - Redis Boundary)', () => {
    it('enqueues a real BullMQ job for a valid submission', async () => {
        const problemRes = await request(API_URL).get('/api/problem');
        expect(problemRes.status).toBe(200);
        const problemId = problemRes.body.problem.id;

        const response = await request(API_URL)
            .post('/api/submit')
            .send({
                problemId,
                language: 'python',
                code: 'print("hello from queue test")'
            });

        expect(response.status).toBe(202);
        expect(response.body.success).toBe(true);
        const submissionId = response.body.submissionId;
        expect(typeof submissionId).toBe('string');

        const job = await findJobInQueue(submissionId);
        expect(job).not.toBeNull();
        expect(job.name).toBe('execute-code');
        expect(job.data).toEqual({ submissionId });
    }, 15000);
});
