# Phase 12 — BullMQ Background Workers: Implementation Log

Branch: `feature/phase-12-bullmq-workers` · Date: 2026-09-17 · Plan: audit-rewritten before implementation (15 corrections, see plan.md).

## Implemented

- `config/queue.js` (new) — BullMQ on a dedicated **ioredis** connection
  (BullMQ cannot use the node-redis client). TWO connection flavors (drill
  finding): producers/metrics use `commandTimeout: 5000` so API code can
  never hang behind a Redis outage; the worker uses an unbounded connection
  (`maxRetriesPerRequest: null` — required for blocking worker commands).
  `QUEUES.CLOUDINARY_DELETION`, `defaultJobOptions` (3 attempts,
  exponential 2s backoff, bounded complete/fail retention),
  `enqueueMediaCleanup` (one batch job per resource type),
  `processMediaCleanupJob` (uses existing `deleteMultipleFiles`; missing
  files = success → idempotent), `getQueueDepthCounts`, `findJobById`,
  bounded shutdown helpers.
- `worker.js` (new) — separate worker process, deliberately DB-free (no
  Sequelize). Graceful SIGTERM/SIGINT shutdown: worker → queues →
  connections, bounded by force-exit timer. Verified: closes in ~6 ms.
- `deleteCrime` — the ONLY request-path change: after `t.commit()`,
  fire-and-forget `enqueueMediaCleanup(mediaRows)` with `.catch` logging.
  Response byte-identical; wrapper/transaction/404 untouched (closes the
  orphaned-Cloudinary-files gap the code itself documented).
- `routes/jobRoutes.js` + `controllers/jobController.js` (new) — admin-only
  (`verifyToken` + `authorizeRoles("admin")`) `GET /api/jobs/queues` and
  `GET /api/jobs/status/:jobId`; trimmed payloads (no job.data/stacktrace).
  Mounted at `/api/jobs` in `server.js`.
- `config/prometheus.js` — `crimelens_queue_depth{queue,state}` gauge read
  cross-process by the existing 30s updater (lazy-imports queue.js so
  non-queue paths don't boot an ioredis connection).
- `docker-compose.yml` — `worker` service: same `crimelens-api` image,
  `node worker.js`, internal-only, redis-health-gated, ping-based
  healthcheck (no HTTP server to probe).
- Compose Redis: `--maxmemory-policy noeviction` (was `allkeys-lru`).
  BullMQ warns that LRU can evict job data; cache/limiter keys all carry
  TTLs and are failure-resilient by design, so noeviction is the correct
  shared policy.

## Latent defects found by failure drills and fixed (beyond plan)

1. **node-redis `isOpen` guard hangs during reconnects (phase-3 latent).**
   With Redis down, `isOpen` stays true through reconnect cycles, so
   `cacheService.get` queued commands behind the 5s-capped backoff and
   cached endpoints timed out. Fixed: guard on `isReady` (false while
   reconnecting) → instant DB fallback. Drill: 8s-timeout → 200 in ~2s
   worst case.
2. **Rate limiter consume hung ~5s then failed open (phase-4 latent).**
   `limiter.consume` awaits the same reconnecting client. Fixed: 1s
   timeout race → store slowness behaves like store failure (existing
   fail-open path). Drill: 5.4s → 1.2s.
3. **Producer enqueue hung unbounded** (ioredis offline queue) — fixed by
   the `commandTimeout` producer connection (drill: rejects bounded).

All three are cache/limiter/queue infrastructure fixes; no business logic.

## Deviations from plan

- Rate-limiter timeout race added (not in plan) — drill-justified, above.
- Compose Redis policy change (not in plan file list) — BullMQ warning
  forced the decision; documented inline in compose.
- `deleteMultipleFiles`' `deleted` is a map (id → status), so the job
  return value reports the raw map; the helper's "Deleted N files" message
  has always counted it wrong — pre-existing cosmetic quirk, left alone
  (not this phase's scope).

## Validation (all actually executed)

```text
node --check (queue, worker, jobController, jobRoutes, CrimeControllers,
  prometheus, server, cacheService, rateLimiterMiddleware):        PASS
compose build + up:            PASS — 7/7 containers (worker included)
Worker boot:                   PASS — claims cloudinary-deletion, conc 2
Job lifecycle (fake ids):      PASS — enqueued → processed → completed;
                               Cloudinary not-found treated as success
Retry / failure path:          PASS — forced failure consumed 3 attempts,
                               landed failed=1, backoff visible in logs
Idempotency:                   PASS — reprocessing missing ids succeeds
Queue depth gauge:             PASS — crimelens_queue_depth on /metrics,
                               cross-process (completed=2 seen via API)
Admin gates:                   PASS — /api/jobs/* → 401 no token,
                               403 bogus token
Redis-down drill:              PASS — health 200; types 200 (~2.1s worst,
                               was timeout); zones 200 (1.2s, fail-open);
                               enqueue rejects bounded; recovery 200;
                               limiter headers intact after recovery
Worker graceful shutdown:      PASS — SIGTERM → "Workers closed" (~6 ms),
                               restart healthy
Eviction-policy warning:       RESOLVED — noeviction; warnings gone
Regression (headers/behavior): PASS — X-Cache, X-Frame-Options,
                               X-Request-ID, compression (gzip on real
                               payload), health 200, unauth write 401
Host-run dev workflow:         unchanged — worker optional; without it the
                               system behaves as before (cleanup pending
                               until a worker runs)
deleteCrime live response:     NOT EXECUTED with real credentials (no test
                               accounts) — response block code-inspected
                               byte-identical; enqueue path verified via
                               direct job adds
Playwright:                    NOT EXECUTED — no user-visible change
ESLint:                        NOT EXECUTED — no repo config (unchanged)
```

## Files

```
db-project-backend/config/queue.js                 (new)
db-project-backend/worker.js                       (new)
db-project-backend/routes/jobRoutes.js             (new)
db-project-backend/controllers/jobController.js    (new)
db-project-backend/controllers/CrimeControllers.js (edit — enqueue after commit)
db-project-backend/server.js                       (edit — /api/jobs mount)
db-project-backend/config/prometheus.js            (edit — queue gauge)
db-project-backend/services/cacheService.js        (fix — isReady guards)
db-project-backend/middleware/rateLimiterMiddleware.js (fix — 1s store race)
db-project-backend/package.json + package-lock.json (bullmq, ioredis)
docker-compose.yml                                 (worker service; noeviction)
```
