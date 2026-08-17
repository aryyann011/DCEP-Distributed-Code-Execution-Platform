import e from "express";
import { RunTheCode, GetProblem } from "../controller/submission.controller.js";
import { submissionLimiter } from "../../middleware/rateLimiter.js";
import { validateSubmission } from "../../middleware/validate.js";

const router = e.Router();

router.get('/problem', GetProblem);
router.post('/submit', submissionLimiter, validateSubmission, RunTheCode);

export default router