import express from "express";
import {
  agentRequest,
  verifyAgentRequest,
  rejectAgentRequest,
  getPendingRequests,
  getRequestById,
  getAllAgents,updateAgent, deleteAgent
} from "../controllers/agentController.js";
import { verifyToken, authorizeRoles } from "../middleware/authMiddleware.js";
import { applyRateLimit } from "../middleware/rateLimiterMiddleware.js";
import { validate } from "../middleware/validationMiddleware.js";
import { agentRequestSchema } from "../validators/schemas.js";

const router = express.Router();

const adminOnly = [verifyToken, authorizeRoles("admin")];

// Admin routes
router.get("/all", adminOnly, getAllAgents);
// Update agent details (admin only)
router.put("/update/:id", adminOnly, updateAgent);

// Delete agent
router.delete("/delete/:id", adminOnly, deleteAgent);

// Public agent registration request — strict limit (unauthenticated write) + validation
router.post(
  "/request",
  applyRateLimit("citizenAuth"),
  validate(agentRequestSchema),
  agentRequest
);

// Admin-only routes
router.post("/verify/:requestId", adminOnly, verifyAgentRequest);
router.post("/reject/:requestId", adminOnly, rejectAgentRequest);
router.get("/pending", adminOnly, getPendingRequests);
// router.get("/:requestId", getRequestById);

export default router;
