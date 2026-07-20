import e from "express";
import { RunTheCode } from "../controller/submission.controller.js";
import { submissionLimiter } from "../../middleware/rateLimiter.js";

const router = e.Router();

router.post('/submit', submissionLimiter, RunTheCode);

export default router