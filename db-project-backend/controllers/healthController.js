/**
 * Health check controllers.
 *
 * Two concepts (see CLAUDE.md §7):
 *   /health — process health: the API is running. No dependency calls.
 *   /ready  — dependency health: the API can serve traffic right now.
 *
 * Phase 2 checks PostgreSQL only. Phase 3 (Redis) extends /ready by adding
 * a redis entry to the same checks object — no redesign required.
 */

import db from "../models/index.js";

const API_VERSION = "1.0.0";

/**
 * GET /api/health
 * Process-alive probe. Returns 200 as long as the process can respond.
 * Makes NO database round-trip so it stays reliable (and fast) even when
 * dependencies are down.
 */
export const processHealth = (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: API_VERSION,
    environment: process.env.NODE_ENV || "development",
  });
};

/**
 * GET /api/ready
 * Dependency probe. 200 = ready to serve traffic, 503 = not ready.
 *
 * Uses SELECT 1 rather than sequelize.authenticate(): authenticate() can
 * succeed off an already-pooled connection without proving the database
 * still accepts queries. SELECT 1 costs one real round-trip.
 *
 * Failure messages returned to the client are generic on purpose —
 * pg connect errors can embed connection details. Real errors are logged
 * server-side only.
 */
export const readinessCheck = async (req, res) => {
  const checks = {
    database: { status: "unknown", responseTime: null },
    redis: { status: "not_implemented", message: "Redis not yet implemented (Phase 3)" },
  };

  let ready = true;
  const started = Date.now();
  try {
    await db.sequelize.query("SELECT 1");
    checks.database = { status: "up", responseTime: Date.now() - started };
  } catch (error) {
    ready = false;
    console.error("Readiness check: database unreachable:", error.message);
    checks.database = {
      status: "down",
      responseTime: Date.now() - started,
      message: "Database connection failed",
    };
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
};
