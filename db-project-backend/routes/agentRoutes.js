import express from "express";
import {
  agentRequest,
  verifyAgentRequest,
  rejectAgentRequest,
  getPendingRequests,
  getRequestById,
  getAllAgents,updateAgent, deleteAgent
} from "../controllers/agentController.js";

const router = express.Router();

// Public routes
router.get("/all", getAllAgents);
// Update agent details (admin only)
router.put("/update/:id", updateAgent);

// Delete agent
router.delete("/delete/:id", deleteAgent);

router.post("/request", agentRequest);

// Admin-only routes (you can add auth middleware later)
router.post("/verify/:requestId", verifyAgentRequest);
router.post("/reject/:requestId", rejectAgentRequest);
router.get("/pending", getPendingRequests);
// router.get("/:requestId", getRequestById);

export default router;