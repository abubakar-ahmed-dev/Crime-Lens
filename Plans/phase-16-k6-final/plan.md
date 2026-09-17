# Phase 15: Final k6 Scalability Testing

## Objective

Characterize the finished system with real k6 runs against the full compose
stack (edge :18000): a comprehensive mixed-profile run, cache-effectiveness
measurement, rate-limit tier verification, a stress ramp to find the actual
single-host ceiling, and Grafana/Prometheus captured during the runs. The
final report documents measured capability plus an honest phase-by-phase
delivery matrix — **not** a fictional before/after percentage.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **There is no phase-0 baseline to compare against.** The old plan's core
   premise ("Baseline vs. optimized comparison") assumes numbers that were
   never produced: phase 0 built the k6 infrastructure but its
   implementation log shows execution was left as a follow-up;
   `Plans/phase-0-k6-baseline/results/` contains aggregation scripts only.
   The final report replaces before/after percentages with a measured
   capability profile + verified delivery matrix per phase.
2. **`BASE_URL` defaulted to `https://crimelens.example.com`** — the
   deferred-Cloudflare fiction again. Real target: the phase-10 edge at
   `http://localhost:18000` (local override), which is the full production
   shape (edge → static frontend / API pool → Redis → Supabase).
3. **Invented endpoints and payloads.** `/api/crimes/map?page=` (real map
   read is `/api/crimes?mode=basic|radius...`), `/api/crimes/:id` (the real
   detail route is police-only `/api/crimes/get-crime/:id` — a public test
   would just measure 401s), `/api/auth/me` (not an existing route),
   `/api/citizens/report-crime` (real write route is
   `POST /api/user/report-crime` with a citizen JWT), zone *names*
   ("North/South") instead of zone IDs, and crime-type *name strings*
   instead of `crimeTypeId` integers. NYC coordinates (40.7/-74.0) fall
   outside the data's region ( Lahore ≈ 23–26°N / 65–68°E per the existing
   k6 helpers). Fix: the suite reuses the existing, validated phase-0 k6
   lib (`endpoints.js`, `helpers.js`, `scenarios/*.js`) instead of
   reinventing wrong request shapes.
4. **Write/auth scenarios require credentials that may not exist.** The
   `.k6.env.sample` pattern documents citizen/admin credentials; without
   real seeded accounts those scenarios cannot run. Fix: scenarios activate
   only when creds are provided via env; otherwise they are skipped with an
   explicit warning recorded in the report (same honest pattern as
   phases 4–14).
5. **Rate-limit numbers were guessed.** Real tiers (config/rateLimiter.js):
   AUTH 5/min with 5-min lockout, WRITE 10/min, READ 100/min, SENSITIVE
   3/h, PUBLIC 50/min. The rate-limit scenario asserts against these
   actual values per route class (the lockout makes auth probing
   one-shot — verified once, then left to cool down).
6. **Cache-effectiveness script referenced an undeclared custom metric**
   (`cache_hit_rate` threshold with no metric definition — k6 fails to
   start). Fixed: declared `Rate` metric fed by the `X-Cache` header.
7. **Separate scaling-validation script dropped** — phase 11 already
   produced the 1/2/3-instance matrix and the single-host conclusion;
   the final report cites it instead of re-running a weaker version.
8. **compare-results.js was CommonJS with wrong metric paths**
   (`http_reqs_per_second`, `values.count` — the `--summary-export` shape
   is `metrics.http_reqs.{count,rate}`, `metrics.http_req_duration["p(95)"]`,
   `metrics.http_req_failed.value`). Rewritten as ESM against the real
   shape, used to compare the two comprehensive runs (cache ON) with the
   phase-11 single-instance run rather than against a nonexistent baseline.
9. **Report template asserted fiction as fact** — "SSL/TLS Full Strict",
   "DDoS Protection: Cloudflare", "CDN integration" (phase 13 is DEFERRED —
   no domain), "production" environment (no deployment target exists).
   The final report marks these as deferred with their blockers, alongside
   the deferred deployment half of phase 14, and
   real test suites.
10. **Duration/stress sizing was padded** (five 15-minute concurrent
    scenarios, 500-VU stress). Phase 11 showed a single Docker-VM host
    saturates around ~160 req/s closed-model — a 500-VU stress adds no
    information. Sizing: one 10-minute comprehensive run, 2-minute cache
    and rate-limit runs, one staged stress ramp (~8 minutes) to find the
    degradation point. Total execution ≈ 30 minutes plus recovery.
11. **Infrastructure evidence required, not optional.** Prometheus is part
    of the stack now: the runs must capture cache hit rate, DB pool
    connections, queue depth, and per-replica HTTP rates (via the
    per-instance targets from phase 11) as report evidence.
12. **Results location fixed** — `Plans/phase-16-k6-final/results/`
    (already gitignored for JSON), mirroring phase 11.

