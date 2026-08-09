import pkg from 'pg';
const { Pool } = pkg;

import * as dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("DATABASE_URL loaded:", !!process.env.DATABASE_URL);
dotenv.config({
    path: path.resolve(__dirname, '../../../.env')
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
});

export const query = (text, params) => {
    return pool.query(text, params);
};