# Phase 4 — Redis-backed Rate Limiting: Implementation Log

## Status: Implemented & Validated

## What Was Implemented

### New files

- `db-project-backend/config/rateLimiter.js` — limiter configuration:
  `RateLimitConfig` tiers (`AUTH` 5/60s block 300s, `WRITE` 10/60s block 180s,
  `READ` 100/60s block 30s, `SENSITIVE` 3/3600s block 3600s, `PUBLIC`
  50/60s block 60s) and pre-configured limiters (`authLogin`, `citizenAuth`,
  `crimeReport`, `writeAction`, `adminUpload`, `mediaUpload`, `publicAPI`).
  Each limiter is a `RateLimiterRedis` instance (keyPrefix
  `crimelens:rl:<name>`) with a same-config `RateLimiterMemory`
  `insuranceLimiter`, `useRedisPackage: true`, plus IP whitelist
  (`RATE_LIMIT_WHITELIST_IPS`, default empty), `isRateLimitEnabled()`
  (`RATE_LIMIT_ENABLED !== "false"`) and `getRateLimiterStatus()` for
  diagnostics.
- `db-project-backend/middleware/rateLimiterMiddleware.js` —
  `applyRateLimit(limiterType)` Express factory: kill switch → whitelist
  bypass → `consume()` keyed `user:<id>` (authenticated) else `ip:<addr>`
  (`::ffff:` normalized) → `X-RateLimit-Limit/Remaining/Reset` headers →
  429 with `Retry-After` and body `{ success, error, message, code:
  "RATE_LIMIT_EXCEEDED", retryAfter }` (matches `utils/apiResponse.js` error
  shape). Non-`RateLimiterRes` rejections fail OPEN with a server-side log.
- `tests/k6/scenarios/rate-limit-test.js` — standalone k6 scenario (8
  iterations, 1 VU) against `/api/auth/login`: expects 401s until the AUTH
  bucket is exhausted, then 429s with `Retry-After`.

### Endpoints protected (all wired after auth middleware where auth exists)

| Route | Limiter |
|---|---|
| `POST /api/auth/login` | `authLogin` (AUTH) |
| `POST /api/citizens/register`, `/login`, `/google-auth` | `citizenAuth` (AUTH) |
| `POST /api/user/report-crime` | `crimeReport` (WRITE, per citizen) |
| `PUT /api/crimes/update/:id`, `DELETE /api/crimes/delete/:id` | `writeAction` (WRITE, per police user) |
| `POST /api/admin/upload-crimes` | `adminUpload` (SENSITIVE) |
| `POST /api/media/upload` | `mediaUpload` (WRITE, per citizen, before multer parsing) |
| `GET /api/crimes/` (map), `GET /api/crimes/types` | `publicAPI` (PUBLIC) |
| `GET /api/stats/*` (4 endpoints) | `publicAPI` (PUBLIC) |
| `GET /api/zones/`, `/severity`, `POST /api/zones/:id/contains` | `publicAPI` (PUBLIC) |
| `POST /api/agent/request` | `citizenAuth` (AUTH; unauthenticated public write) |

### Other changes

- `controllers/healthController.js` — `/api/health` now reports
  `rateLimiting: { enabled, mode }` (`mode` = `redis` or `memory-fallback`).
  Additive field; no existing fields changed.
- `config/envValidation.js` — `RATE_LIMIT_ENABLED`,
  `RATE_LIMIT_WHITELIST_IPS` added to optional vars.
- `.env-sample` — both vars documented.
- `package.json` — `rate-limiter-flexible@11.2.0` dependency added.

## Key Implementation Decisions / Deviations from Plan

1. **`useRedisPackage: true` is mandatory** (not in the plan snippet):
   with node-redis v4+ (we run v6), rate-limiter-flexible cannot execute
   commands on the client without it, and every consume **silently** runs on
   the in-memory insurance limiter — limits would appear to work but never be
   distributed. Found via live smoke test (Redis `KEYS` empty while
   consuming); fixed and re-verified (keys present, TTL correct).
2. **Insurance limiter instead of boot-time memory/Redis pick.** The plan's
   `createRateLimiter` chooses the store once at module load, before Redis
   connects (routes import at boot) — everything would permanently run in
   memory. Instead every limiter is Redis-backed with an in-memory insurance
   limiter (rate-limiter-flexible native support): Redis up = distributed,
   Redis down = per-instance enforcement, recovery automatic. This satisfies
   the plan's "graceful fallback to memory" success criterion without the
   boot-order trap. CLAUDE.md "no silent process-local fallback" is honored:
   the fallback is explicit, documented, and observable via `/api/health`
   `mode`.
3. **Fixed-window + blockDuration** (rate-limiter-flexible default) rather
   than the plan's "sliding window" label. Same brute-force protection
   profile; plan-mandated library provides no true sliding-window log.
4. **Whitelist defaults to EMPTY** — the plan hardcoded `127.0.0.1, ::1`,
   which would make local 429 testing impossible and let same-host traffic
   bypass limits in production. Configurable via `RATE_LIMIT_WHITELIST_IPS`.
