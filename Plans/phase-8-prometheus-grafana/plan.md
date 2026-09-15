# Phase 8: Prometheus + Grafana Monitoring

## Objective

Expose Prometheus metrics from the API (HTTP latency/errors, DB pool, Redis
cache, business events, component health), ship a real Prometheus scrape
config and an importable Grafana dashboard, and verify everything against a
live scrape — without adding per-request I/O or unbounded label cardinality.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **`activeUsers` gauge was semantically broken** — `.inc()` on every
   request with no `dec()` anywhere: a counter pretending to be a gauge that
   only ever grows. "Active users" needs session tracking we do not have.
   Dropped (CLAUDE.md §12: no metrics that are not useful).
2. **Double `collectDefaultMetrics`** — the plan called it once, then again
   under an `ENABLE_GC_METRICS` flag with a prefix, doubling node metric
   families. GC metrics are already part of prom-client's defaults. One
   call; flag dropped.
3. **DB pool fields don't exist** — Sequelize 6 uses the `tarn` pool:
   `pool.used / available / waiting / max`. The plan read
   `pool.active / idle / total` → all `undefined` → zeros forever. Fixed
   labels: `used`, `available`, `waiting`, `max`.
4. **`dbQueryDuration` histogram with a `table` label was not implementable
   as written** — the backend is raw-SQL-heavy; there is no reliable way to
   derive a table label, and instrumenting every `sequelize.query` means
   wrapping ~100 call sites or deep monkey-patching. Dropped this phase
   (documented as a candidate when a query layer/service exists).
5. **`redisOperations` counter was defined but never incremented** — dead
   metric. Kept but WIRED in `cacheService` (get/set/delete/deletePattern ×
   ok/fail).
6. **`cacheHitRate` with fake `cache_type` labels** — set the SAME global
   Redis INFO hit-rate under two invented labels. One honest gauge, no
   label (global Redis cache hit rate from `keyspace_hits/(hits+misses)`).
7. **Scrape-time dependency hammering** — `metricsEndpoint` ran
   `sequelize.authenticate()` + Redis `PING` on EVERY scrape (Prometheus:
   every 15 s). Component-health gauges now refresh on a 30 s `setInterval`
   (unref'd) inside the metrics module; `/metrics` serves the register with
   no I/O of its own.
8. **Cardinality hazard in `req.route?.path`** — Express 5 route objects are
   not reliably present at `finish`; fallback was `req.path`, i.e. raw paths
   with IDs (`/api/crimes/update/123`) → unbounded label values. Route label
   = `req.baseUrl + req.route.path` when a route matched, else `unmatched`.
9. **Plan referenced `detailedHealth`, which does not exist** (phase 2 built
   `processHealth`/`readinessCheck`). Step removed.
10. **`/metrics` must never be logged-spammed or rate-limited** — added to
    pino-http `autoLogging.ignore` and excluded from the metrics middleware
    and rate limiters (a 429 or 1 line/15 s noise for a scraper is wrong).
11. **Ops configs relocated** — `prometheus.yml` and the Grafana dashboard
    do not belong inside `backend/config/`. New top-level `infra/` directory:
    `infra/prometheus/prometheus.yml`,
    `infra/grafana/provisioning/...` (datasource + dashboard auto-provision
    so a single `docker run -v` mount gives a working Grafana), and
    `infra/grafana/dashboards/crimelens-api.json` as a REAL importable
    dashboard (schemaVersion, gridPos, datasource refs — the plan's sketch
    was not importable).
12. **Controller snippets were stale** — the plan's business-metric edits
    rewrote `reportCrime`/`approveCrimeReport` without the existing
    `withCacheInvalidation` decorators and referenced the pre-phase-7
    `console.error` lines. Implementation inserts `.inc()` calls into the
    real decorated handlers; no rewrites.

## Implementation Steps

### Step 1: Install

```bash
npm install prom-client
```

(prom-client v15.x; nothing else — Grafana/Prometheus run as containers)

### Step 2: `db-project-backend/config/prometheus.js` (new)

- `register` (prom-client Registry) + ONE `collectDefaultMetrics({ register })`
- HTTP metrics (all with `crimelens_` prefix, `registers: [register]`):
  - `crimelens_http_request_duration_seconds` Histogram
    labels `{ method, route, status_code }`, buckets
    `[0.005..10]`
  - `crimelens_http_requests_total` Counter, same labels
  - `crimelens_http_errors_total` Counter (status ≥ 400), same labels
- Redis:
  - `crimelens_redis_operations_total` Counter `{ operation, status }` —
    incremented in `services/cacheService.js` (get/set/delete/deletePattern,
    ok/fail)
  - `crimelens_cache_hit_rate` Gauge — Redis INFO keyspace hit ratio
- DB pool: `crimelens_db_pool_connections` Gauge `{ state }` =
  used/available/waiting/max from Sequelize's tarn pool (read directly, no
  I/O)
- Business:
  - `crimelens_crimes_reported_total` Counter `{ status, zone_id }`
    (submitted/failed) — inc in `reportCrime` after commit / in catch
  - `crimelens_crimes_verified_total` Counter `{ decision }`
    (approved/rejected/failed) — inc in `approveCrimeReport` /
    `rejectCrimeReport`
- Health: `crimelens_system_health` Gauge `{ component }` (database, redis,
  api) — refreshed by a 30 s unref'd interval that runs
  `sequelize.authenticate()` + Redis `PING`; interval started explicitly
  from `server.js` (`startMetricsUpdater()`), never at import
