# Baseline Comparison Report — Phase 0 vs Current Stack

Controlled rerun of the unmodified Phase 0 k6 suite against the current
system-design implementation. Same scripts (byte-identical to commit
`a112370`), same machine, same workload; the system under test changed.

- Baseline reference: commit `a112370eb41f9ccf389eefbd819f55248d1a8e91`,
  executed **2026-08-26** (Express via `npm start`/nodemon on :5001,
  pool max 5, no cache, no limiter, 4 zones / 7 types / ~8 approved crimes).
- Rerun: 2026-09-18, commit `63240d2` worktree, `k6 → nginx edge :18000 →
  1 API replica → Redis (cache ON, limiter OFF) → remote Supabase`,
  pool max 10, 4 zones / 7 types / 6 approved (public) crimes.
- Evidence: `environment.md`, per-run console logs + per-endpoint
  aggregations in this directory, checksummed raw k6 JSON under `raw/`
  (1.5 GB, gitignored).

**Correction to the earlier phase-16 report:** it claimed the Phase 0
baseline was never executed. That is wrong — Phase 0's testing log records
baseline, stress, and spike executions on 2026-08-26, summarized in
`Plans/phase-0-k6-baseline/testing-log.md`; only the large raw JSON files
were deleted after aggregation. `final-scalability-report.md` has been
corrected in the same commit as this report.

---

## 1. Directly comparable results

Scripts, VU curves, stage durations, sleeps, endpoint mixes, thresholds and
request ordering are identical (verified byte-for-byte against `a112370`).
Same physical machine. Differences that remain and bound interpretation:
Docker/nginx in the path (vs nodemon direct), pool 10 vs 5, Redis cache
present (an intended measured improvement), ~6 vs ~8 approved crimes,
limiter disabled (Phase 0 had none — disabling avoids it distorting the
capacity comparison).

### 1.1 Baseline (16 min, 115 max VUs: 100 public + 10 auth + 5 write)

| Metric | Phase 0 (2026-08-26) | Rerun (2026-09-18) | Δ |
|---|---|---|---|
| Total requests | 24,667 | 53,972 | +119% (system served more work in the same window) |
| Throughput | 25.5 req/s | 55.4 req/s | **2.2×** |
| Iterations | — | 8,928 (9.16/s) | — |
| VUs | 115 max | 115 max (identical) | 0 dropped |
| p50 | 1,230 ms | **25 ms** | **−98%** |
| avg | — | 151 ms | — |
| p90 | — | 408 ms | — |
| p95 | 5,130 ms ❌ | **655 ms** ❌ (gate still crossed) | **−87%** |
| p99 | 7,690 ms ❌ | 1,540 ms | −80% |
| max | 11,115 ms | 6,278 ms | −44% |
| HTTP error rate | 0.10% | **0.006%** (3/53,972) | improved |
| Checks succeeded | 91.86% | **99.26%** | +7.4 pts |

Both runs crossed the `p95 < 500 ms` threshold; the rerun is reported as
measured (655 ms), not tuned to pass.

### 1.2 Stress (17 min, closed model 0→100→200→300→400→500 VUs)

Same original `stress.js`. Phase 16's open-model run is NOT used here.

| Metric | Phase 0 | Rerun | Δ |
|---|---|---|---|
| Total requests | 33,106 | 289,121 | **8.7×** |
| Throughput | 32.3 req/s | **282.2 req/s** | **8.7×** |
| p50 | 8,170 ms | **119 ms** | **−99%** |
| p95 | 36,640 ms ❌ | **2,800 ms** ❌ | **−92%** |
| p99 | 41,610 ms | 4,335 ms | −89% |
| max | 47,760 ms | 23,168 ms | −51% |
| HTTP error rate | 0.00% | 0.00% | equal — zero failures at 500 VUs in both |
| Checks succeeded | 90.30% | 93.27% | +3 pts |

