/**
 * BullMQ queue infrastructure (Phase 12).
 *
 * BullMQ is built on ioredis and CANNOT reuse the node-redis client from
 * config/redis.js — this module owns a dedicated ioredis connection built
 * from REDIS_URL.
 *
 * Scope (phase 12): Cloudinary media cleanup after crime deletion — a real
 * gap (deleteCrime orphans Cloudinary files today). The CSV follow-up will
 * reuse this module's factories and options.
 *
 * Failure contract: enqueueing is best-effort. A Redis outage must never
 * fail the API response that triggered the job (callers catch and log).
 */

import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
import { logger } from "./logger.js";

dotenv.config({ quiet: true });

// ---------------------------------------------------------------------------
// Connections. TWO flavors (phase-12 failure-drill finding):
//   - producers/metrics: commandTimeout bounds every command so an API
//     request never hangs behind a Redis outage (callers catch + log)
//   - worker: NO commandTimeout — BullMQ workers block on purpose and
//     maxRetriesPerRequest: null is REQUIRED for them
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let producerConnection = null;
let workerConnection = null;

export const getQueueConnection = () => {
  if (!producerConnection) {
    producerConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      commandTimeout: 5000, // bounded: producers must never wait forever
    });
    producerConnection.on("error", (err) => {
      logger.error({ err }, "Queue Redis connection error");
    });
  }
  return producerConnection;
};

const getWorkerQueueConnection = () => {
  if (!workerConnection) {
    workerConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required for blocking worker commands
      enableOfflineQueue: true,
    });
    workerConnection.on("error", (err) => {
      logger.error({ err }, "Worker Redis connection error");
    });
  }
  return workerConnection;
};

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------
export const QUEUES = {
  CLOUDINARY_DELETION: "cloudinary-deletion",
  // CSV_PROCESSING: reserved for the async-CSV follow-up phase
};

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { count: 100, age: 24 * 3600 },
  removeOnFail: { count: 500 },
};

const queues = new Map();

export const getQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: getQueueConnection(),
        defaultJobOptions,
      })
    );
  }
  return queues.get(name);
};

// ---------------------------------------------------------------------------
// Media cleanup jobs
// ---------------------------------------------------------------------------

/**
 * Enqueue Cloudinary cleanup for deleted crime media.
 * One job per resource type (image/video) so a batch destroy call is used.
 * Idempotent: Cloudinary destroy on missing ids reports "not found", which
 * the processor treats as success — safe to retry.
 * @param {Array<{publicId: string, fileType: string}>} mediaRows
 * @returns {Promise<Array<{queue: string, jobId: string}>>} added jobs
 */
export const enqueueMediaCleanup = async (mediaRows) => {
  const rows = Array.isArray(mediaRows) ? mediaRows : [];
  const byType = {
    image: rows.filter((m) => m.fileType === "image").map((m) => m.publicId),
    video: rows.filter((m) => m.fileType === "video").map((m) => m.publicId),
  };

  const added = [];
  for (const [resourceType, publicIds] of Object.entries(byType)) {
    if (!publicIds.length) continue;
    const queue = getQueue(QUEUES.CLOUDINARY_DELETION);
    const job = await queue.add(
      "delete-cloudinary-files",
      { publicIds, resourceType },
      { jobId: `media-cleanup-${resourceType}-${Date.now()}` }
    );
    logger.info(
      { queue: queue.name, jobId: job.id, resourceType, count: publicIds.length },
      "Media cleanup job enqueued"
    );
    added.push({ queue: queue.name, jobId: job.id });
  }
  return added;
};

/**
 * Processor for cloudinary-deletion jobs. Batch-deletes via the existing
 * cloudinaryConfig helper; "not found" ids are success (idempotent retries).
 */
export const processMediaCleanupJob = async (job) => {
  const { publicIds, resourceType } = job.data;
  logger.info({ jobId: job.id, resourceType, count: publicIds?.length }, "Processing media cleanup job");
  await job.updateProgress(10);

  const { deleteMultipleFiles } = await import("./cloudinaryConfig.js");
  await job.updateProgress(30);

  const result = await deleteMultipleFiles(publicIds, resourceType);
  await job.updateProgress(100);

  logger.info(
    { jobId: job.id, resourceType, result },
    "Media cleanup job completed"
  );
  return { deleted: result.deleted ?? [], failed: result.failed ?? [] };
};

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
let worker = null;

export const getCloudinaryWorker = () => {
  if (!worker) {
    worker = new Worker(QUEUES.CLOUDINARY_DELETION, processMediaCleanupJob, {
      connection: getWorkerQueueConnection(),
      concurrency: 2,
    });

    worker.on("completed", (job) => {
      logger.info({ queue: worker.name, jobId: job.id }, "Job completed");
    });
    worker.on("failed", (job, err) => {
      logger.error(
        { queue: worker.name, jobId: job?.id, attemptsMade: job?.attemptsMade, err },
        "Job failed"
      );
    });
    worker.on("error", (err) => {
      // Infrastructure-level errors (connection drops etc.) — BullMQ retries
      logger.error({ err }, "Worker error");
    });
  }
  return worker;
};

/**
 * Depth counts per queue, read cross-process by the API's metrics updater.
 * @returns {Promise<Object>} { [queueName]: { waiting, active, completed, failed, delayed } }
 */
export const getQueueDepthCounts = async () => {
  const counts = {};
  for (const name of Object.values(QUEUES)) {
    try {
      const queue = getQueue(name);
      counts[name] = {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount(),
      };
    } catch (error) {
      counts[name] = { error: error.message };
    }
  }
  return counts;
};

/**
 * Look up a job by id across all queues (admin status endpoint).
 * @returns {Promise<{job: Object, queueName: string}|null>}
 */
export const findJobById = async (jobId) => {
  for (const name of Object.values(QUEUES)) {
    try {
      const job = await getQueue(name).getJob(jobId);
      if (job) return { job, queueName: name };
    } catch {
      // Redis hiccup — try the next queue
    }
  }
  return null;
};

/**
 * Bounded shutdown: worker first (finish current job), then queues, then
 * the shared ioredis connection. Used by worker.js; the API process closes
 * its own producers via closeQueueConnections.
 */
export const closeQueueInfrastructure = async () => {
  try {
    if (worker) await worker.close();
  } catch (error) {
    logger.error({ err: error }, "Error closing worker");
  }
  await closeQueueConnections();
};

export const closeQueueConnections = async () => {
  for (const [, queue] of queues) {
    try {
      await queue.close();
    } catch (error) {
      logger.error({ err: error }, "Error closing queue");
    }
  }
  queues.clear();
  for (const conn of [producerConnection, workerConnection]) {
    if (conn) {
      try {
        await conn.quit();
      } catch {
        conn.disconnect();
      }
    }
  }
  producerConnection = null;
  workerConnection = null;
};
