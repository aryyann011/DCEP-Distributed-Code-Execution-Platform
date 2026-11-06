import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3000';

describe('POST /api/submit (Validation Checks)', () => {
    it('returns 400 if the payload is completely empty', async () => {
        const response = await request(API_URL)
            .post('/api/submit')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Expecting errors for problemId, language, and code
        expect(response.body.errors).toHaveProperty('problemId');
        expect(response.body.errors).toHaveProperty('language');
        expect(response.body.errors).toHaveProperty('code');
    });

    it('returns 400 if an unsupported language is provided (e.g., Rust)', async () => {
        const payload = {
            problemId: uuidv4(),
            language: 'rust',
            code: 'fn main() { println!("Hello World!"); }'
        };

        const response = await request(API_URL)
            .post('/api/submit')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveProperty('language');
        expect(response.body.errors.language[0]).toBe('unsupported language must be cpp, python, java');
    });

    it('returns 400 if the code string is empty', async () => {
        const payload = {
            problemId: uuidv4(),
            language: 'python',
            code: ''
        };

        const response = await request(API_URL)
            .post('/api/submit')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveProperty('code');
    });

    it('returns 400 if problem_id is missing', async () => {
        const payload = {
            language: 'cpp',
            code: '#include <iostream>\nint main() { return 0; }'
        };

        const response = await request(API_URL)
            .post('/api/submit')
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveProperty('problemId');
    });
});