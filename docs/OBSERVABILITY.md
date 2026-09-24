# Observability

CrimeLens ships metrics, dashboards, structured logs, and health checks.
Everything here is provisioned by the compose stack (`infra/`).

## Metrics (Prometheus)

Scraped from each API replica's `/metrics` (per-instance targets in
`infra/prometheus/prometheus.yml`; the nginx edge itself returns 404 for
`/metrics` by design).

Application metrics (`crimelens_*` prefix, `config/prometheus.js`):

| Metric | Type | Why it matters |
|---|---|---|
| `crimelens_http_requests_total` | counter | Traffic per route/method/status |
| `crimelens_http_request_duration_seconds_*` | histogram | Latency per route — p50/p95/p99 via `histogram_quantile` |
| `crimelens_http_errors_total` | counter | Error-rate tracking |
| `crimelens_db_pool_connections{state="used"\|"available"\|"waiting"\|"max"}` | gauge | Pool pressure; **query with the `state` label** (e.g. `max_over_time(...{state="waiting"}[10m])`) — the `max` series is configuration, not usage |
| `crimelens_cache_hit_rate` | gauge | Cache effectiveness per instance |
| `crimelens_redis_operations_total{operation,status}` | counter | Redis health/latency contribution |
| `crimelens_queue_depth{queue,state}` | gauge | BullMQ waiting/active/completed/failed/delayed |
| `crimelens_system_health` | gauge | Component health flags |
| `crimelens_crimes_reported_total` | counter | Business-level submission volume |

Node.js runtime metrics (`nodejs_*`) come from the default registry.

Useful queries:

```promql
# p95 per route over 5m
histogram_quantile(0.95, sum by (le, route) (rate(crimelens_http_request_duration_seconds_bucket[5m])))

# request rate
sum(rate(crimelens_http_requests_total[2m]))

# pool saturation check
max_over_time(crimelens_db_pool_connections{state="waiting"}[10m])
```

## Dashboards (Grafana)

Provisioned from `infra/grafana` at http://localhost:13300 (override port).
Note: Grafana runs without a persistent volume — dashboards reset when the
stack is recreated (recorded in KNOWN_ISSUES).

## Logs (pino)

Structured JSON to stdout, collected via `docker compose logs`:

- Request logs with correlation/request IDs, method, route, status, duration
- Error logs include the error object (`req.log.error({ err }, ...)`)
- No secrets, tokens, or credentials are logged (enforced convention —
  see backend CLAUDE.md)

Log level: `LOG_LEVEL` env (default: info; debug in development).

## Health checks

| Endpoint | Meaning | Checks |
|---|---|---|
| `GET /api/health` | Liveness — process is up | Always 200 when the process serves; reports rate-limiter mode + uptime |
| `GET /api/ready` | Readiness — dependencies available | PostgreSQL + Redis connectivity with response times; 503 when a dependency is down |

Container-level healthchecks (compose): API/worker/redis/nginx healthchecks
gate orchestration; the nginx healthcheck targets the API through itself.
