import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function setupDb() {
    try {
        const sql = readFileSync(join(__dirname, 'init.sql'), 'utf8');

        console.log('Applying database schema...');
        await query(sql);
        console.log('Schema applied successfully.');
        process.exit(0);
    } catch (err) {
        if (err.code === '42P07' || err.code === '42710') {
            console.log('Schema already exists, skipping...');
            process.exit(0);
        }
        console.error('Schema setup failed:', err);
        process.exit(1);
    }
}

setupDb();
