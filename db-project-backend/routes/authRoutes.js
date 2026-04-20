// routes/authRoutes.js
import express from "express";
import { login } from "../controllers/authControllers.js";

const router = express.Router();

// POST /api/auth/login
router.post("/login", login);

// (Optional) you could add /register if needed later
// router.post("/register", registerController);

export default router;
