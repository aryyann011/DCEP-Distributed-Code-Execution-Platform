/**
 * Evaluates the actual output against the expected output using token-diffing.
 * Ignores trailing spaces, newlines, and normalizes whitespace.
 */
export const isCorrectOutput = (actual, expected) => {
    if (!actual || !expected) return false;
    
    const actualTokens = actual.trim().split(/\s+/);
    const expectedTokens = expected.trim().split(/\s+/);

    if (actualTokens.length !== expectedTokens.length) {
        return false;
    }

    for (let i = 0; i < actualTokens.length; i++) {
        if (actualTokens[i] !== expectedTokens[i]) {
            return false;
        }
    }

    return true;
};