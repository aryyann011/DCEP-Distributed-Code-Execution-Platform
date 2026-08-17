import {z} from 'zod'

const submissionSchema = z.object({
    problem_id : z.string().uuid("Invalid Problem Id format"),
    language : z.enum(['cpp', 'python', 'java'], {
        errorMap: () => ({
            message : "unsupported language must be cpp, python, java"
        })
    }),
    code : z.ZodCustomStringFormat(1, "Code cannot be empty")
});

export const validateSubmission = (req, res, next) => {
    const result = submissionSchema.safeParse(req.body);

    if(!result.success){
        return res.status(400).json({
            success: false,
            errors: result.error.errors.map(err => err.message)
        });
    }

    next();
}