# Phase 11: Horizontal API Scaling

## Objective

Run 1/2/3 backend replicas behind the phase-10 edge, verify shared state
(Redis cache + rate limits across replicas, stateless API), confirm the DB
connection-pool budget holds, and produce a measured 1-vs-2-vs-3 comparison
(k6 + per-instance Prometheus + container CPU/memory) — no pre-written
conclusions.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **`backend1`/`backend2`/`backend3` as three separate compose services are
   obsolete and wrong** — phase 10 established one `backend` service scaled
   with `--scale backend=N` (Docker DNS fans out to all replicas; verified
   live). Three copies = config drift, and the phase-10 edge upstream points
   at `backend`, not `backend1/2/3`.
2. **`env_file: .env` (repo root) does not exist** — secrets live in
   `db-project-backend/.env` and are already wired (phase 9). The plan's
   per-service `environment:` lists re-duplicating every secret repeat the
   exact defect removed from the phase-9 plan.
3. **Scale script calls an undefined `update_nginx_upstream` function** and
   uses v1 `docker-compose` spelling, and misses the phase-10 operational
   rule: OSS nginx resolves upstream DNS at startup, so the edge must be
   restarted after every scale change. Replaced by a minimal correct script
   (scale → restart edge → health-check each replica via its own published
   port).
4. **`analyze-db-pool.js` reads fields tarn does not expose** —
   `pool.max`, `pool.active`, `pool.idle` are undefined on the tarn pool
   (phase-8 lesson: the cap lives at `sequelize.config.pool.max`; live
   counters are methods: `numUsed()`, `numFree()`, `numPendingAcquires()`).
   Script rewritten accordingly.
5. **Step 6's `API_INSTANCES` auto-shrink formula in `config/db.js` is
   dropped** — the pool is already env-driven (`DB_POOL_MAX`, default 10);
   runtime should not silently resize itself based on a variable nothing
   sets. Capacity math belongs in this phase's report, deployment sizing in
   `DB_POOL_MAX`.
6. **DB capacity was assumed at 100** — must be measured live
   (`SHOW max_connections` through the Supabase connection this app uses)
   before declaring `3 × 10 = 30` safe. The measured number goes in the
   report.
7. **k6 scripts targeted `http://localhost:8080`** — stale port; since
   phase 10 all traffic enters via the edge (`:18000` locally through the
   override). The existing k6 lib already takes `API_BASE_URL` from env —
   the scaling scenario reuses `tests/k6/lib/endpoints.js` conventions.
8. **`/api/stats/summary` is a good load target but is rate-limited and
   cached** — a 50/min per-IP app limiter and Redis cache will dominate
   results unless acknowledged. The scenario uses a mixed request profile
   and the report must state which endpoints were cache-hit-dominated.
9. **`check-all-instances.sh` looped N times over one load-balanced URL** —
   that verifies the LB, not each instance. Rewritten to probe each
   replica's direct published port (`15001`–`15003` from the override
   range).
10. **"Expected results" pre-wrote linear scaling numbers (50/100/150
    RPS)** — speculation stated as fact. This phase measures first; the
    report records whatever came out, including sublinear results (shared
    Supabase DB is the expected bottleneck).
11. **"No single point of failure" success criterion is false as written** —
    Redis, the DB, and the edge remain singletons. Correct claim: no
    API-instance SPOF (verified by kill-drill); shared singletons are a
    documented limitation, not solved here.
12. **Shared-state verification was missing** — the core statelessness
    claims get real tests: (a) cache populated via replica A returns
    X-Cache: HIT via replica B; (b) rate-limit bucket shared: a >50 burst
    across the LB 429s even though each replica alone saw ≪50 requests;
    (c) JWT/statelessness stays config-verified (no credentials available).
13. **Prometheus per-instance visibility was ignored** — with N replicas the
    single `backend:5001` target interleaves different replicas' counters.
    Added scrape targets `host.docker.internal:15001/15002/15003` (direct
    published ports from the override range; DOWN targets are harmless when
    unscaled) so `instance` distinguishes replicas.
14. **"Performance scales linearly" as a success criterion is unrealistic** —
    replaced with: measure, compare, and honestly report scaling efficiency
    and the bottleneck.
15. **Results location** — k6 JSON outputs go to
    `Plans/phase-11-horizontal-scaling/results/` (already gitignored by
    `Plans/*/results/*.json`), not loose copies in `tests/`.

## Implementation Steps

### Step 1: `scripts/scale-backend.sh` (new, minimal)

