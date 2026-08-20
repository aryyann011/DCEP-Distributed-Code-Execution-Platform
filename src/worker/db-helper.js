import { query } from "../shared/database/db.js";

export const fetchSubmission = async (submissionId) => {
    const res = await query(
        `SELECT id, problem_id, language, code FROM submissions WHERE id = $1;`,
        [submissionId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
};

export const fetchProblemLimits = async (problemId) => {
    const res = await query(
        `SELECT time_limit, memory_limit FROM problems WHERE id = $1;`,
        [problemId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
};

export const fetchTestCases = async (problemId) => {
    const res = await query(
        `SELECT id, input, expected_output, is_hidden FROM test_cases WHERE problem_id = $1;`,
        [problemId]
    );
    return res.rows;
};

export const updateSubmissionStatus = async (submissionId, status) => {
    await query(
        `UPDATE submissions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [status, submissionId]
    );
};

export const saveTestResult = async (submissionId, testCaseId, status, actualOutput, executionTime, memoryUsed) => {
    await query(
        `INSERT INTO submission_results (submission_id, test_case_id, status, actual_output, execution_time, memory_used) 
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [submissionId, testCaseId, status, actualOutput, executionTime, memoryUsed]
    );
};

export const finalizeSubmission = async (submissionId, overallStatus, executionTime, memoryUsed) => {
    await query(
        `UPDATE submissions 
         SET status = $1, execution_time = $2, memory_used = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4;`,
        [overallStatus, executionTime, memoryUsed, submissionId]
    );
};