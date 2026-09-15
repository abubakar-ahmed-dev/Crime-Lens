# Phase 8 — Prometheus + Grafana Monitoring: Implementation Log

## Status: Implemented & Validated (API level; live Prometheus/Grafana not run)

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

- **Live Prometheus / Grafana containers**: Docker CLI is installed but the
  Docker Desktop engine would not start on this machine (daemon pipe
  unavailable after launch attempt). Per plan §Testing fallback:
  `prometheus.yml` and the dashboard JSON were validated structurally (YAML
  reviewed, JSON parsed, datasource UID matches dashboard refs); the live
  target-UP and dashboard-render checks are recorded as NOT EXECUTED. Compose
  of these files lands properly in Phase 9 (Docker).
- Business-counter increments: `crimesReported`/`crimesVerified` are wired
  inside auth-gated citizen/police flows; no credentials available to submit
  a real report, so live deltas were not exercised. The counter families
  appear in `/metrics` (registered), and the inc-sites were code-verified.
  Testing Agent with seeded accounts should confirm live deltas.
- ESLint / TypeScript: no backend ESLint config; plain JS (pre-existing gap)
- Playwright: metrics-only change, no frontend contract change (per
  CLAUDE.md §17 monitoring config does not require browser validation)

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
