# Phase 3 — Redis Caching: Implementation Log

## Status: Implemented & Validated

## What Was Implemented

### Redis infrastructure (new files)

- `db-project-backend/config/redis.js` — node-redis client singleton
  (`REDIS_URL`, default `redis://localhost:6379`), reconnect strategy
  (indefinite retry, capped 5 s backoff), `connectRedis()` (never fails
  startup), `disconnectRedis()` for graceful shutdown, `CacheKeys`
  registry, `CacheTTL` tiers (SHORT 300s / MEDIUM 600s / LONG 3600s).
- `db-project-backend/services/cacheService.js` — error-resilient cache-aside
  service: `get`/`set` (setEx + JSON)/`delete`/`deletePattern`/`isConnected`/
  `getMetrics`. Every operation is guarded by `redisClient.isOpen` and swallows
  errors; Redis failures can never propagate into the request path.
- `db-project-backend/middleware/cacheDecorator.js` — `withCache(options)(handler)`
  higher-order wrapper (cache-aside with `X-Cache: HIT|MISS` headers) and
  `withCacheInvalidation(patterns)(handler)` (pattern delete after 2xx writes).

### Cached endpoints

- Statistics (5 min TTL, query params in keys):
  `getStatsSummary`, `getCrimesByType`, `getCrimesByZone` in
  `controllers/statsController.js`.
- Crime trend (10 min TTL): `getCrimeTrend`.
- Reference data (1 h TTL, explicit cache-aside in controller):
  `getAllCrimeTypes` (`controllers/CrimeControllers.js`),
  `getAllZones` (`controllers/zoneController.js`).
  Zones caching extends the plan's Step 7 (crime types only) to fulfill the
  plan objective "reference data caching (crime types, zones)". Zones have no
  write endpoints, so TTL-only invalidation is correct for them.

### Cache invalidation on writes

`withCacheInvalidation(['crimelens:stats:*', 'crimelens:crimes:*'])` applied to
`approveCrimeReport`, `rejectCrimeReport`, `updateCrime`, `deleteCrime`;
`reportCrime` invalidates stats only — all in `controllers/CrimeControllers.js`.
Note: the actual write routes are `/api/user/report-crime|approve/:id|reject/:id`
(`routes/userRoutes.js`), not the `/api/crimes/*` paths sketched in the plan.

### Health check

`/api/ready` (`controllers/healthController.js`) now reports a real Redis check
(`ping()` when connected). Redis is reported but is **not** a readiness gate:
only the database decides 200 vs 503, because the API degrades gracefully to DB
queries when Redis is down. This intentionally differs from the plan's Step 8
snippet (which returns 503 when Redis is down) and follows CLAUDE.md §7 /
graceful-degradation principles. The Phase 2 `not_implemented` placeholder was
replaced; the Phase 2 DB check is unchanged.

### Server lifecycle

`server.js`: `connectRedis()` after DB auth (best-effort, never blocks startup);
`disconnectRedis()` added to the existing Phase 2 graceful-shutdown
`Promise.all`. The Phase 2 force-exit guard and shutdown structure were
preserved — the plan's Step 9 snippet was integrated into the existing code
rather than replacing it.

### Environment

- `REDIS_URL` added as an optional env var in `config/envValidation.js`
  (default warning logged) and `.env-sample` (local + Redis Cloud examples).
- `redis` dependency added to `db-project-backend/package.json`.

## Key Implementation Decisions / Deviations from Plan

1. **Decorator implementation**: the plan sketched legacy ES decorators
   (`(target, propertyKey, descriptor)`) but called them curried; as written
   they would crash. Implemented as higher-order functions with the same
   `withCache(options)(handler)` call syntax.
2. **RESP2 protocol**: client configured with `RESP: 2` for compatibility with
   Redis < 6.0 (e.g. the Windows Redis 5 build used for local validation),
   which lack the `HELLO` command. Works with all managed providers.
3. **`deletePattern` uses SCAN, not `KEYS`** (non-blocking). Under RESP2,
   `scanIterator` yields batches (arrays), so the code normalizes single keys
   (RESP3) and batches (RESP2) and deletes per batch. Found via live testing:
   the RESP2 empty-batch case crashed a naive `del(keys)` implementation.
4. **Invalidation is awaited**, not fire-and-forget: a request racing right
   behind a write must never observe a stale cached value. Failures are
   swallowed (they can never fail the write).
5. **Errors are never cached**: `withCache` only stores payloads when
   `res.statusCode < 400`; otherwise a transient DB error would be cached for
   the full TTL.
6. **Reconnect strategy retries indefinitely** with capped backoff
   (`min(retries*100ms, 5s)`) instead of the plan's give-up-after-10-retries.
   Discovered live: the plan's strategy permanently disabled the client after
   a >5.5 s Redis blip until API restart (dev server stuck at `redis: down`
   with Redis already back). Auto-recovery verified via `CLIENT KILL` test:
   connection dropped server-side, client reconnected and resumed PING.
   Related cosmetic fix: client errors log `err.code` (AggregateError has an
   empty `.message`).

## Validation Performed (Implementation Agent)

All against live backend + local Redis 5 (Windows portable build):

- `node --check` on all created/modified files: PASS
- Boot with Redis down: server starts, `/api/ready` 200, stats/types/zones
  serve fresh DB data, redis reported `down` — graceful degradation PASS
- Boot with Redis up: clean connect — PASS
- Connection-loss auto-recovery: `CLIENT KILL` drops the connection
  server-side; client reconnects automatically (indefinite capped-backoff
  strategy) and resumes PING — PASS
- `X-Cache` MISS→HIT on all six cached endpoints: PASS
- Distinct cache keys per query-param combination: PASS
- TTLs: stats 300 s, trend 600 s, reference 3600 s; expiry mechanism verified
  with a 5 s key: PASS
- `deletePattern`: RESP2 batch + empty-pattern cases verified against live
  Redis (defect found and fixed during testing): PASS
- `withCacheInvalidation`: 2xx invalidates (awaited); 500/401 responses never
  invalidate and errors are never cached: PASS
- `/api/ready`: redis `up` (ping ~1 ms) with DB as sole gate: PASS
- Hit rate: 50-request burst over 5 endpoints → ~82% (cumulative session
  ~73%); exceeds the >70% success criterion: PASS
- Regression: uncached endpoints (`/api/crimes` map query, paginated
  `/api/crimes/all`, `/api/crimes/get-crime/:id`) still 200/401 exactly as
  before; response bodies unchanged: PASS

Not run (with reasons): ESLint (no ESLint config exists in the backend),
TypeScript (backend is plain JS; frontend untouched), k6 full scenarios
(optional for this phase; hit-rate measured with scripted curl traffic
instead), Playwright (no frontend or API-contract change).

## Follow-ups / Notes for Testing Agent

- A police-authenticated approve→invalidation round-trip through HTTP was not
  exercised (no test credentials available; shared Supabase DB must not be
  mutated). The decorator/service layer is covered by the live harness above;
  Testing Agent may complete the HTTP-level path if credentials exist.
- Invalidating `crimelens:stats:*` on `reportCrime` is technically redundant
  (stats only aggregate approved crimes) but matches the plan and is harmless.
- Reference keys (`crimelens:reference:*`) are intentionally NOT invalidated
  by crime-write patterns; TTL-only.
