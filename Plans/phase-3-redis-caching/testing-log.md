# Phase 3: Redis Caching — Testing Log

## Independent Re-Verification — 2026-08-31 (Testing Agent)

Independent re-test of the Phase 3 Redis caching implementation on branch
`refactor/redis-caching`, HEAD `fc7a29b`. Working tree clean for all tracked
files (only the pre-existing `.claude/worktrees/homepage-redesign` worktree
entry). No implementation code was modified at any point; all test artifacts
live in a temp directory outside the repo. Environment: Windows 10, live
backend on :5001 (supplied by the user; restarted itself once mid-session —
fresh state re-verified after), isolated test instances on :5099, Redis 5.0.14
portable build on localhost:6379, shared Supabase PostgreSQL (read-only
traffic only — no DB mutations; the HTTP-level approve/reject round trip was
tested at the decorator level instead, per the agreed scope). k6 was excluded
per user instruction.

## 1. Diff Review (commit fc7a29b)

Reviewed the full phase diff (14 files, +710/−26) against `plan.md`.

- Conforms to plan Steps 1–10. Documented deviations (HOFs instead of legacy
  decorators, RESP 2, SCAN-based `deletePattern`, non-gating Redis in
  `/ready`) are all justified in the implementation log and verified correct
  in code.
- Claim verification against code: (a) invalidation awaited — TRUE;
  (b) errors never cached (`statusCode < 400` guard) — TRUE; (c) RESP 2 —
  TRUE; (d) `deletePattern` SCAN with RESP2 batch normalization — TRUE;
  (e) Redis down does not gate `/ready` — TRUE.
- Route audit: cached endpoints are all public GETs (4× `/api/stats/*`,
  `/api/crimes/types`, `/api/zones/`); invalidation is attached to
  `reportCrime` (stats only), `approve/reject/update/deleteCrime`
  (stats+crimes). `reportCrime` not invalidating `crimelens:crimes:*` is
  currently harmless: no crime-read keys exist under that namespace yet.
- No secrets, no debug artifacts, no unrelated changes in the diff.

## 2. Static / Syntax

```text
node --check (9 files)                          PASS
  config/redis.js                               PASS
  services/cacheService.js                      PASS
  middleware/cacheDecorator.js                  PASS
  controllers/statsController.js                PASS
  controllers/CrimeControllers.js               PASS
  controllers/zoneController.js                 PASS
  controllers/healthController.js               PASS
  server.js                                     PASS
  config/envValidation.js                       PASS
ESLint                                          N/A (no backend ESLint config exists)
TypeScript                                      N/A (backend is plain JS)
Build                                           N/A (no build step; start = nodemon)
```

## 3. Live Endpoint Tests — 54 checks against :5001

Scripted read-only HTTP suite (fetch + direct Redis client for key/TTL
verification). All six cached endpoints exercised after explicit key clear.

```text
MISS→HIT cycle, HIT body == MISS body, 200 status (6 endpoints × 4)   PASS (24)
TTL values: stats 300s, trend 600s, types/zones 3600s                 PASS (6)
Distinct keys per query-param combo (by-type date-range, trend id)    PASS (6)
401 writes (report/approve/update/delete) preserve cache + stay HIT   PASS (10)
Regression: /api/crimes map, /api/crimes/all 401, /zones/severity
           uncached, no X-Cache header, bodies unchanged              PASS (4)
/api/health 200 healthy; /api/ready 200, db up, redis up              PASS (4)
RESULT: 54/54 PASS
```

## 4. Decorator/Service Harness — 27 checks (real modules, live Redis)

Temp-dir harness imports the actual `withCache` / `withCacheInvalidation` /
`cacheService` modules and drives them with mock req/res (covers error paths
not reachable over HTTP without police credentials).

```text
500 responses never cached; retry not poisoned                        PASS (4)
200 cached once; HIT bypasses handler (handler call count = 1)        PASS (4)
Disconnected client → passthrough, no X-Cache, nothing cached         PASS (4)
2xx invalidation deletes stats+crimes patterns (awaited, verified
     synchronously after wrapper returns); payload preserved          PASS (5)
401/500 writes do NOT invalidate                                      PASS (3)
deletePattern: 250 keys across SCAN batches → 0 remain;
     no-match and empty result sets → false, no crash                 PASS (4)
Real TTL expiry (3s key)                                              PASS (2)
Corrupt cached JSON → get() returns null, never throws                PASS (1)
RESULT: 27/27 PASS
```

