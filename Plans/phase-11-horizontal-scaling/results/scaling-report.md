# Horizontal Scaling Report (Phase 11)

Date: 2026-09-17 · Environment: Docker Desktop VM (Windows host), edge nginx
at :18000 (local override), Supabase PostgreSQL external, Redis single
container. Load generator (k6) runs on the same host as the stack.

## Configuration measured

- Pool per instance: `DB_POOL_MAX` default 10 / min 0 (env-driven, no code change)
- DB capacity measured live: `max_connections = 60` (Supabase), 9
  connections established at analysis time
- Budget: 1×10=10 (16.7% of 60) · 2×10=20 (33%) · 3×10=30 (50%) — within
  capacity with 51 headroom at 3 instances (worst case)

## Closed-model comparison (k6 ramping 0→50→100 VUs, 5m30s, limiter OFF)

Rate limiter disabled for the comparison runs: the 50/min per-IP limiter
429s a single-IP hammer long before scaling differences appear (its shared
behavior is proven separately, below). Profile: mixed public reads —
uncached PostGIS radius reads, Redis-cached stats, tiny constant endpoints.

| Metric | 1 replica | 2 replicas | 3 replicas |
|---|---|---|---|
| Requests | 51,696 | 52,266 | ~40,600 |
| Throughput | 156.2 req/s | 157.9 req/s | 123.2 req/s |
| p50 latency | 33.6 ms | 56.4 ms | — |
| p90 latency | 254.6 ms | 202.7 ms | — |
| p95 latency | 362.8 ms | 282.0 ms | 463.0 ms |
| Error rate | 0.00% | 0.18% | 2.85% |
| Backend CPU during run | 80→135% (saturated) | ~60% ×2 | split ×3 |
| Distribution (log lines) | 100% | 49.9 / 50.1 | ~39 / 35 / 25 |

Raw k6 exports: `k6-1instance.json`, `k6-2instances.json`,
`k6-3instances.json` (gitignored).

## Findings

1. **Throughput is workload-bound, not replica-bound, in this setup.** With
   a fixed 100 VUs and 1s think time, k6 generates ≈158 req/s regardless of
   replica count — the closed model saturates. Replica count shows up as
   latency and CPU relief: p95 363→282 ms and 135%→60%×2 from 1→2 replicas.
2. **3 replicas degraded everything** (throughput, p95, errors) on this
   hardware. All containers share one finite Docker Desktop VM; adding Node
   processes adds contention, and 3 concurrent pools hammer the shared
   Supabase instance. Distribution also became uneven (39/35/25).
3. **Conclusion (agreed with the project owner): horizontal scaling here
   demonstrates correct mechanics — DNS fan-out, shared state, failover,
   per-instance observability — but real capacity scaling requires separate
   hosts, which is out of scope until multi-host deployment exists.** The
   current topology ships with 1 replica; `--scale backend=N` remains
   available and correct when that day comes.
4. **DB budget is not the bottleneck** at these scales (30/60 worst case);
   shared compute is.

## Shared-state (statelessness) proofs — limiter ON, 2 replicas

- **Shared Redis cache:** 6 sequential `/api/stats/summary` requests via the
  edge → `MISS` once, then 5× `HIT`, while both replicas logged 3 requests
  each. A per-instance cache would have alternated MISS/HIT per replica.
- **Shared rate-limit bucket:** 51-request burst across the edge with 2
  replicas → request 52 = `429` (limit 50). A per-instance limiter would
  have seen ≈26 per replica and not tripped.
- **Config review:** JWT auth (no sessions), memory-storage uploads to
  Cloudinary (no local files), no in-memory app state — nothing requires
  sticky sessions.

## Failover (passive health checks, 2 replicas)

- Clean drill (after limiter cool-down): stopping one replica mid-traffic →
  24/24 requests OK on the survivor; both replicas restored healthy after.
- First drill attempt showed 22/24 "failures" — those were HTTP 429s: the
  publicAPI limiter keys per IP across ALL public routes (no route in the
  key), and the preceding 51-burst had exhausted the bucket. Test-design
  lesson, not a failover defect: cool down (or use separate IPs) before
  drilling.

## Per-instance observability

Prometheus targets `host.docker.internal:15001/15002/15003` all UP with
distinct `instance` labels while 3 replicas ran (plus `backend:5001` and the
host API). Docker assigns range ports in creation order, not per replica
index — scripts probe the range, never assume a mapping.

## Defects found & fixed during this phase

- `config/prometheus.js` pool gauge read `pool.used?.length` — the live
  counters are numeric getters (`using`/`available`/`waiting`), so every
  state had been silently reporting 0 since phase 8. Fixed and verified via
  `/metrics` (non-zero values under load).
- `scripts/analyze-db-pool.js`: sequelize query shapes differ between
  `SELECT` and utility statements — normalized with `QueryTypes.SELECT`.

## Not executed

- Open-model saturation probe (arrival-rate executor) — deferred by the
  project owner until multi-host testing is relevant.
- Authenticated-endpoint load — no test credentials.
- Backend ESLint — no ESLint config in repo.
