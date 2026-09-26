# Phase 12: BullMQ Background Workers

## Objective

Move Cloudinary media cleanup off the request path into a BullMQ queue
processed by a dedicated worker container — closing a real, existing gap
(`deleteCrime` deletes `CrimeMedia` rows today and leaves the Cloudinary
files orphaned; the code itself carries a TODO saying this should be a
background job). Queue infrastructure, retries, graceful shutdown, admin
status endpoints, and a cross-process queue-depth gauge. No API response
contract changes.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **BullMQ cannot use the project's node-redis client.** The plan passed
   `connection: redisClient` (node-redis v6) — BullMQ is built on **ioredis**
   and will not work with it. Correct: add `ioredis`, create a dedicated
   connection from `REDIS_URL` with `maxRetriesPerRequest: null` (required
   for Workers).
2. **The plan's `connection` export was incoherent** — `{ host, port,
   connection: redisClient }` nests a client inside connection options.
   Replaced by one ioredis instance (or URL) shared by queues/workers in a
   process.
3. **Email queue dropped entirely** — no email service exists in the app;
   the plan's processor "simulates" sending with a sleep. CLAUDE.md:
   no background jobs for resume value. If email ever lands, so does its
   queue.
4. **CSV async moved to an explicit follow-up, not this phase.** The current
   upload returns `stats {total, inserted, duplicates, invalid}` which the
   admin UI displays; switching to 202+jobId breaks that contract and
   requires frontend work (out of scope for a backend phase). Worse: the
   plan's CSV processor was a stub (`const rows = []; // Add CSV parsing
   logic here`) — rerouting real traffic into it would silently drop
   uploads. This phase ships the queue infrastructure the CSV follow-up
   will reuse.
5. **The real gap is Cloudinary deletion** — `deleteCrime` already deletes
   media rows and comments "Cloudinary file deletion should be handled via
   a background job". That is the honest, zero-contract-change candidate.
6. **The plan's `deleteCrime` rewrite dropped the `withCacheInvalidation`
   wrapper and restructured the 404 path.** Rewrite preserves the existing
   handler wrapper, transaction, rollback, and 404 flow exactly; the only
   change is enqueueing cleanup after commit.
7. **Use the existing `deleteMultipleFiles` batch API** (single `uploader.destroy`
   call with an array) instead of the plan's per-file loop.
8. **Response stays byte-identical** — no `backgroundJobs` field added.
   Phase-11's less_conn still applies: minimal, focused changes.
9. **`console.error` re-introduced by plan snippets** — phase 7 removed
   every console.* from the backend; all worker/queue code logs via pino.
10. **Plan's `worker.js` leaked connections on shutdown** — closes workers
    but never the queue connections. Correct shutdown: `worker.close()`
    for each, then `queue.close()` + ioredis `quit()`, bounded by a
    force-exit timer (same pattern as server.js).
11. **Worker stays DB-free.** Cloudinary deletion needs no Sequelize — the
    worker imports no models, adds zero DB pool pressure (phase-11 budget
    untouched). The plan's worker only needed DB because of the (dropped)
    CSV stub.
12. **Compose worker service corrected** — no `env_file: .env` (root file
    doesn't exist), no duplicated secret literals, no `container_name`;
    mirrors the backend service (`env_file: db-project-backend/.env` +
    in-compose `REDIS_URL` override), reuses the `crimelens-api` image
    (same build; only the command differs) so no new Dockerfile.
13. **Metrics: the plan ignored process boundaries.** Counters incremented
    inside the worker are invisible to the API process's `/metrics`
    register. Instead: queue-depth gauge (`waiting`/`active`/`completed`/
    `failed` per queue) read cross-process by the API's existing 30s
    updater via BullMQ's count APIs; the worker logs outcomes structurally.
14. **Job-status endpoint trims exposure** — admin-only (as planned) but
    returns id/name/queue/progress/attempts/failedReason/returnvalue/
    timestamps; NOT raw `job.data` or stacktrace.
15. **Idempotency noted where it belongs**: deletion jobs are naturally
    idempotent (Cloudinary `destroy` on an already-deleted id returns ok/
    not-found — treated as success), so retries are safe.

## Scope boundary

- CSV async processing: follow-up phase; will reuse this phase's queue
  config + worker + status endpoints; requires frontend work for the
  202/jobId flow.
- Emails: none exist; no queue.
- Frontend: unchanged (response contracts untouched).

## Implementation Steps

### Step 1: Dependencies

```bash
cd db-project-backend && npm install bullmq ioredis
```

### Step 2: `db-project-backend/config/queue.js` (new; plan's `bullmq.js` renamed)

- ioredis connection from `REDIS_URL` (`maxRetriesPerRequest: null`)
- `QUEUES = { CLOUDINARY_DELETION: 'cloudinary-deletion' }` (+ extension
  point comment for the CSV follow-up)
- `defaultJobOptions`: attempts 3, exponential backoff 2s,
  `removeOnComplete { count: 100, age: 24h }`, `removeOnFail { count: 500 }`
- Queue + worker factories; `initCloudinaryWorker()` with completed/failed/
  error event logging (pino); `getQueueDepthCounts()` for the metrics gauge
- `enqueueMediaCleanup(mediaRows)` helper: splits image/video publicIds,
  adds one job per resource type (empty lists add nothing)

### Step 3: `deleteCrime` integration (only change)

After `t.commit()` and before the response:

```javascript
// Fire-and-forget: never fail the response because cleanup enqueueing failed
enqueueMediaCleanup(mediaRows).catch((err) =>
  req.log.error({ err }, "Failed to enqueue media cleanup")
);
```

Everything else (wrapper, transaction, 404, response shape) untouched.

### Step 4: `db-project-backend/worker.js` (new)

- Initializes the Cloudinary worker only (no DB, no express)
- Graceful shutdown: bounded (`SHUTDOWN_TIMEOUT_MS`) close of worker →
  queue → ioredis, mirroring server.js's force-exit pattern
- pino logging only; `NODE_ENV`-aware log level

### Step 5: Admin job/queue status API

- `routes/jobRoutes.js`: `GET /api/jobs/queues` (all queue counts),
  `GET /api/jobs/status/:jobId` (searches this phase's queues)
- Auth: `verifyToken` + `authorizeRoles("admin")` (names verified against
  `middleware/authMiddleware.js`)
- Mount in `server.js` with the other API routers

### Step 6: Metrics (cross-process-safe)

- `config/prometheus.js`: `crimelens_queue_depth` gauge
  (labels: queue, state) refreshed by the existing 30s updater via
  `getQueueDepthCounts()`; failure-safe like the other updaters

### Step 7: Compose worker service

```yaml
worker:
  image reuse of crimelens-api (same build), command: node worker.js
  env_file: db-project-backend/.env + REDIS_URL/LOG_LEVEL/NODE_ENV overrides
  depends_on: redis healthy
  internal network only (no host port)
