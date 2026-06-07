import { query } from './db.js';

async function seedDatabase() {
    try {
        console.log("🌱 Starting database seed...");

        const problemSql = `
            INSERT INTO problems (title, description, difficulty, time_limit, memory_limit)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id;
        `;
        const problemParams = [
            "Two Sum",
            "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
            "EASY",
            2000, 
            256   
        ];

        const problemResult = await query(problemSql, problemParams);
        const problemId = problemResult.rows[0].id;
        console.log(`✅ Problem created. ID: ${problemId}`);

        const testCaseSql = `
            INSERT INTO test_cases (problem_id, input, expected_output, is_hidden)
            VALUES ($1, $2, $3, $4);
        `;

        
        await query(testCaseSql, [
            problemId, 
            "4\n2 7 11 15\n9", 
            "0 1", 
            false
        ]);
        console.log(`✅ Test Case 1 created`);

        await query(testCaseSql, [
            problemId, 
            "3\n3 2 4\n6", 
            "1 2", 
            false
        ]);
        console.log(`✅ Test Case 2 created`);

        await query(testCaseSql, [
            problemId, 
            "2\n3 3\n6", 
            "0 1", 
            true
        ]);
        console.log(`✅ Test Case 3 (Hidden) created`);

        console.log("\n🎉 Database seeded successfully! Your engine is ready.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seedDatabase();