```bash
# Usage: ./scripts/scale-backend.sh <1-3>
docker compose up -d --scale backend=$N
docker compose restart nginx        # re-resolve upstream DNS (phase 10)
# then health-check each replica via its direct port 1500N
```

### Step 2: `scripts/analyze-db-pool.js` (new — tarn-correct)

- Cap from `sequelize.config.pool.max` (not `pool.max`)
- Live usage via `pool.numUsed() / numFree() / numPendingAcquires()`
- Prints `instances × max ≤ measured max_connections` budget table
- Reads `API_INSTANCES` arg; warns when the budget exceeds measured DB capacity

### Step 3: Measure DB capacity live

Connect with the app's own credentials and run `SHOW max_connections;`
(record the number; also record current connection count while 3 replicas
run).

### Step 4: k6 scaling comparison (reuses existing k6 lib)

`db-project-backend/tests/k6/runs/scaling-comparison.js`:

- `API_BASE_URL` from env (edge :18000 locally)
- Constant-VU profile with staged increases, thresholds p95 < 1000 ms,
  error rate < 1% — same style as the phase-0 `baseline.js`
- Mixed public endpoints (types/zones/stats summary) so cache/DB mix is
  representative; report states cache-hit share per run

### Step 5: Run the matrix (edge restarted after EVERY scale change)

```text
--scale backend=1 → k6 run → record
--scale backend=2 → edge restart → k6 run → record
--scale backend=3 → edge restart → k6 run → record
docker stats snapshot per replica (CPU/mem) during each run
```

### Step 6: Shared-state verification (the statelessness proof)

- Cache: request `X-Cache: MISS`-populating endpoint, hit same endpoint
  repeatedly through the LB with 2+ replicas → HITs served possibly by
  another replica (verify via per-instance logs: hits recorded on both)
- Rate limit: with 2 replicas, burst > 50 through the edge → 429
  (a per-instance limiter would NOT trip at that count)
- Config review: JWT (no sessions), Cloudinary uploads (no local files),
  no in-memory app state — recorded in the report

### Step 7: Per-instance Prometheus visibility

`infra/prometheus/prometheus.yml`: add
`host.docker.internal:15001/15002/15003` targets (harmless DOWN when
unscaled). Verify all scaled replicas show UP with distinct `instance`
labels.

### Step 8: Report + logs

Fill `Plans/phase-11-horizontal-scaling/results/scaling-report.md` from
measured data: RPS, p50/p95/p99, error rate, per-replica CPU/mem, DB
connection budget vs measured capacity, load distribution per replica,
scaling efficiency, bottleneck, findings. Keep the implementation/testing
logs per Plans/CLAUDE.md. Scale back to 1 replica and restart edge at the
end.

## Out of Scope

- Auto-scaling / orchestrators (Kubernetes etc. — excluded by CLAUDE.md §14)
- Fixing the singletons (single Redis, single edge, single DB) — documented
  limitation; Redis HA is not a roadmap phase
- Authenticated-endpoint load testing (no test credentials — public
  endpoints only; deferred limitations noted in report)

## Success Criteria

- [ ] `--scale backend=3` runs with all replicas healthy behind the edge
- [ ] Measured 1/2/3 comparison recorded (RPS, P50/P95/P99, errors) —
      including honest sublinearity
- [ ] Load distributed across replicas (per-instance request counts)
- [ ] Kill-drill: removing one replica mid-load causes no client errors
- [ ] Shared Redis cache + shared rate-limit bucket verified across replicas
- [ ] DB connection budget: instances × pool.max ≤ measured max_connections
- [ ] Prometheus shows per-replica instances as distinct UP targets
- [ ] Stack returned to 1 replica; host workflows unaffected

## Files Created/Modified

```
scripts/scale-backend.sh                       (new)
scripts/analyze-db-pool.js                     (new)
db-project-backend/tests/k6/runs/scaling-comparison.js (new)
infra/prometheus/prometheus.yml                (edit — per-instance targets)
Plans/phase-11-horizontal-scaling/results/scaling-report.md (new)
Plans/phase-11-horizontal-scaling/implementation-log.md     (new)
Plans/phase-11-horizontal-scaling/testing-log.md            (new)
```

No application code changes — scaling is configuration + verification +
measurement.

## Rollback

`docker compose up -d --scale backend=1 && docker compose restart nginx`.
The one config edit (extra Prometheus targets) can be reverted; no app
behavior changes.

## Estimated Completion Time

- Scripts + config: 45 min
- Matrix runs (3 × k6) + drills: 1.5–2 h
- Report: 30 min
- **Total: ~3 h**
