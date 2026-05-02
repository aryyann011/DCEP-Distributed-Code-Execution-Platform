import e from "express";
import { RunTheCode } from "../controllers/submission.controller.js";

const router = e.Router();

router.post('/', RunTheCode)

export default router