Note on the improved number: at 500 VUs the rerun completed 8.7× the
requests — the system now *answers* fast enough that the closed model can
issue far more work, which is itself the improvement. Latency gates still
fail at 500 VUs (p95 2.8 s): the pool is again the binding resource
(evidence below), just an order of magnitude less dramatic.

### 1.3 Spike & recovery (50 VU × 2m → 500 VU × 2m → 50 VU × 3m)

| Scenario | Phase 0 p50 / p95 / max | Rerun p50 / p95 / max | Failures |
|---|---|---|---|
| normal_load | 542 / 3,298 / 22,997 ms | **18 / 154 / 9,852 ms** | 0 / 0 |
| spike | 10,300 / 45,191 / 45,599 ms | **181 / 2,964 / 13,238 ms** | 0 / **31** (0.06%) |
| recovery | 530 / 10,370 / 40,868 ms | **19 / 202 / 8,277 ms** | 0 / 0 |

- Spike: rerun absorbed 10.2× the requests (51,198 vs 4,997) with p95 down
  93%. The 31 failures are timeout-type responses under the 10× overload
  burst — Phase 0 queued everything instead (its external probe timed out
  at 30 s); see §6 limitations.
- Recovery: p50 18→19 ms across the spike — same "drains and recovers"
  behavior, no lasting degradation, no crashes, container healthy
  throughout (backend CPU peaked ~107% mid-spike, nginx 16%).
- k6 exit code 0: spike thresholds PASSED in the rerun (Phase 0's spike
  had no thresholds defined in testing-log).

---

## 2. Per-endpoint comparison (baseline.js, overlapping endpoints)

Rerun aggregation: `baseline-per-endpoint.txt` (this directory). Phase 0
numbers: `Plans/phase-0-k6-baseline/testing-log.md`.

| Endpoint | P0 count / p50 / p95 | Rerun count / p50 / p95 | p50 Δ | p95 Δ |
|---|---|---|---|---|
| `/api/stats/summary` | 3,344 / 4,804 / 8,050 ms | 7,507 / **15** / 1,104 ms | **−99.7%** | **−86%** |
| `/api/crimes/types` | 3,344 / 1,173 / 2,287 ms | 7,507 / **12** / 457 ms | −99% | −80% |
| `/api/zones` | 3,344 / 1,183 / 2,224 ms | 7,507 / **15** / 439 ms | −99% | −80% |
| `/api/stats/crime-trend` | 3,344 / 1,168 / 2,180 ms | 7,507 / **20** / 524 ms | −98% | −76% |
| `/api/crimes/` radius | 3,344 / 1,186 / 2,200 ms | 7,507 / 132 / **583 ms** | −89% | **−74%** |
| `/api/auth/login` | 1,025 / 1,182 / 3,121 ms | 1,159 / **485** / 2,265 ms | −59% | −27% |
| `/api/user/report-crime` | 233 / 2,609 / 5,034 ms | 263 / **1,191** / 3,095 ms | −54% | −38% |

Phase 0's worst endpoint (`/api/stats/summary`, p50 4.8 s) is now the
fastest cached path (p50 15 ms) — the single clearest confirmation that
Phase 3's cache-aside did its job. The DB-bound radius path also improved
8.9× at p50 (smaller dataset helps it least and most: see §6). Auth and
write improved roughly 2× — these are inherently DB-write/bcrypt-bound and
were never cacheable, so the gain there comes from pool 10 vs 5 and the
production build (no nodemon), not from caching.

Stress per-endpoint: `stress-per-endpoint.txt`. Pattern holds — summary
p50 29,390 ms → 88 ms (−99.7%); the formerly-uniform ~11–13 s p95 plateau
collapsed to 285–4,171 ms with the DB-bound path again the slowest.

---

## 3. Which paths improved, separately