```

### Step 8: Validation

```bash
node --check all touched files
docker compose build backend && docker compose up -d          # worker included
# unit-ish: enqueue a fake publicId job → worker claims it, completes,
# job removable via admin endpoint
# integration: create crime with media (or craft rows), delete via API,
# observe job processed; queue depth gauge moves on /metrics
# failure path: job for bogus-but-valid-format ids → Cloudinary 'not found'
# treated as success; forced-throw path → retry with backoff then DLQ-ish
# failed state visible in /api/jobs/queues
# redis-down drill: enqueue fails gracefully (response unchanged), worker
# retries connection with capped backoff (phase-3 pattern)
# regression: deleteCrime response identical (curl before/after diff),
# cache invalidation headers/behavior unchanged, admin endpoints 401/403
# for non-admin roles
# Playwright: not required (no user-visible change) — smoke only if time
```

## Out of Scope

- CSV async processing (follow-up; needs frontend contract work)
- Email queue (no email service exists)
- Bull Board / UI dashboards (admin API endpoints suffice for now)
- Multi-worker scaling config (compose `--scale worker=N` works when needed)

## Success Criteria

- [ ] Deleting a crime with media enqueues cleanup; worker deletes the
      Cloudinary files (verified via job completion + logs)
- [ ] `deleteCrime` response byte-identical to today (no new fields)
- [ ] Failed deletions retry (3 attempts, exponential backoff) and land in
      failed state visible via `/api/jobs/queues`
- [ ] Idempotent: rerunning deletion on missing files completes cleanly
- [ ] Worker shuts down gracefully (bounded) with no dangling Redis conns
- [ ] Redis down: API responses unaffected (enqueue best-effort + logged)
- [ ] Queue depth gauge appears on `/metrics`; admin status endpoints work
      (401/403 for non-admins)
- [ ] Host-run dev workflow unchanged (worker optional locally; without it
      behavior matches today's — cleanup pending until a worker runs)

## Files Created/Modified

```
db-project-backend/config/queue.js                    (new)
db-project-backend/worker.js                          (new)
db-project-backend/controllers/CrimeControllers.js    (edit — enqueue after commit)
db-project-backend/routes/jobRoutes.js                (new)
db-project-backend/controllers/jobController.js       (new)
db-project-backend/server.js                          (edit — mount /api/jobs)
db-project-backend/config/prometheus.js               (edit — queue gauge)
db-project-backend/package.json + lock                (bullmq, ioredis)
docker-compose.yml                                    (edit — worker service)
```

## Rollback

Remove worker compose service, revert the `deleteCrime` enqueue lines and
the `/api/jobs` mount, uninstall bullmq/ioredis. Deletion behavior reverts
to today's (no cleanup) — no data or contract risk.

## Estimated Completion Time

- Queue config + worker + shutdown: 1.5 h
- deleteCrime integration + status API + gauge: 1 h
- Compose + live validation incl. failure drills: 1.5 h
- **Total: ~4 h**