## 5. Cache Hit Rate

Measured from Redis server `keyspace_hits`/`keyspace_misses` deltas (not
self-reported) during a 120-request mixed burst across all six endpoints:
114 hits / 6 misses.

```text
Hit rate: 95.0%   (plan criterion: >70%)     PASS
```

Note: the 6 misses are the initial cold keys; unrecognized query params
correctly do not create new keys (key generators whitelist known params).

## 6. Redis Failure Behavior

- **Transient connection loss (52 connection kills over 8s):** node-redis
  reconnects sub-second; `x-cache` HITs continued throughout; `/ready` stayed
  200/`redis:up`. No observable degradation window at 400ms polling
  resolution.
- **Short outage (2s process stop, within the ~5.5s 10-retry window):**
  auto-recovery YES — `redis:up` within 0.2s of Redis returning, cache
  resumes (MISS→HIT).
- **Long outage (> ~5.5s retry window):** server boots/keeps serving
  correctly from DB (all endpoints 200, no X-Cache header, `/ready` 200 with
  `redis:down`) — graceful degradation per plan criteria confirmed for both
  boot-time and runtime loss.

### Discovered issue: no cache recovery after retry-window exhaustion

- Result: **FAIL** (operational defect, not a plan-criteria failure)
- Problem: after ~5.5s of continuous unavailability the client's
  `reconnectStrategy` gives up permanently (returns `Error` after 10 retries).
  `isOpen` stays `false` forever, so caching never resumes — even hours later
  with Redis healthy — until the API process restarts. Verified twice
  (30s+ polling with Redis healthy while backend reported `redis:down`).
  First test on :5001 after a full process kill; reproduced on :5099.
- Impact: API correctness unaffected (DB serving, 100% availability
  maintained); impact is loss of caching benefit until restart. The plan's
  success criteria (graceful degradation) are met, but CLAUDE.md §13
  ("Connect → Cache test → Failure test → Recovery test") expects recovery.
- Affected area: `config/redis.js` reconnect strategy / lack of re-connect
  path after terminal failure.
- Status: sent to Debugging Agent. Suggested direction (for the implementer
  to evaluate): unbounded/long-cap reconnect strategy, or an `isOpen`-false
  recovery hook (e.g. `redisClient.connect()` re-attempt from the error
  handler with backoff).
- Minor observation: while Redis is hard-down, `/api/ready` takes up to
  ~2.5s (ping socket timeout) before reporting `redis:down` — acceptable but
  worth knowing for load-balancer timeout tuning in later phases.

## 7. Pre-Existing Conditions

- No backend ESLint config, test runner, or build step exist in the repo
  (pre-existing; flagged by the implementation agent as well).
- `.env` has no `REDIS_URL` — client correctly falls back to
  `redis://localhost:6379`; `envValidation` logs the default in use.
- Test-script quirks corrected during the session (all in test code, not
  app code): a tautological harness check was replaced with a real
  verification and re-run (27/27 after fix); a kill-storm summary line
  mislabeled 14 polls as "non-200" (it compared a JSON field, not the HTTP
  status — timeline shows all polls 200); the first short-outage recovery
  attempt was invalid (instance already in gave-up state) and was redone
  against a freshly-booted instance.

## 8. Not Executed (with reason)

- k6 load scenarios: excluded per user instruction for this cycle.
- Playwright browser regression: no frontend or API-contract change (response
  bodies byte-identical MISS vs HIT verified); cached endpoints' consumers
  (statistics page) were covered indirectly by identical-payload checks.
- HTTP-level approve/reject/report round trip: requires police credentials
  (none exist in `tests/k6/.k6.env`) and would mutate the shared Supabase DB;
  covered at the decorator level instead (Section 4), per the agreed scope.
- Formal unit tests: no test framework installed; the harness in Section 4
  serves as the integration-level substitute.

## Final Testing Status — Phase 3

All plan success criteria verified PASS: Redis connects; stats cached at
300s; trend at 600s; reference data at 3600s; X-Cache HIT/MISS correct;
param-scoped keys; invalidation on writes (2xx-only, awaited); errors never
cached; graceful degradation with Redis down (boot and runtime); hit rate
95% (>70%). Static syntax PASS.

One operational defect found and documented (Section 6): cache does not
recover after the reconnect window is exhausted by a long outage. Awaiting
Debugging Agent; re-test will follow the fix. All other validation: PASS.
