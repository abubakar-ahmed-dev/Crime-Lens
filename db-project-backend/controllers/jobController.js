/**
 * Admin job/queue status endpoints (Phase 12).
 * Trimmed exposure: no raw job.data or stacktrace (plan audit, item 14).
 */

import { findJobById, getQueueDepthCounts } from "../config/queue.js";
import { logger } from "../config/logger.js";

export const getAllQueueStatus = async (req, res) => {
  try {
    const counts = await getQueueDepthCounts();
    return res.json({ success: true, queues: counts });
  } catch (error) {
    req.log.error({ err: error }, "Queue status error");
    return res.status(500).json({ success: false, message: "Error fetching queue status" });
  }
};

export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const found = await findJobById(jobId);

    if (!found) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const { job, queueName } = found;
    const state = await job.getState().catch(() => "unknown");

    return res.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        queue: queueName,
        state,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        returnvalue: job.returnvalue,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Job status error");
    return res.status(500).json({ success: false, message: "Error fetching job status" });
  }
};