- Route-label helper: `req.route ? \`${req.baseUrl || ''}${req.route.path}\``
  else `unmatched`
- `metricsMiddleware` — observes duration, incs request/error counters on
  `res.finish`; skips `/metrics` and `/api/health*`
- `metricsEndpoint` — `register.metrics()` only (Content-Type set), no I/O

### Step 3: `server.js` wiring

```javascript
app.get("/metrics", metricsEndpoint);   // BEFORE httpLogger? No — after, but
                                        // excluded from autoLogging + metrics
app.use(metricsMiddleware());
startMetricsUpdater();                  // 30 s health-gauge refresh, unref'd
```

- Mount `/metrics` at app root (no `/api` prefix), unauthenticated for now;
  hardening (network-level allow-list) documented for the Nginx/Cloudflare
  phases
- pino-http `autoLogging.ignore` extended with `/metrics`
- Rate limiters untouched (none apply at root level — verify a scrape never
  hits `crimelens:rl:*`)

### Step 4: Grafana + Prometheus configs (new `infra/` tree)

```
infra/
├── prometheus/prometheus.yml          # 15s scrape of localhost:5001 (host.docker.internal note for Docker Desktop)
└── grafana/
    ├── provisioning/datasources/prometheus.yml   # auto-provisioned datasource
    ├── provisioning/dashboards/dashboards.yml    # auto-provisioned dashboard loader
    └── dashboards/crimelens-api.json             # importable: request rate, p50/p95/p99, error rate,
                                                   # pool gauges, cache hit rate, redis ops, crimes reported,
                                                   # verification decisions, system health stat
```

Panels use only metrics defined above (`crimelens_*` + `nodejs_/process_`
defaults); datasource UID pinned so provisioning matches the dashboard JSON.

## Testing

```bash
# 1. Format + presence: make a few requests, then
curl -s http://localhost:5001/metrics | grep -E "^crimelens_(http|redis|db|cache|crimes|system)" | head
#   Expect: # HELP/# TYPE pairs; crimelens_http_requests_total with
#   route="/api/crimes/types" (NOT raw paths with IDs); no "unmatched" for
#   matched routes; default nodejs_/process_ metrics present

# 2. Cardinality sanity: request /api/crimes/update/1 (401), confirm the
#    route label is the PATTERN "/api/crimes/update/:id" (or "unmatched"
#    per middleware design), never "/api/crimes/update/1"

# 3. Scrape-cost check: /metrics completes with no DB/Redis query delay
#    (time curl; compare with a request to /api/stats/summary)

# 4. Health gauges: stop-start check optional; at minimum confirm
#    crimelens_system_health{component="database"} 1 while DB is up

# 5. Business metrics: submit + approve/reject a crime (or simulate where
#    feasible) and confirm counter deltas; 401-path failure counters verified
#    via a forced failure if credentials unavailable — record what was tested

# 6. Prometheus live scrape (if Docker available):
docker run -d -p 9090:9090 -v $(pwd)/infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
#   Target must show UP at http://localhost:9090/targets

# 7. Grafana live check (if Docker available): run Grafana with the
#    provisioning dir mounted; dashboard must load with data

# 8. Regression: phase 3/4/5/7 — X-Cache, X-RateLimit-*, validation gates,
#    401s, structured request logs all unchanged; /metrics produces NO
#    request log lines and NO rate-limit keys
```

If Docker is unavailable on the machine, steps 6–7 are recorded as
"not executed" with the dashboard JSON checked structurally instead (valid
JSON, correct schemaVersion keys, datasource UID match) — per CLAUDE.md:
never claim a check passed without executing it.

## Out of Scope

- Per-query DB latency histogram (see audit note 4)
- Alerting rules (can be added on top once Prometheus runs in CI/staging)
- Auth on `/metrics` (network-level hardening deferred to Nginx/Cloudflare
  phases; documented there)

## Success Criteria

- [ ] `/metrics` returns valid Prometheus exposition format with default +
      custom families
- [ ] HTTP metrics: correct route labels (patterns, not raw IDs), status
      breakdown, error counter only for ≥400
- [ ] Redis op counters increment from cacheService; hit-rate gauge matches
      Redis INFO
- [ ] DB pool gauges report real tarn values (non-zero while serving)
- [ ] Business counters increment on report/verify paths
- [ ] Health gauges refresh without I/O in the scrape path
- [ ] Prometheus scrape config + importable Grafana dashboard committed;
      live docker check executed OR recorded as not-executed
- [ ] `/metrics` absent from request logs and rate-limit keys
- [ ] API responses unchanged (byte-identical payloads on sampled endpoints)

## Files Created/Modified

```
db-project-backend/
├── config/prometheus.js          (new)
├── services/cacheService.js      (modified — redis op counters)
├── controllers/CrimeControllers.js (modified — business counters)
└── server.js                     (modified — endpoint, middleware, updater)
infra/
├── prometheus/prometheus.yml     (new)
└── grafana/                      (new — provisioning + dashboard JSON)
Plans/phase-8-prometheus-grafana/implementation-log.md (new)
```

## Rollback

Remove `app.get("/metrics")`, `metricsMiddleware`, `startMetricsUpdater`
from `server.js` and uninstall `prom-client`; the `infra/` files are inert
without Docker. No data/schema/contract changes.

## Estimated Completion Time

- Metrics module + wiring: 1.5 h
- cacheService/controller counters: 45 min
- infra/ configs + dashboard JSON: 1.5 h
- Validation incl. docker live check: 1 h
- **Total: ~4.5 h**