5. **Plan bugs fixed during implementation**: success-path header used an
   undefined `msBeforeReset` (uses `result.msBeforeNext`); 429 header used
   `rejRes.totalHits` for the "Limit" header (uses the limiter's `points`);
   whitelisted header value `∞` is a non-ASCII invalid header value (uses
   `unlimited`); plan referenced a nonexistent `'write'` limiter key and a
   `mediaRoutes.js` upload shape matching this codebase (both reconciled).
6. **Route paths differ from plan sketches**: actual write routes are
   `/api/user/report-crime|approve|reject` (`userRoutes.js`), not the plan's
   `/api/crimes/report` etc. Rate limiting applied to the real routes.
7. **Scope additions over the plan's route list** (rationale: CLAUDE.md
   "protect abuse-sensitive endpoints"): `POST /api/agent/request`
   (unauthenticated public write) and zones endpoints (public API family,
   consistent with map/stats protection).
8. **Police `approve/reject/pending` deliberately NOT limited**: WRITE
   (10/60s per officer) could block legitimate queue-processing bursts of a
   verification session. Revisit in Phase 5 with a tuned tier.
9. **`mediaUpload` placed after `authorizeCitizen` but before multer** so
   abusive authenticated users are rejected before file parsing costs; the
   plan sketch placed it before auth (would rate-limit by IP and still parse
   uploads).
10. **`getCitizen` user-keyed buckets**: limiters placed after auth on
    protected routes key by `req.user.id` (JWT `{id}` or Supabase `{id}` —
    both verified in `authMiddleware.js`); unauthenticated routes key by IP.
11. **Health check**: plan's `detailedHealth` doesn't exist; status added to
    the existing `/api/health` (`processHealth`) as cheap diagnostic metadata,
    not to `/ready` (limiting degradation is not a readiness failure).

## Validation Performed (Implementation Agent)

- `node --check` on all 13 created/modified files: PASS
- Live compatibility smoke (rate-limiter-flexible 11.2.0 + node-redis v6 +
  Redis 5.0.14): consume/block/TTL/keys: PASS (after `useRedisPackage` fix)
- Harness boot of the REAL config + middleware modules over real
  Express + Redis (`/api/health`-style status exposed):
  - PUBLIC tier: exactly 50 allowed, then 429; headers `limit=50`,
    remaining decreasing, `Retry-After`, body `RATE_LIMIT_EXCEEDED` +
    `retryAfter`: PASS (7/7 checks)
  - AUTH tier: 5 allowed, then 429 with `retry-after=300`: PASS
  - Keys persist in Redis with correct TTLs (`crimelens:rl:*`): PASS
  - **Two instances (5090/5091) share state**: 5 consumes on instance A,
    instance B's first-ever request 429 with full 300s window: PASS
  - Whitelist (`RATE_LIMIT_WHITELIST_IPS="::1,127.0.0.1"`): 60/60 allowed,
    `remaining=unlimited` on every response: PASS
  - `RATE_LIMIT_ENABLED=false`: 60/60 allowed, NO X-RateLimit headers,
    health reports `enabled:false`: PASS
  - **Redis outage** (`CLIENT KILL` burst): limiting still enforced via
    insurance limiter (50 ok / 2 blocked), then automatic recovery —
    `mode` back to `redis`, keys re-created: PASS
- Real backend (:5001, user-run) end-to-end regression:
  - `/api/stats/summary`: 200 with BOTH `X-RateLimit-*` and Phase 3
    `X-Cache` MISS→HIT; payload byte-identical MISS vs HIT: PASS
  - `/api/crimes/` map 200, `/api/crimes/types` 200: PASS
  - Unauthenticated 401s preserved on `/api/crimes/all`,
    `/api/user/report-crime`, `/api/crimes/update/:id`,
    `/api/media/upload`: PASS
  - Real-route AUTH flood: allowed requests until bucket exhausted, then
    429 `Retry-After: 300` on `/api/auth/login`: PASS
  - Bad-credential login reaches controller (400) with headers: PASS

## Not Executed (with reason)

- ESLint: no ESLint config exists in the backend (pre-existing gap).
- TypeScript: backend is plain JS; frontend untouched.
- k6 execution: k6 binary not run this cycle; the committed
  `tests/k6/scenarios/rate-limit-test.js` encodes the same checks verified
  via scripted HTTP (thresholds, headers, 429 body).
- Playwright: backend-only change, no frontend code touched; cached
  endpoints' payloads verified byte-identical; 429 body keeps the standard
  error shape the frontend's existing axios error handling already renders.
- Multi-instance test on the REAL app (vs harness): login flood would lock
  the shared dev IP out for 5 minutes; harness instances boot the real
  limiter modules, which is the unit under test.

## Notes for Testing Agent

- After a flood test, the source IP stays blocked for `blockDuration`
  (AUTH = 300s). Flush `crimelens:rl:*` keys between suites. NOTE: the
  Windows redis-cli 5.0.14 `--scan` produced no output in this environment —
  delete keys explicitly (`KEYS`/`DEL`).
- node clients may resolve `localhost` to `::1`; keys appear as
  `ip:::1` (e.g. `crimelens:rl:auth:ip:::1`). Whitelist entries should
  include `::1` and/or `127.0.0.1`.
- One `package.json` change (`start`: nodemon → `node`) predates this phase
  (uncommitted working-tree change by the user, carried into this branch);
  it is committed together with the dependency addition because
  `package.json` must ship the new dependency.