| Path | Improved? | Mechanism (measured) |
|---|---|---|
| Cached reads (summary/types/zones/trend/distributions) | **Yes, dramatic** (p50 −98 to −99.7%) | Redis cache-aside (Phase 3); hit ratios 0.95+ on the stats lane during runs |
| DB-bound map reads (radius) | **Yes, strong** (p50 −89%, baseline p95 −74%) | Pool 10 vs 5 (Phase 1) + production build; still the slowest path under stress — DB remains the frontier |
| Auth (bcrypt + JWT) | Yes, moderate (p50 −59%) | Pool + prod build; bcrypt cost unchanged (not cacheable) |
| Writes (Supabase insert) | Yes, moderate (p50 −54%) | Same two mechanisms; correctness preserved (261/263 reports created, see below) |
| Resilience under 500 VU / spike | Yes (8.7×/10.2× work absorbed; near-zero errors) | Combination of all phases; graceful-degradation character unchanged |

## 4. Confirmed improvements (defensible)

1. Throughput 2.2× (baseline), 8.7× (stress) on identical closed models.
2. Latency: p50 −98/−99%, p95 −87/−92% on the same workloads and gates.
3. `/api/stats/summary` from worst endpoint to fastest (cache).
4. Check-success rate +7.4 pts (baseline) — fewer slow-request breaches.
5. Recovery behavior unchanged (healthy) while absorbing 10× spike traffic.
6. Rate limiting (verified separately in phase 16, §rate-limit) sheds
   abuse before the pool — orthogonal to these capacity numbers (limiter
   was OFF here, matching Phase 0's lack of one).

## 5. Remaining bottlenecks (measured in this rerun)

1. **DB pool still saturates under stress**: `crimelens_db_pool_connections
   {state="used"}` max = 10/10, avg 1.15 (baseline window) → 4.95 (stress
   window); `state="waiting"` max = 8 queued. Corrected label queries used
   (the phase-16 report's `max(pool_connections)` without a state label
   also saw the configured-`max` series — its claim "pinned at 10/10" was
   directionally right but the query was imprecise; superseded here).
2. Baseline p95 gate (500 ms) still crossed at 100 public VUs — now by the
   DB-bound minority of requests, not by every endpoint (92% of radius
   checks met 500 ms vs Phase 0's 14%).
3. Radius reads remain the p95 driver; next lever is DB-side (index/tune
   or cache radius windows), not the web tier.

## 6. Test limitations (honest)

1. **Differences that bound comparability**: nginx+Docker in path vs
   nodemon direct; pool 10 vs 5; Redis present (intended); ~6 vs ~8
   approved public crimes; 2 pending-crime queues grew by 261 test reports
   during the run (pending records do not enter public reads, but the
   admin-side dataset grew). Per-endpoint numbers on DB-bound paths
   therefore carry a small dataset-size caveat in BOTH directions.
2. **Spike failures ≠ Phase 0's behavior**: Phase 0's spike timed out a
   30 s external probe and queued everything; the rerun answered 10× the
   requests but dropped 31 (0.06%) as timeouts. "Fewer errors" is NOT
   claimed for the spike lane — behavior changed shape (queue-everything →
   answer-fast-then-drop-extreme-tail), which is arguably better but is a
   different failure mode.
3. **Dropped iterations**: 0 in all three reruns — but a low HTTP error
   rate alone would not prove that; k6's dropped-iterations counter and
   iteration stats were checked explicitly.
4. **Write lane**: real reports created on the shared Supabase test
   account: **263 attempts → 261 created (pending), 2 failed** — counted,
   not deleted (deletion requires explicit approval). Phase 0 created 233.
5. **Prometheus dual scrape targets** (`backend:5001` DNS and
   `host.docker.internal:15003` both scrape the single replica) — series
   are duplicated across instance labels; `instance=~"host.docker.internal.*"`
   filters were applied and the dead `:5001`-published series (0.00)
   ignored.
6. **One aborted baseline attempt** (~1 s, 0 requests): k6 could not open
   the raw-output path (missing directory, operator error). Log preserved
   as `aborted-baseline-console.log`; cache re-flushed before the real run.
7. The optional direct-backend (nginx-overhead) run was NOT performed —
   the primary comparison was complete without it and the edge is part of
   the system being measured; adding it later requires only
   `API_BASE_URL=http://localhost:15001` reruns.
