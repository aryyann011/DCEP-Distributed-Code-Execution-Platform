import request from 'supertest';

const API_URL = 'http://localhost:3000';

describe('System Health Checks', () => {
    it('returns 200 Ok when database and redis are running', async () => {
        const response = await request(API_URL).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
    });
});