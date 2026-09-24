# Performance

Measured results only. Full raw evidence and methodology:
[`Plans/phase-16-k6-final/results/baseline-comparison/comparison-report.md`](../Plans/phase-16-k6-final/results/baseline-comparison/comparison-report.md).

## Methodology

- **k6** load tests; two models:
  - *Closed model* (ramping VUs) — phase-0 baseline suites, rerun
    unmodified (byte-identical scripts) against the upgraded stack for a
    like-for-like before/after on the same machine.
  - *Open model* (constant/ramping arrival rate) — capacity measurement
    independent of VU count.
- Run order: smoke → baseline (16 min, 115 VUs incl. auth + real write
  lanes) → stress (17 min, 0→500 VUs) → spike (50→500→50), with cooldowns
  and health checks between runs.
- Rate limiting disabled for capacity runs (the phase-0 system had none) so
  a single-IP run measures capacity, not the limiter; verified separately
  with it ON.
- System evidence captured during runs: Prometheus (per-route latency,
  pool `used/waiting` with correct state labels, cache hit rate, queue
  depth) + docker stats.

## Before / after (identical workload, same machine)

| Metric | Before (2026-08-26) | After | Δ |
|---|---|---|---|
| Baseline throughput | 25.5 req/s | 55.4 req/s | **2.2×** |
| Baseline p50 / p95 | 1,230 / 5,130 ms | 25 / 655 ms | **−98% / −87%** |
| Stress throughput | 32.3 req/s | 282 req/s | **8.7×** |
| Stress p50 / p95 | 8,170 / 36,640 ms | 119 / 2,800 ms | **−99% / −92%** |
| Spike requests absorbed | 4,997 | 51,198 | **10.2×** |
| Recovery p50 (post-spike) | 530 ms | 19 ms | −96% |
| HTTP error rate (baseline) | 0.10% | 0.006% | fewer |

## Where the gains come from (measured per path)

| Path | Mechanism | Result |
|---|---|---|
| Cached reads (stats/types/zones) | Redis cache-aside (phase 3) | p50 −98 to −99.7% (`/api/stats/summary` 4,804 → 15 ms); 100% hit ratio sustained |
| DB-bound map reads (radius) | Pool 10 vs 5 + production build (phases 1, 9) | p50 −89%; still the slowest path |
| Auth (bcrypt + JWT) | Pool + prod build | p50 −59% |
| Writes (Supabase insert) | Pool + prod build | p50 −54%; 261/263 succeeded in-run |

## Capacity limits (measured, not speculative)

- Single-host open-model ceiling: **~100–110 req/s** (mixed profile);
  ~160 req/s on a cache-dominated profile.
- The **Postgres connection pool (10)** is the binding resource: DB-bound
  reads saturate it first while Node CPU stays under ~40%. Cached routes are
  unaffected at every load level.
- Degradation mode is queueing, not failure: 0.098% errors at 3× overload.
- Rate-limit tiers verified live: PUBLIC 51st → 429, WRITE 11th → 429,
  AUTH 6th → 429 + 5-min lockout.

Next levers, in order of expected impact: DB-side radius query tuning
(`EXPLAIN ANALYZE` + index), pool sizing, then horizontal scale-out across
separate hosts (pool budget: instances × 10 ≤ 60).
