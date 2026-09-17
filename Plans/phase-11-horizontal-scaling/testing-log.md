# Phase 11 — Horizontal API Scaling: Testing Log

Testing record · 2026-09-16/17 · Live execution against the compose stack
(edge :18000 via local override; replicas published on 15001-15003).

## Pool analysis script

- Tests: run for 1 and 3 instances; verify live DB numbers.
- Result: FAIL → PASS
- Problems found while building it: (a) `sequelize.query` returns different
  shapes for SELECT vs utility statements; (b) the pool exposes numeric
  getters (`size/available/using/waiting`), not tarn `num*()` methods.
- Fix: `QueryTypes.SELECT` normalization; getter-based counters.
- Retest: `max_connections = 60` measured live, 9 established, budget
  3×10 = 30 (50%) → OK with 51 headroom.
- Status: Fixed and verified.

## Prometheus pool gauge (regression check)

- Result: FAIL → PASS
- Problem: `crimelens_db_pool_connections` had reported 0 for used/
  available/waiting since phase 8 (`.length` on numeric getters).
- Fix: read the getters; label `used` sourced from `pool.using`.
- Retest: non-zero values on `/metrics` under load.
- Status: Fixed and verified.

## k6 comparison matrix (limiter OFF via local override)

- Runs: 1 / 2 / 3 replicas, edge restarted before each run, ramping
  0→50→100 VUs, mixed public profile.
- Results: 156.2 / 157.9 / 123.2 req/s; p95 363 / 282 / 463 ms; errors
  0% / 0.18% / 2.85%.
- Notes: throughput workload-bound (closed model); 3 replicas degraded on
  the shared Docker-VM budget — recorded as the phase's core finding, not
  a defect. Distribution near-perfect at 2 (49.9/50.1), uneven at 3.
- First 1-instance attempt with the limiter ON produced 99.43% 429s —
  confirms limiter dominance; comparison rerun with it off (verified off by
  missing X-RateLimit headers, restored afterwards).
- Status: Measured and documented (report).

## Per-instance observability

- Test: Prometheus targets at 3 replicas.
- Result: PASS — `15001/15002/15003` all UP, distinct `instance` labels;
  `backend:5001` and host `:5001` targets unaffected.
- Note: Docker assigns range ports in creation order (single replica
  observed on 15002, then 15003) — scripts probe the range, no assumptions.

## Shared state (2 replicas, limiter ON)

- Cache: 6× `/api/stats/summary` via edge → `MISS`, then 5× `HIT`; both
  replicas served 3 each. Per-instance cache would alternate MISS/HIT.
  PASS.
- Rate limit: 51-burst via edge across 2 replicas → 52nd = `429` (limit
  50). Per-instance limiter would see ≈26 each. PASS.

## Failover drills (2 replicas)

- First drill: 22/24 non-200 — investigated: all 429s. The publicAPI
  limiter keys per IP across all public routes (no route component in the
  key), and the preceding 51-burst had exhausted the shared bucket.
  Test-design lesson documented; not a failover defect.
- Clean drill (after 60s cool-down): stop one replica → 24/24 HTTP 200 on
  the survivor; replicas restored, edge restarted, all healthy. PASS.

## Restoration

- Scale back to 1 replica, limiter toggle removed from override,
  X-RateLimit headers confirmed back, host dev backend :5001 = 200.
  PASS.

## Not executed

- Open-model saturation probe — deferred by project owner (single-host
  scaling measurement stops here).
- Authenticated endpoint load — no test credentials.
- ESLint — no config in repo; no request-path code changed.
- Playwright — no user-visible change (metrics + scripts + infra only).

## Final status

All executed tests PASS; degradation finding and test-design lessons
documented in `results/scaling-report.md`. Stack ships 1 replica;
`--scale backend=N` mechanics verified end to end.