## Implementation Steps

### Step 1: `db-project-backend/tests/k6/runs/final-comprehensive.js`

Mixed public profile over the existing lib (radius reads via
`getRandomCoordinate` = cache-miss DB path, stats/zones/types = cached path,
`mode=basic` map reads), ramping 0→50→100 VUs over 10 minutes,
BASELINE_THRESHOLDS-style gates (p95<500ms, errors<5%). Optional
authenticated citizen-report lane activated by `K6_CITIZEN_EMAIL/PASSWORD`
(WRITE tier: 10/min per user — VU count and sleep sized to stay under it).

### Step 2: `db-project-backend/tests/k6/runs/cache-effectiveness.js`

2-minute single-lane run on `/api/stats/summary` + `/api/crimes/types`;
declared `cacheHits`/`cacheMisses` Rates from the `X-Cache` header; asserts
hit ratio > 0.9 for stats after warmup (TTL 5 min ≫ run length).

### Step 3: `db-project-backend/tests/k6/runs/rate-limit-final.js`

Verifies actual tiers through the edge: PUBLIC 50/min → 51st = 429;
WRITE 10/min (requires citizen creds, skipped otherwise); AUTH 5/min via
bogus-email logins → 429, then a 5-minute cool-down before anything else
touches the auth limiter (lockout). One IP per lane; documented that the
per-IP publicAPI bucket is shared across public routes (phase-11 lesson) —
lanes use `--separator`-style pacing or distinct windows to avoid
cross-contamination, and the report states exactly what was measured.

### Step 4: `db-project-backend/tests/k6/runs/stress-ceiling.js`

Open-ish staged ramp (ramping-arrival-rate: 50 → 100 → 150 → 200 → 250
req/s, 90s per stage) to locate the actual saturation point and error
onset; documents the ceiling with CPU stats (`docker stats` snapshots) and
the edge's upstream timing logs. Expected degradation consistent with the
phase-11 finding; the report states the number, not a hope.

### Step 5: Execution + evidence capture

- Full stack up via `bash scripts/scale-backend.sh 1` (single host — the
  shipping configuration; 2-replica comparisons cite phase 11).
- Before/after each run: Prometheus queries (cache hit rate, DB pool,
  queue depth, request rate) and `docker stats` snapshots saved into
  `results/`.
- Run matrix: comprehensive → cache → rate-limit (+cool-down) → stress.

### Step 6: `Plans/phase-16-k6-final/results/final-scalability-report.md`

- Measured capability profile (throughput, p50/p90/p95/p99, error rate,
  saturation ceiling)
- Cache effectiveness numbers (per endpoint, hit ratio)
- Rate-limit tier verification table (actual config values vs observed 429s)
- Phase-by-phase delivery matrix: 0–12, 14 verified live (with the phase's
  own validation evidence); 13 Cloudflare + deployment deferred with
  blockers (domain / host)
- Deferred-work roadmap (real test suites, multi-host,
  observability persistence/volumes, alerting)
- Known limits: single-host saturation point, DB budget (60 connections),
  ephemeral containers (no Grafana volume persistence)

## Out of Scope

- Cloudflare/TLS/CDN (deferred, phase 13 — needs a domain)
- Any deployment target (deferred — no host; GHCR images ready)
- Multi-host scaling (phase-11 decision, revisited when hosts exist)
- New feature work discovered by the tests — defects go through the normal
  debugging cycle instead

## Success Criteria

- [ ] Comprehensive run completes with p95 < 500 ms and error rate < 5%
      (public profile, cache ON, single host)
- [ ] Cache hit ratio > 0.9 measured on cached stats endpoints
- [ ] Rate-limit tiers verified: PUBLIC 51st → 429; WRITE 11th → 429 (with
      creds) or skipped+documented; AUTH 6th → 429
- [ ] Stress ramp: saturation point and error onset recorded with CPU
      evidence
- [ ] Prometheus/Grafana evidence captured during runs
- [ ] Final report reflects ONLY measured numbers and honestly-marked
      deferred work
- [ ] Stack restored to 1 replica, everything healthy after tests

## Files Created/Modified

```
db-project-backend/tests/k6/runs/final-comprehensive.js   (new)
db-project-backend/tests/k6/runs/cache-effectiveness.js   (new)
db-project-backend/tests/k6/runs/rate-limit-final.js      (new)
db-project-backend/tests/k6/runs/stress-ceiling.js        (new)
Plans/phase-16-k6-final/results/final-scalability-report.md (new)
Plans/phase-16-k6-final/implementation-log.md, testing-log.md (new)
```

No application code changes — this is the verification phase.

## Rollback

None needed (test-only). Any defect found routes to the debugging cycle of
the owning phase.

## Estimated Completion Time

- Suite authoring: 1.5 h
- Execution + evidence capture: 1 h
- Analysis + final report: 1 h
- **Total: ~3.5 h**
