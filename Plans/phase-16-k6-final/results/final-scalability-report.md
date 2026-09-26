# CrimeLens — Final Scalability Report (Phase 16)

Date: 2026-09-18 · Environment: full compose stack on a single Windows/Docker
Desktop host — nginx edge (:18000) → 1 API replica → Redis (cache + limiter)
→ Supabase Postgres (remote, `max_connections = 60`, measured in phase 11) →
BullMQ worker. k6 v0.2x open/closed model runs against the edge, exactly the
shape production traffic would traverse.

Every number below is measured.

**Correction (2026-09-18):** an earlier version of this report claimed the
Phase 0 baseline was never executed. That was wrong: Phase 0's testing log
records baseline, stress, and spike executions on 2026-08-26, summarized
in `Plans/phase-0-k6-baseline/testing-log.md` — only the large raw JSON
files were deleted after aggregation. The plan's audit correction #1
repeated the same error. A controlled like-for-like rerun of the unmodified
Phase 0 suite against the current stack now lives in
`results/baseline-comparison/` (see its `comparison-report.md`).

---

## 1. Measured capability profile

### 1.1 Comprehensive mixed profile — closed model (100 VUs, 1 s think, 10 min)

Script: `tests/k6/runs/final-comprehensive.js` · limiter OFF (measurement)
· raw: `results/comprehensive-summary.json`, `-run.log`

| Metric | Value |
|---|---|
| Requests | 39,210 (65.2 req/s) |
| Error rate | **0.00%** (all 200s) |
| p50 latency | 12 ms |
| p95 latency | **3,855 ms — threshold p95 < 500 ms CROSSED** |
| p90 latency | 2,753 ms |
| Prometheus, per-route p95 | `/api/crimes` (radius map): **5,704 ms** · `/api/stats/summary`: 19 ms · `/api/stats/crime-trend`: 14 ms · `/api/zones`: 14 ms · `/api/crimes/types`: 13 ms |
| DB pool (Prometheus) | pinned at **10/10** connections for the whole window |
| Backend CPU at load | ~36% (container) |

**Reading:** the system does not fail — zero errors at 65 req/s — but the
latency SLO (p95 < 500 ms) is breached on the DB-bound map-read path. The
cached paths are untouched (13–19 ms at p95). The bottleneck is the
Postgres connection pool (max 10) feeding remote Supabase: randomized
radius queries (cache-miss by construction) queue on 10 slots, and everyone
behind them waits. Node/Docker CPU is not the constraint.

### 1.2 Stress ceiling — open model (ramping arrival 50 → 250 req/s)

Script: `tests/k6/runs/stress-ceiling.js` · limiter OFF · raw:
`results/stress-summary.json`, `-run.log`, per-stage progress in the log

| Stage target | Observed |
|---|---|
| 50 req/s | clean — low VU count, latency in the 100–300 ms band |
| 100 req/s | saturation onset — VU count balloons toward the 600 cap, queueing begins |
| 150–250 req/s | collapse — VUs pinned at 600, arrival rate no longer met |

| Metric | Value |
|---|---|
| Effective ceiling | **~100–110 req/s** (k6 could not push past ~100 iters/s; 35,819 iterations dropped as the ramp exceeded capacity) |
| Latency under overload | p90 28.6 s, p95 29.6 s, max 60 s (client timeout) |
| Errors | 0.098% (22 timeout-type failures) — the system degrades by queueing, not by crashing |

**Reading:** with a 40% DB-bound mix, the honest single-host ceiling is
~100 req/s, and comfort ends well before that. This is *lower* than the
phase-11 number (~160 req/s) because the phase-11 mix was cache-dominated;
the ceiling is set by the DB pool, not the web tier. Consistent across both
models: **the database path saturates first, at every replica count.**

### 1.3 Cache effectiveness — 2-min probe on cached endpoints

Script: `tests/k6/runs/cache-effectiveness.js` · raw:
`results/cache-summary.json`, `-run.log`

| Metric | Value |
|---|---|
| Cache hit ratio | **100.00%** after warmup (4,404 hits / 10 warmup misses; threshold > 0.9 ✓) |
| p95 latency on cached path | 41 ms |
| Errors | 0.00% |
| Prometheus `crimelens_cache_hit_rate` (end of session) | 0.95 on the stats lane; ~0.71 blended (radius cache-misses by design) |

Phase 3's cache-aside does exactly what it was built to do: a 5-min TTL
turns a ~200–800 ms Supabase round trip into a ~15 ms Redis/Node round
trip, and the hit ratio is effectively perfect under sustained load.

### 1.4 Rate-limit tier verification — limiter ON (Redis-backed)

