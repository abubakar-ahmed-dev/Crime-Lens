# Phase 16 — Final k6 Scalability Testing: Implementation Log

Branch: `feature/phase-16-k6-final` · Date: 2026-09-18 · Plan: audited and
rewritten before implementation (12 corrections recorded in plan.md — no
phase-0 baseline exists, wrong endpoints/payloads, guessed rate-limit
numbers, Cloudflare fiction, padded run sizing, etc.).

## Implemented

Test-only phase — zero application code changes.

- `tests/k6/runs/final-comprehensive.js` — 10-min closed-model mixed public
  profile (radius DB-bound reads + cached stats + basic map + types/zones),
  ramping 0→50→100 VUs, thresholds p95<500 / errors<5%. Reuses the phase-0
  lib (`lib/endpoints.js`, `lib/helpers.js`) exactly like phase-11's run.
- `tests/k6/runs/cache-effectiveness.js` — 2-min, 10 VUs on the two cached
  endpoints; declared `cache_hits`/`cache_misses` Rates fed by the
  `X-Cache` header (verified present via curl before authoring); threshold
  hit-ratio > 0.9.
- `tests/k6/runs/rate-limit-final.js` — three lanes against the real
  tiers (config/rateLimiter.js): PUBLIC 51 reads → 429 on the 51st; WRITE
  11 citizen-token requests with deliberately invalid payloads (limiter
  consumes, validation 400s, **no records created**) → 429 on the 11th;
  AUTH 6 bogus logins → 429 on the 6th, run LAST because of the 5-min
  lockout; citizen token fetched in setup() BEFORE the auth lane locks it.
  Thresholds assert exactly one 429 per tier (`count==1`).
- `tests/k6/runs/stress-ceiling.js` — open model (ramping-arrival-rate)
  50→100→150→200→250 req/s, 90 s per stage, 300 pre-allocated / 600 max
  VUs; lenient observation gates (the deliverable is where it breaks).
- Execution harness decisions:
  - measurement runs (comprehensive/cache/stress) with
    `RATE_LIMIT_ENABLED=false` via the local compose override (documented
    there; gitignored) — a single-IP run would otherwise measure the
    limiter, not capacity;
  - limiter force-recreated back ON (`/health` asserted
    `"rateLimiting":{"enabled":true,"mode":"redis"}`) for the rate-limit
    run, and left ON (committed default);
  - evidence: docker stats + Prometheus queries (per-route p95 histogram,
    pool connections, cache hit rate, queue depth) captured before/during/
    after runs into `results/`.

## Post-run script correction

- `rate-limit-final.js` auth lane expected intermediate statuses 401|429;
  the backend answers unknown usernames with **404**
  (controllers/authControllers.js). Tier verification itself was unaffected
  (`auth_429s count==1` passed, and the live lockout was confirmed with a
  manual 429 during the window). The committed script documents
  401|404|429.

## Validation executed

```text
k6 runs:        comprehensive 10 min · cache 2 min · stress 7m45s ·
                rate-limit lanes — all completed; outputs in results/
Lint (backend): n/a — no backend source changed (no repo lint config)
node --check:   n/a — k6 scripts are run by the k6 interpreter, all 4
                executed successfully = parsed and ran
Playwright:     n/a — no user-visible change
```

## Deviations from plan

- Plan's comprehensive success criterion `p95 < 500 ms` was **crossed**
  (measured 3,855 ms) — recorded as the phase's headline finding
  (DB-pool-bound map reads), not suppressed. Errors 0.00% passed.
- Plan sized stress stages at 90 s each; actual run 7m45s + graceful stop —
  matches.
