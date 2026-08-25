# Phase 12: BullMQ Background Workers

## Objective

Implement asynchronous background job processing using BullMQ and Redis to handle long-running operations without blocking API requests, improving user experience and system throughput.

## What We'll Implement

1. **BullMQ job queue** setup
2. **Worker processes** for background tasks
3. **Job retry logic** and failure handling
4. **Job progress tracking**
5. **UI feedback** for long-running operations

## Implementation Steps

### Step 1: Install BullMQ Dependencies

```bash
npm install bullmq
```

### Step 2: Create Job Queue Configuration

**File: `db-project-backend/config/bullmq.js`**

```javascript
import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from './redis.js';
import { logger } from './logger.js';

/**
 * BullMQ configuration for background job processing
 */

// Connection options for BullMQ
export const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  // Use Redis client if available
  connection: redisClient.isOpen ? redisClient : undefined,
};

// Job queues
export const QUEUES = {
  CSV_PROCESSING: 'csv-processing',
  CLOUDINARY_DELETION: 'cloudinary-deletion',
  EMAIL_NOTIFICATIONS: 'email-notifications',
};

// Queue configurations
export const queueConfig = {
  connection: connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
    },
  },
};

// Create queue factory
export const createQueue = (name, config = {}) => {
  return new Queue(name, { ...queueConfig, ...config });
};

// Create worker factory
export const createWorker = (queueName, processor, config = {}) => {
  return new Worker(queueName, processor, {
    connection: connection,
    concurrency: config.concurrency || 1,
    limiter: config.limiter,
  });
};

// Initialize queues
export const csvQueue = createQueue(QUEUES.CSV_PROCESSING);
export const cloudinaryQueue = createQueue(QUEUES.CLOUDINARY_DELETION);
export const emailQueue = createQueue(QUEUES.EMAIL_NOTIFICATIONS);

/**
 * Job processors
 */

// CSV processing job processor
export const processCSVJob = async (job) => {
  const { filePath, userId } = job.data;

  logger.info('Processing CSV job', { 
    jobId: job.id, 
    userId, 
    filePath 
  });

  try {
    // Import dynamically to avoid circular dependencies
    const { bulkInsertHelper } = await import('../utils/bulkInsertHelper.js');
    const fs = await import('fs');

    // Update job progress
    await job.updateProgress(10);

    // Read and parse CSV
    const fileContent = fs.readFileSync(filePath, 'utf8');
    await job.updateProgress(30);

    // Process CSV rows
    const rows = []; // Add CSV parsing logic here
    await job.updateProgress(50);

    // Bulk insert to database
    await job.updateProgress(80);

    // Clean up file
    fs.unlinkSync(filePath);
    await job.updateProgress(100);

    logger.info('CSV processing completed', { jobId: job.id });

    return { success: true, recordsProcessed: rows.length };
  } catch (error) {
    logger.error('CSV processing failed', { 
      jobId: job.id, 
      error: error.message 
    });
    throw error; // Will trigger retry
  }
};

// Cloudinary deletion job processor
export const processCloudinaryDeletionJob = async (job) => {
  const { publicIds, resourceType } = job.data;

  logger.info('Processing Cloudinary deletion', { 
    jobId: job.id, 
    count: publicIds.length 
  });

  try {
    const { deleteFile } = await import('../config/cloudinaryConfig.js');

    let deleted = 0;
    let failed = 0;

    // Process deletions in batches
    const batchSize = 10;
    for (let i = 0; i < publicIds.length; i += batchSize) {
      const batch = publicIds.slice(i, i + batchSize);
      
      for (const publicId of batch) {
        try {
          await deleteFile(publicId, resourceType);
          deleted++;
        } catch (error) {
          logger.warn('Cloudinary deletion failed', { 
            publicId, 
            error: error.message 
          });
          failed++;
        }
      }

      // Update progress
      const progress = Math.round(((i + batch.length) / publicIds.length) * 100);
      await job.updateProgress(Math.min(progress, 100));
    }

    logger.info('Cloudinary deletion completed', { 
      jobId: job.id, 
      deleted, 
      failed 
    });

    return { success: true, deleted, failed };
  } catch (error) {
    logger.error('Cloudinary deletion job failed', { 
      jobId: job.id, 
      error: error.message 
    });
    throw error;
  }
};

// Email notification job processor
export const processEmailJob = async (job) => {
  const { to, subject, template, data } = job.data;

  logger.info('Processing email job', { jobId: job.id, to, subject });

  try {
    // Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, just log the email
    logger.info('Email would be sent', { to, subject, template, data });

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return { success: true };
  } catch (error) {
    logger.error('Email job failed', { jobId: job.id, error: error.message });
    throw error;
  }
};

/**
 * Worker initialization
 */
export const initWorkers = () => {
  const workers = [];

  // CSV processing worker (single concurrency for large files)
  workers.push(createWorker(
    QUEUES.CSV_PROCESSING, 
    processCSVJob,
    { concurrency: 1 }
  ));

  // Cloudinary deletion worker (parallel deletions)
  workers.push(createWorker(
    QUEUES.CLOUDINARY_DELETION,
    processCloudinaryDeletionJob,
    { concurrency: 5 }
  ));

  // Email worker (parallel emails)
  workers.push(createWorker(
    QUEUES.EMAIL_NOTIFICATIONS,
    processEmailJob,
    { concurrency: 10 }
  ));

  // Worker event handlers
  workers.forEach(worker => {
    worker.on('completed', (job) => {
      logger.info('Job completed', { 
        queue: worker.queueName, 
        jobId: job.id 
      });
    });

    worker.on('failed', (job, err) => {
      logger.error('Job failed', { 
        queue: worker.queueName, 
        jobId: job?.id, 
        error: err.message 
      });
    });
  });

  return workers;
};

/**
 * Job helpers
 */
export const addCSVJob = async (filePath, userId, options = {}) => {
  return csvQueue.add('process-csv', 
    { filePath, userId }, 
    { 
      jobId: `csv-${userId}-${Date.now()}`,
      ...options 
    }
  );
};

export const addCloudinaryDeletionJob = async (publicIds, resourceType = 'image') => {
  return cloudinaryQueue.add('delete-cloudinary-files',
    { publicIds, resourceType },
    { 
      jobId: `cloudinary-${Date.now()}`,
      attempts: 3
    }
  );
};

export const addEmailJob = async (to, subject, template, data) => {
  return emailQueue.add('send-email',
    { to, subject, template, data },
    {
      priority: 1, // Higher priority for transactional emails
      attempts: 5
    }
  );
};

/**
 * Queue status checker
 */
export const getQueueStatus = async () => {
  const queues = [
    { name: 'CSV Processing', queue: csvQueue },
    { name: 'Cloudinary Deletion', queue: cloudinaryQueue },
    { name: 'Email Notifications', queue: emailQueue },
  ];

  const status = {};

  for (const { name, queue } of queues) {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);

      status[name] = { waiting, active, completed, failed };
    } catch (error) {
      status[name] = { error: error.message };
    }
  }

  return status;
};

export default {
  QUEUES,
  csvQueue,
  cloudinaryQueue,
  emailQueue,
  initWorkers,
  addCSVJob,
  addCloudinaryDeletionJob,
  addEmailJob,
  getQueueStatus,
};
```

