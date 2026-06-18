import e from "express";
import { RunTheCode } from "../controller/submission.controller.js";

const router = e.Router();

router.post('/submit', RunTheCode);

export default router