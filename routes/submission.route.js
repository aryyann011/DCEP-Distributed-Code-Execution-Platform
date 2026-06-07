import e from "express";
import { RunTheCode } from "../controllers/submission.controller.js";

const router = e.Router();

router.post('/submit', RunTheCode);

export default router