### Step 3: Update CSV Upload Controller

**File: `db-project-backend/controllers/adminControls/UploadControllers.js`**

```javascript
import { addCSVJob } from '../../config/bullmq.js';

export const uploadCrimesCSV = async (req, res) => {
  let t;
  try {
    const filePath = req.file.path;
    const userId = req.user.id;

    // Instead of processing synchronously, queue the job
    const job = await addCSVJob(filePath, userId);

    // Return immediately with job ID for tracking
    return res.status(202).json({
      success: true,
      message: 'CSV upload queued for processing',
      jobId: job.id,
      status: 'pending',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error uploading CSV',
    });
  }
};
```

### Step 4: Update Crime Deletion for Background Jobs

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
import { addCloudinaryDeletionJob } from '../config/bullmq.js';

export const deleteCrime = async (req, res) => {
  let t;
  try {
    const { id } = req.params;

    t = await sequelize.transaction();

    // Get all media for this crime before deletion
    const mediaRows = await sequelize.query(
      `SELECT id, "publicId", "fileType" FROM "CrimeMedia" WHERE "CrimeId" = :crimeId;`,
      { replacements: { crimeId: id }, type: QueryTypes.SELECT, transaction: t }
    );

    // Extract publicIds for background deletion
    const imageIds = mediaRows
      .filter(m => m.fileType === 'image')
      .map(m => m.publicId);
    const videoIds = mediaRows
      .filter(m => m.fileType === 'video')
      .map(m => m.publicId);

    // Delete from database immediately
    if (mediaRows.length > 0) {
      await sequelize.query(
        `DELETE FROM "CrimeMedia" WHERE "CrimeId" = :crimeId;`,
        { replacements: { crimeId: id }, type: QueryTypes.DELETE, transaction: t }
      );
    }

    await sequelize.query(
      `UPDATE "Crime" SET status = 'deleted', "mediaCount" = 0, "thumbnailUrl" = NULL WHERE id = :id;`,
      { replacements: { id }, type: QueryTypes.UPDATE, transaction: t }
    );

    await t.commit();

    // Queue Cloudinary deletions as background job
    if (imageIds.length > 0) {
      await addCloudinaryDeletionJob(imageIds, 'image');
    }
    if (videoIds.length > 0) {
      await addCloudinaryDeletionJob(videoIds, 'video');
    }

    return res.status(200).json({
      success: true,
      message: 'Crime deleted successfully',
      data: { id },
      backgroundJobs: [
        ...(imageIds.length ? [{ type: 'image_deletion', count: imageIds.length }] : []),
        ...(videoIds.length ? [{ type: 'video_deletion', count: videoIds.length }] : []),
      ],
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    
    console.error('Delete Crime Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting crime',
    });
  }
};
```

### Step 5: Create Job Status Endpoint

**File: `db-project-backend/controllers/jobController.js`**

```javascript
import { getQueueStatus } from '../config/bullmq.js';

export const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Get job from all queues
    const { csvQueue, cloudinaryQueue, emailQueue } = await import('../config/bullmq.js');
    
    let job = null;
    const queues = [csvQueue, cloudinaryQueue, emailQueue];
    
    for (const queue of queues) {
      try {
        job = await queue.getJob(jobId);
        if (job) break;
      } catch (e) {
        // Job not in this queue
      }
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    return res.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      },
    });
  } catch (error) {
    console.error('Job status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching job status',
    });
  }
};

