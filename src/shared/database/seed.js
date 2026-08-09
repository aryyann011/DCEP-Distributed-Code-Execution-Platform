import { query } from './db.js';

async function seed() {
    try {
        console.log("Checking for problems...");
        const res = await query('SELECT id FROM problems LIMIT 1');
        
        if (res.rows.length > 0) {
            console.log("Database already has a problem with ID:", res.rows[0].id);
            process.exit(0);
        }

        console.log("Database is empty. Seeding 'Two Sum'...");
        
        const problemRes = await query(`
            INSERT INTO problems (title, description, time_limit, memory_limit) 
            VALUES ('Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.', 2000, 256)
            RETURNING id;
        `);
        const problemId = problemRes.rows[0].id;
        console.log(`Created Problem ID: ${problemId}`);

        // Create test cases
        await query(`
            INSERT INTO test_cases (problem_id, input, expected_output, is_hidden)
            VALUES 
            ($1, '4\n2 7 11 15\n9', '0 1', false),
            ($1, '3\n3 2 4\n6', '1 2', false),
            ($1, '2\n3 3\n6', '0 1', true)
        `, [problemId]);

        console.log("Seeded 3 test cases for Two Sum.");
        console.log("Seed complete!");
        process.exit(0);

    } catch (e) {
        console.error("Seed failed:", e);
        process.exit(1);
    }
}

seed();
