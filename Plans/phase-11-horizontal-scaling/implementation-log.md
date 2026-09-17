# Phase 11 — Horizontal API Scaling: Implementation Log

Branch: `feature/phase-11-horizontal-scaling` · Dates: 2026-09-16/17 · Plan: audit-rewritten before implementation (15 corrections, see plan.md).

## Implemented

- `scripts/scale-backend.sh` — `docker compose up -d --scale backend=N` +
  **edge restart** (OSS nginx resolves upstream DNS at startup — phase-10
  rule) + health probe of every port in the override range 15001-15003.
  Probes the range, never assumes a port↔replica mapping (Docker assigns
  range ports in creation order — observed a single replica land on 15002
  and 15003 after recreations).
- `scripts/analyze-db-pool.js` — pool cap from
  `sequelize.config.pool.max`, live counters from the pool's numeric
  getters (`size/available/using/waiting`), live `SHOW max_connections` and
  `pg_stat_activity` counts, per-instance budget table with warning.
  Sequelize query shapes differ between SELECT and utility statements —
  normalized with `QueryTypes.SELECT`.
- `db-project-backend/tests/k6/runs/scaling-comparison.js` — closed-model
  ramping-VU comparison (0→50→100 VUs) reusing the existing k6 lib
  (`BASE_URL`/`ENDPOINTS`/`getRandomCoordinate`), same style as the
  phase-0 baseline; mixed public profile (uncached PostGIS radius reads,
  cached stats, constant endpoints). Auth flows excluded (no credentials).
- `infra/prometheus/prometheus.yml` — added per-replica targets
  `host.docker.internal:15001/15002/15003` (DOWN when unscaled — harmless);
  all three verified UP with distinct `instance` labels at 3 replicas.
- `db-project-backend/config/prometheus.js` — **bug fix (phase-8
  regression found now):** the DB pool gauge read `pool.used?.length` but
  the live counters are numeric getters (`using`/`available`/`waiting`) —
  every state had been silently reporting 0. Fixed; verified non-zero under
  load on `/metrics`.
- `docker-compose.override.yml` (gitignored) — documented the
  `RATE_LIMIT_ENABLED=false` toggle used only for the measurement runs;
  removed afterwards (limiter verified back on via headers).

## No application behavior changes

Scaling is config + verification + measurement. The only backend code edit
is the pool-gauge metric fix above (metrics only, no request path).

## Measurement summary (details in results/scaling-report.md)

- DB measured: `max_connections = 60`; budget 3×10 = 30 = 50% — within capacity.
- Closed-model matrix (limiter OFF): 1 replica 156.2 req/s p95 363ms
  (backend CPU 135% saturated); 2 replicas 157.9 req/s p95 282ms (60%×2);
  3 replicas 123.2 req/s p95 463ms, 2.85% errors (degraded — shared
  Docker-VM compute + DB contention).
- Throughput flat across replica counts: k6's fixed 100 VUs + 1s think time
  generate a workload-bound ceiling; replicas bought latency/CPU relief.
- **Decision (project owner): multi-host capacity scaling deferred until a
  multi-host deployment exists; stack ships 1 replica; `--scale backend=N`
  verified correct mechanically (DNS fan-out, distribution, failover).**
- Open-model saturation probe deferred by the owner (script removed).

## Deviations from plan

1. **Saturation probe planned, then dropped** — owner decided not to invest
   further in single-host scaling measurement.
2. **Rate limiter disabled during k6 runs** (local override only) — plan
   anticipated cache/limiter dominance but not that the per-IP limiter
   would 429 >99% of a single-IP load test; documented in report.
3. **Pool-gauge fix beyond plan file list** — phase-8 regression surfaced
   while building the per-instance view; fixed under regression rules.

## Validation (all actually executed)

```text
node --check (analyze-db-pool.js, prometheus.js):        PASS
analyze-db-pool.js live (1 and 3 instances):             PASS — max_conn 60,
                                                         budget OK, live counters
Pool gauge via /metrics after fix:                       PASS — real values
k6 1/2/3 runs (limiter off):                             PASS execution;
                                                         3-instance threshold
                                                         crossing DOCUMENTED
                                                         (degradation finding)
Load distribution:                                       PASS — 49.9/50.1 at 2;
                                                         ~39/35/25 at 3
Prometheus per-instance targets at 3 replicas:           PASS — 15001/2/3 UP
Shared cache proof (2 replicas):                         PASS — 1 MISS + 5 HIT
                                                         across both replicas
Shared rate-limit bucket (2 replicas):                   PASS — 52nd → 429
Kill drill (clean, after limiter cool-down):             PASS — 24/24 on survivor
Kill drill (first attempt):                              22/24 "fails" = 429s
                                                         from exhausted per-IP
                                                         publicAPI bucket —
                                                         test-design lesson
                                                         documented
Scale back to 1 + limiter restored:                      PASS — headers back
Host workflows (dev backend :5001):                      PASS — 200 throughout
ESLint:                                                  NOT EXECUTED — no
                                                         config in repo
Playwright:                                              NOT EXECUTED — no
                                                         user-visible change
                                                         (no app code on the
                                                         request path changed)
```

## Files

```
scripts/scale-backend.sh, scripts/analyze-db-pool.js        (new)
db-project-backend/tests/k6/runs/scaling-comparison.js      (new)
db-project-backend/config/prometheus.js                     (pool gauge fix)
infra/prometheus/prometheus.yml                             (per-instance targets)
Plans/phase-11-horizontal-scaling/results/scaling-report.md (measured report)
docker-compose.override.yml                                 (gitignored, local)
```