export const getAllQueueStatus = async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({ success: true, queues: status });
  } catch (error) {
    console.error('Queue status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching queue status',
    });
  }
};
```

### Step 6: Create Worker Entry Point

**File: `db-project-backend/worker.js`**

```javascript
import { initWorkers } from './config/bullmq.js';
import { logger } from './config/logger.js';

logger.info('Starting BullMQ workers...');

const workers = initWorkers();

logger.info(`${workers.length} workers started`);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Closing workers...`);

  await Promise.all(
    workers.map(worker => worker.close())
  );

  logger.info('Workers closed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Step 7: Add Worker to Docker Compose

**File: `docker-compose.yml`**

```yaml
services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: crimelens-worker
    restart: unless-stopped
    command: node worker.js
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-network
```

### Step 8: Add Job Routes

**File: `db-project-backend/routes/jobRoutes.js`**

```javascript
import express from 'express';
import { getJobStatus, getAllQueueStatus } from '../controllers/jobController.js';
import { verifyToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

const adminOnly = [verifyToken, authorizeRoles('admin')];

// Get specific job status
router.get('/status/:jobId', adminOnly, getJobStatus);

// Get all queue status
router.get('/queues', adminOnly, getAllQueueStatus);

export default router;
```

### Step 9: Add Routes to Server

**File: `db-project-backend/server.js`**

```javascript
import jobRoutes from './routes/jobRoutes.js';

app.use('/api/jobs', jobRoutes);
```

## Testing

### Test CSV Processing Job

```bash
# Upload CSV and get job ID
curl -X POST http://localhost:5001/api/admin/upload-crimes \
  -H "Authorization: Bearer <token>" \
  -F "file=@test.csv"

# Response includes jobId
# Check job status
curl http://localhost:5001/api/jobs/status/<jobId>
```

### Test Cloudinary Deletion Job

```bash
# Delete a crime with media
curl -X DELETE http://localhost:5001/api/crimes/delete/1 \
  -H "Authorization: Bearer <token>"

# Response includes backgroundJobs array
```

### Test Worker Process

```bash
# Start worker independently
node db-project-backend/worker.js

# Or via Docker
docker-compose up worker
```

## Expected Results

- **CSV Upload**: Returns 202 with job ID instead of waiting for processing
- **Crime Deletion**: Returns immediately, media deleted in background
- **Job Tracking**: Can query job status and progress
- **Worker Process**: Processes jobs from Redis queue independently

## Success Criteria

- [ ] BullMQ queues created successfully
- [ ] Worker process starts without errors
- [ ] CSV processing moved to background
- [ ] Cloudinary deletions moved to background
- [ ] Job status endpoint functional
- [ ] Queue status monitoring working
- [ ] Failed jobs retry correctly
- [ ] Workers can be scaled independently

## Files Created/Modified

```
db-project-backend/
├── config/
│   └── bullmq.js (new)
├── worker.js (new)
├── controllers/
│   ├── jobController.js (new)
│   ├── adminControls/
│   │   └── UploadControllers.js (modified)
│   └── CrimeControllers.js (modified)
├── routes/
│   └── jobRoutes.js (new)
└── server.js (modified)

docker-compose.yml (modified - add worker)
```

## Background Job Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   API #1     │     │   API #2     │     │   API #3     │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                              │
                      ┌───────▼────────┐
                      │      Redis     │
                      │    Job Queue   │
                      └───────┬────────┘
                              │
                      ┌───────▼────────┐
                      │  BullMQ Worker │
                      │  (Background)   │
                      │                 │
                      │  ┌────────────┐ │
                      │  │ CSV Job    │ │
                      │  │ Cloudinary │ │
                      │  │ Email Job  │ │
                      │  └────────────┘ │
                      └─────────────────┘
```

## Dependencies

- Phase 3 Redis (required for job queue)
- Phase 7 Pino (worker logging)
- Phase 8 Prometheus (job metrics)

## Rollback Procedure

If background jobs fail:
1. Remove BullMQ logic from controllers
2. Process operations synchronously (original implementation)
3. Stop worker process

## Estimated Completion Time

- BullMQ setup: 2 hours
- Job processors: 2 hours
- Controller integration: 1 hour
- Worker process: 30 minutes
- Testing: 1 hour
- **Total: 6.5 hours**
