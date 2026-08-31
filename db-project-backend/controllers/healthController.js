/**
 * Health check controllers.
 *
 * Two concepts (see CLAUDE.md §7):
 *   /health — process health: the API is running. No dependency calls.
 *   /ready  — dependency health: the API can serve traffic right now.
 *
 * Phase 3 adds Redis to /ready's checks object. Redis is NOT a readiness
 * gate: the API degrades gracefully to database queries when Redis is down,
 * so only the database decides `ready` vs `not_ready`. Redis state is still
 * reported for monitoring/diagnostics.
 */

import db from "../models/index.js";
import { redisClient } from "../config/redis.js";

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
    redis: { status: "unknown", responseTime: null },
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

  // Redis: reported but not gating. If Redis is down the API still serves
  // traffic from the database (cache-aside degrades gracefully).
  const redisStarted = Date.now();
  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      checks.redis = { status: "up", responseTime: Date.now() - redisStarted };
    } else {
      checks.redis = {
        status: "down",
        message: "Redis client not connected",
        responseTime: Date.now() - redisStarted,
      };
    }
  } catch (error) {
    console.error("Readiness check: redis unreachable:", error.message);
    checks.redis = {
      status: "down",
      message: "Redis ping failed",
      responseTime: Date.now() - redisStarted,
    };
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
};
