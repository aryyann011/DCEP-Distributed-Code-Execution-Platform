import e from "express";
import { RunTheCode, GetProblem } from "../controller/submission.controller.js";
import { submissionLimiter } from "../../middleware/rateLimiter.js";
import { requireApiKey } from "../../middleware/ApiKey.js";

const router = e.Router();

router.get('/problem', GetProblem);
router.post('/submit', submissionLimiter, requireApiKey, RunTheCode);

export default router