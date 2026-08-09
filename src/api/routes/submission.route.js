import e from "express";
import { RunTheCode, GetProblem } from "../controller/submission.controller.js";
import { submissionLimiter } from "../../middleware/rateLimiter.js";

const router = e.Router();

router.get('/problem', GetProblem);
router.post('/submit', submissionLimiter, RunTheCode);

export default router