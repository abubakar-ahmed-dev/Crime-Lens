import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./models/index.js";
import { validateEnv } from "./config/envValidation.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";

import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import zonesRoutes from "./routes/zoneRoutes.js";
import crimeRoutes from "./routes/crimeRoutes.js";
import citizenAuthRoutes from "./routes/citizenAuthRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import { queryLoggerMiddleware } from "./middleware/queryLogger.js";

dotenv.config();

// Validate environment variables before starting the server
validateEnv();

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());
app.use(queryLoggerMiddleware); // dev-only slow-request logging (>100ms)

// Health routes mounted FIRST so /health and /ready stay responsive
// regardless of downstream route/middleware issues
app.use("/api", healthRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/crimes", crimeRoutes);
app.use("/api/citizens", citizenAuthRoutes);
app.use("/api/media", mediaRoutes);

const { sequelize } = db;
const PORT = process.env.PORT || 5001;

let server;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established with Supabase.");

    // Redis is best-effort: startup must not fail when it is unavailable
    await connectRedis();

    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    process.exit(1);
  }
};

startServer();

// ---------------------------
// Graceful shutdown
// Stops accepting new connections, closes the DB pool, then exits.
// A force-exit guard bounds shutdown time even if the pool won't close
// (e.g. database already unreachable).
// ---------------------------
const SHUTDOWN_TIMEOUT_MS = 5000;
let shuttingDown = false;

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return; // ignore repeated signals while already shutting down
  shuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Arm the force-exit guard for THIS shutdown only (unref'd so it can
  // never keep the event loop alive during normal operation)
  const forceExit = setTimeout(() => {
    console.error(`Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms; forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // 1. Stop accepting new connections; wait for in-flight requests to finish
  const serverClosed = new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => {
      console.log("HTTP server closed");
      resolve();
    });
  });

  // 2. Close the database connection pool
  const poolClosed = sequelize
    .close()
    .then(() => console.log("Database connection pool closed"))
    .catch((error) => console.error("Error closing database pool:", error.message));

  // 3. Close Redis (best-effort — must never block or fail shutdown)
  const redisClosed = disconnectRedis().catch((error) =>
    console.error("Error closing Redis:", error.message)
  );

  await Promise.all([serverClosed, poolClosed, redisClosed]);

  console.log("Graceful shutdown completed");
  process.exit(exitCode);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION", 1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
  gracefulShutdown("UNHANDLED_REJECTION", 1);
});

// Exported for testability (graceful-shutdown verification on Windows,
// where external SIGINT/SIGTERM delivery terminates Node unconditionally)
export { gracefulShutdown };
