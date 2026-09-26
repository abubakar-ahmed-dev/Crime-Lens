# Phase 12 — BullMQ Background Workers: Testing Log

Testing record · 2026-09-17 · Live execution against the compose stack
(backend replicas on 15001-15003, worker internal).

## Job lifecycle

- Test: enqueue two fake-publicId cleanup jobs (image + video) inside the
  backend container → observe worker.
- Result: PASS — both claimed immediately, processed (batch Cloudinary
  destroy reports not-found for the fake ids → success), completed events
  logged, return values recorded.
- Idempotency: re-running against missing files completes cleanly. PASS.

## Retry and failure state

- Test: enqueue a job with an invalid `resourceType` that forces Cloudinary
  errors.
- Result: PASS — 3 attempts consumed with exponential backoff visible in
  worker logs, final state `failed` (queue counts: completed 2 / failed 1).

## Admin job API

- Tests: `GET /api/jobs/queues` and `/api/jobs/status/:jobId` with no
  token, bogus token.
- Result: PASS — 401 (no token), 403 (invalid token). Trimmed payloads
  verified by code inspection (no job.data / stacktrace).

## Metrics

- Test: `crimelens_queue_depth` on the API `/metrics` after jobs ran.
- Result: PASS — cross-process visibility confirmed (worker processed 2,
  API metrics showed completed=2).

## Redis outage drill

- Result: FAIL → PASS (two latent defects found and fixed)
- Original behavior: `/api/crimes/types` TIMED OUT (>8 s) with Redis
  stopped; rate-limited routes served after ~5 s delays; direct queue
  enqueue hung indefinitely.
- Root causes:
  1. node-redis stays `isOpen` during reconnect cycles, so the cache-aside
     guard queued commands behind reconnect backoff (phase-3 latent).
  2. rate-limiter-flexible `consume()` awaited the same client (phase-4
     latent) before falling open.
  3. ioredis offline queue made producer enqueues wait forever.
- Fixes: `isReady` guards in cacheService; 1 s timeout race around limiter
  consume (reuses existing fail-open); `commandTimeout` producer
  connection.
- Retest: health 200; types 200 in ~2.1 s worst; zones 200 in 1.2 s;
  enqueue rejects bounded (~5 s max); after Redis recovery all 200 with
  limiter headers intact.
- Status: Fixed and verified. Worker reports unhealthy during outages by
  design (healthcheck pings Redis) and recovers automatically.

## Eviction policy

- Result: FAIL → PASS
- Problem: BullMQ warns the compose Redis `allkeys-lru` policy can evict
  job data.
- Fix: `noeviction` (cache/limiter keys are TTL'd and failure-resilient by
  design).
- Retest: warning gone; cache/rate-limit behavior unchanged.

## Graceful shutdown

- Test: `docker compose stop worker` (SIGTERM).
- Result: PASS — "SIGTERM received. Closing workers" → "Workers closed" in
  ~6 ms, no force-exit; restart healthy.

## Regression sweep

- Tests: X-Cache header, X-Frame-Options, X-Request-ID, gzip on a real
  payload, `/api/health`, unauthenticated write → 401, unauth jobs API →
  401/403.
- Result: PASS on all. (An initial compression check returned no
  Content-Encoding — the chosen endpoint returned a 2-byte empty payload;
  retest with real data confirmed gzip.)

## Not executed

- Live `deleteCrime` with real credentials (no test accounts): response
  block code-inspected byte-identical; enqueue path exercised via direct
  job adds. Follow-up when seeded accounts exist.
- Playwright: no user-visible change this phase.
- ESLint: no repo config.

## Final status

All executed tests PASS. One real gap closed (orphaned Cloudinary files on
crime deletion), three latent failure-mode defects fixed, worker ships in
compose and locally via `node worker.js`.