Script: `tests/k6/runs/rate-limit-final.js` · raw:
`results/rate-limit-summary.json`, `-run.log`

| Tier (config) | Probe | Observed |
|---|---|---|
| PUBLIC 50/min per IP | 51 reads | **429 exactly on the 51st** (`public_429s count==1` ✓) |
| WRITE 10/min per IP | 11 citizen-token requests, deliberately invalid payloads (validation 400s — no records created) | **429 exactly on the 11th** (`write_429s count==1` ✓) |
| AUTH 5/min per IP + 5-min lockout | 6 bogus logins (unknown user → 404) | **429 on the 6th** (`auth_429s count==1` ✓); lockout confirmed live: a manual follow-up login got 429 during the window |

Note recorded honestly: the auth lane's intermediate-status assertion in
the script expected 401 only; the backend actually answers unknown
usernames with 404 (authControllers.js). The tier check (`count==1`) was
unaffected; the script's expected-status list was corrected post-run — the
committed version documents 401/404/429.

### 1.5 Queue health during the session

`crimelens_queue_depth` (Prometheus): `cloudinary-deletion` — 0 waiting,
0 active, 3 completed, 1 failed (the failed job is a pre-existing artifact
of phase-12 failure-path testing, not from this session).

---

## 2. Phase-by-phase delivery matrix

| Phase | Scope | Status | Verified by |
|---|---|---|---|
| 0 | k6 baseline infrastructure | Done (executed 2026-08-26; raw JSONs deleted after aggregation; rerun against the current stack in `baseline-comparison/`) | this phase's runs reuse the lib |
| 1 | Postgres/Sequelize optimization + pagination | Done | phase-1 logs; pool env-driven (max 10) measured here |
| 2 | Health checks | Done | `/health` live in every run here |
| 3 | Redis caching | Done | **100% hit ratio measured (§1.3)** |
| 4 | Redis-backed rate limiting | Done | **all 3 tiers + lockout verified live (§1.4)** |
| 5 | API security hardening | Done | phase-5 logs (helmet, validation, CORS) |
| 6 | HTTP compression | Done | phase-6 logs |
| 7 | Pino structured logging | Done | phase-7 logs; request IDs in smoke logs |
| 8 | Prometheus + Grafana | Done | metrics cited throughout this report |
| 9 | Docker | Done | the stack under test is the compose stack |
| 10 | Nginx edge | Done | all traffic here traversed the edge |
| 11 | Horizontal scaling | Done (1 host) | 1/2/3-instance matrix in phase-11; finding stands: shared DB pool bounds scale-out on one host |
| 12 | BullMQ workers | Done | queue depth metrics live (§1.5) |
| 13 | Cloudflare (TLS/CDN) | **Deferred** | blocker: no custom domain (~$10/yr) |
| 14 | GitHub Actions CI/CD | Done | 12/12 green on PR #25; GHCR images pushed; release automation proven |
| 15 | Frontend lint cleanup + CI enforcement | Done | 83→0 lint errors; enforcing lint job green on dev |
| 16 | Final k6 scalability testing | Done | this report |

## 3. Known limits (measured, not speculative)

1. **DB connection pool is the global ceiling.** Pool max 10 (single
   replica) pins at 10/10 under load; the DB-bound path breaches the p95
   SLO beyond roughly 50 req/s arrival. Supabase allows 60 connections:
   there is headroom for ~3–4 replicas worth of pool *budget*, but on one
   shared host phase-11 showed replicas only split the same CPU/DB
   contention. The next real capacity lever is DB-side: raise pool max,
   index/tune the radius query, or cache radius reads.
2. **Single-host ceiling ≈ 100–110 req/s** on a cache-inclusive mix; ~160
   req/s on a cache-dominated mix (phase-11).
3. **Graceful degradation:** 0.1% errors at 3× overload; the stack queues
   and slows, it does not fall over. Rate limiting (when ON) sheds the
   first wave of abuse before the pool ever sees it.
4. **Ephemeral infra:** Grafana has no persistent volume; dashboards reset
   on stack recreation.

## 4. Deferred-work register (honest gaps)

- **Cloudflare phase 13** — needs a domain (then: proxied TLS, WAF, CDN).
- **Deployment** — needs a host; GHCR images (`crimelens-backend`,
  `crimelens-frontend`) are built and published by CI, ready to pull.
- **Real test suites** (jest/vitest) — CI currently relies on the live
  smoke boot + syntax sweep.
- **The 13 `exhaustive-deps` warnings** — accepted lint debt from phase 15.
- **Multi-host scaling** — revisited when separate hosts exist.
- **DB radius-query tuning** — the measured bottleneck; a focused follow-up
  (EXPLAIN ANALYZE + index) would move the ceiling more than any web-tier
  change.
