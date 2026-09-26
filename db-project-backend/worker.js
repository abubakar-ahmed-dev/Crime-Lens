/**
 * BullMQ worker entry point (Phase 12).
 *
 * Runs the background workers in their own process, separate from the API.
 * Deliberately DB-free: the Cloudinary cleanup jobs need no Sequelize, so
 * the worker adds no database pool pressure. The CSV follow-up will decide
 * its own model needs.
 *
 * Run: node worker.js   (or the compose `worker` service)
 */

import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { logger } from "./config/logger.js";
import {
  getCloudinaryWorker,
  closeQueueInfrastructure,
} from "./config/queue.js";

const SHUTDOWN_TIMEOUT_MS = 10000;
let shuttingDown = false;

logger.info("Starting BullMQ workers");

const worker = getCloudinaryWorker();
logger.info({ queues: [worker.name], concurrency: worker.opts.concurrency }, "Workers started");

const gracefulShutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received. Closing workers`);

  const forceExit = setTimeout(() => {
    logger.error(`Worker shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms; forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await closeQueueInfrastructure();
    logger.info("Workers closed");
  } catch (error) {
    logger.error({ err: error }, "Error during worker shutdown");
  }

  clearTimeout(forceExit);
  process.exit(exitCode);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Worker uncaught exception");
  gracefulShutdown("UNCAUGHT_EXCEPTION", 1);
});

process.on("unhandledRejection", (err) => {
  logger.error({ err }, "Worker unhandled promise rejection");
  gracefulShutdown("UNHANDLED_REJECTION", 1);
});
