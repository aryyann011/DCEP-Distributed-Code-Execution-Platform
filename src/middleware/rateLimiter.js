import rateLimit from 'express-rate-limit';

export const submissionLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 5,              
    message: {
        success: false,
        error: "Too many submissions from this IP. Please wait a minute."
    },
    standardHeaders: true, 
    legacyHeaders: false,  
});