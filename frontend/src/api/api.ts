export async function getProblem() {
    try {
        const response = await fetch('/api/problem');
        const data = await response.json();
        
        if (data.success) {
            return data.problem;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error("Failed to fetch problem:", error);
        return null;
    }
}

export async function submitCode(problemId: string, language: string, code: string, apiKey: string) {
    const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
        },
        body: JSON.stringify({ problemId, language, code }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Submission failed');
    }

    return data;
}
