# Phase 8 — Prometheus + Grafana Monitoring: Implementation Log

## Status: Implemented & Validated (API level + live Prometheus/Grafana retest)

## What Was Implemented

- `db-project-backend/config/prometheus.js` (new) — prom-client 15.1.3:
  - default node/process metrics (single `collectDefaultMetrics` call)
  - `crimelens_http_request_duration_seconds` (Histogram),
    `crimelens_http_requests_total` / `crimelens_http_errors_total`
    (Counters) — labels `{method, route, status_code}`, route label is the
    matched route PATTERN (`req.baseUrl + req.route.path`), `unmatched`
    fallback; raw paths (IDs) never labeled
  - `crimelens_redis_operations_total{operation,status}` — wired in
    cacheService (get/set/delete/deletePattern × ok/fail)
  - `crimelens_cache_hit_rate` — Redis INFO keyspace hit ratio (no fake
    labels)
  - `crimelens_db_pool_connections{state}` — tarn live counts
    (used/available/waiting) + configured cap from `sequelize.config.pool.max`
  - `crimelens_system_health{component}` (database/redis/api) — refreshed by
    a 30s unref'd interval (`startMetricsUpdater()`, called from server.js
    after Redis connect; runs authenticate + PING OFF the scrape path)
  - `crimelens_crimes_reported_total{status,zone_id}` — inc after commit
    (submitted) / in catch (failed) in `reportCrime`
  - `crimelens_crimes_verified_total{decision}` — approved/rejected after
    respective commits, failed in catches
  - `metricsMiddleware` (skips `/metrics`, `/api/health`, `/health`,
    `/ready`) + `metricsEndpoint` (register dump only — zero I/O)
- `server.js` — middleware mounted after compression; `/metrics` GET at
  app root; `startMetricsUpdater()` in startup
- `config/logger.js` — pino-http autoLogging ignore extended with
  `/metrics` (scrapes produce zero request log lines)
- `services/cacheService.js` — Redis op counters
- `controllers/CrimeControllers.js` — business counters (inside the real
  `withCacheInvalidation`-decorated handlers; no rewrites)
- `infra/` (new tree)
  - `prometheus/prometheus.yml` — 15s scrape, localhost:5001 +
    host.docker.internal:5001 targets
  - `grafana/provisioning/datasources/prometheus.yml` — datasource UID
    `crimelens-prom`, pinned
  - `grafana/provisioning/dashboards/dashboards.yml` — dashboard loader
  - `grafana/dashboards/crimelens-api.json` — importable dashboard (schema
    v39, 13 panels: request rate, p50/p95/p99, error ratio, status
    breakdown, top-route latency, DB pool, cache hit gauge, component
    health stat, redis ops, crimes reported, verification decisions,
    node heap + event-loop lag)

## Validation Performed

- `node --check` on all 6 touched JS files: PASS
- Dashboard JSON parses (`JSON.parse`): PASS
- Boot + traffic + scrape (:5092): PASS
  - `/metrics` 200, 20 KB, 13 ms — scrape cost trivial
  - Families present: http_requests (6 series), duration buckets (72),
    errors (2: one 401 + one 404), redis_operations (get ok ×2, set ok ×1),
    db_pool_connections (4 states), system_health (3 components),
    cache_hit_rate (0.93 — matches Redis INFO), 86 default node/process
    series
  - Route labels verified as PATTERNS:
    `route="/api/crimes/update/:id"` for the 401 probe; unmatched 404
    labeled `unmatched`; no raw-ID labels anywhere
  - `crimelens_db_pool_connections{state="max"} = 10` (DB_POOL_MAX) — real
    configured cap after the tarn fix
  - Health gauges: database=1, redis=1, api=1 while deps up
  - `/metrics` produced ZERO request log lines and ZERO `crimelens:rl:*`
    keys (only my API traffic created the expected public-limiter key)
- Regression (:5092): `X-Cache` MISS/HIT, `X-RateLimit-*` headers,
  compression, structured pino request logs all intact on sampled endpoints

## Live findings fixed during validation

- `pool.max` does not exist on tarn's public surface (plan correction
  anticipated `active/idle` were wrong; `max` itself also needed a fix) —
  gauges read live arrays from tarn and the cap from sequelize config.
  Initial scrape showed `max=0`; fixed and re-verified (`max=10`).

## Not Executed (with reason)

- ~~Live Prometheus / Grafana containers~~ — RETESTED LIVE, see below.
- Business-counter increments: `crimesReported`/`crimesVerified` are wired
  inside auth-gated citizen/police flows; no credentials available to submit
  a real report, so live deltas were not exercised. The counter families
  appear in `/metrics` (registered), and the inc-sites were code-verified.
  Testing Agent with seeded accounts should confirm live deltas.
- ESLint / TypeScript: no backend ESLint config; plain JS (pre-existing gap)
- Playwright: metrics-only change, no frontend contract change (per
  CLAUDE.md §17 monitoring config does not require browser validation)

## Live Prometheus + Grafana Retest (after user started Docker Desktop)

Exact committed config shapes, validated against a live stack (API booted
from this branch on :5092; Prometheus/Grafana containers via the `infra/`
files with only the API port substituted 5001→5092 in a TEMP copy, since the
user's backend occupies :5001):

- **Prometheus** (`prom/prometheus`, config mounted read-only):
  - `host.docker.internal:5092` target → **UP**, no scrape error
  - `localhost:5092` target → down (container resolves localhost to ::1,
    API binds IPv4) — exactly the documented dual-target behavior in the
    YAML comment; harmless
  - PromQL `crimelens_http_requests_total` returned real series with
    pattern route labels (`GET /api/crimes/types 200 = 1`,
    `PUT /api/crimes/update/:id 401 = 1`)
  - `crimelens_cache_hit_rate = 0.93`, `crimelens_system_health`
    database/redis/api all `1` queryable through Prometheus
- **Grafana** (`grafana/grafana`, provisioning + dashboards mounted
  read-only):
  - health endpoint 200
  - datasource auto-provisioned: `crimelens-prom` →
    `http://host.docker.internal:9090`
  - dashboard auto-provisioned: uid `crimelens-api`, title "CrimeLens API",
    13 panels
  - END-TO-END query through Grafana's `/api/ds/query` (Grafana →
    Prometheus → API) returned the three `crimelens_system_health` series
    with value 1
- Test containers removed afterward; temp rate-limit keys flushed.

## Notes for Testing Agent

- `/metrics` is intentionally UNAUTHENTICATED at app root — network
  allow-listing deferred to Nginx/Cloudflare phases; do not "test" it as a
  security hole in isolation.
- `crimelens_system_health{database}` flips to 0 only while the 30s updater
  observes a failure — brief DB blips between scrapes are invisible by
  design (no scrape-path I/O).
- To smoke-test business counters with seeded accounts: submit a report as
  citizen, approve/reject as police, then
  `curl -s localhost:5001/metrics | grep crimes_`.
- Prometheus config targets BOTH localhost:5001 and
  host.docker.internal:5001; exactly one is expected UP depending on where
  the container runs — that is documented in the YAML, not a fault.
