# CrimeLens k6 Test Suite

Load/performance test infrastructure for CrimeLens. Phase 0 baseline lives in
`Plans/phase-0-k6-baseline/testing-log.md`; re-run these suites after major
system-design phases (especially Phase 15 final comparison) using the same
commands so results stay comparable.

## Prerequisites

- Backend running on `http://localhost:5001` (`npm start` in `db-project-backend`)
- Test data present: zones, crime types, admin user, citizen test account
- A local `.k6.env` next to these scripts (see `.k6.env.sample`) with real
  credentials. This file is **gitignored** — never commit it.

## Setup (every shell session)

```bash
cd db-project-backend/tests/k6
export $(grep -v '^#' .k6.env | xargs)
```

## Suites

| Script | Purpose | Duration |
|---|---|---|
| `smoke-test.js` | Connectivity + login sanity check before long runs | ~5s |
| `runs/baseline.js` | Realistic mixed load: public ramp 0→100 VUs, auth 10 VUs, writes 5 VUs | 16m |
| `runs/stress.js` | Find saturation point: 0→500 VUs ramp, sustained | 17m |
| `runs/spike.js` | Burst behavior + recovery: 50 → 500 → 50 VUs | 7m |

## Running

```bash
# Always write results OUTSIDE db-project-backend/ (nodemon restarts the API
# when watched files change). Use the phase results folder:
OUT=../../..../Plans/phase-X/results   # e.g. Plans/phase-15-k6-final/results
mkdir -p "$OUT"

k6 run --out json="$OUT/baseline-results.json" runs/baseline.js
```

If no per-request JSON is needed, plain `k6 run runs/baseline.js` prints the
summary only (recommended — raw JSON reaches hundreds of MB).

## Analyzing results

Aggregation helpers live in `Plans/phase-0-k6-baseline/results/`:

```bash
node Plans/phase-0-k6-baseline/results/aggregate-results.mjs <run.json>   # per-endpoint p50/p95/p99 table
node Plans/phase-0-k6-baseline/results/spike-phases.mjs <spike-run.json> # per-scenario breakdown
```

## Important notes / known quirks

- The auth endpoint requires `verify_role` in the login body (`auth-login.js`
  handles this).
- Crime report submission requires a **citizen** Supabase token, not an admin
  JWT (`baseline.js` setup obtains one via `citizen-login.js`).
- Coordinate validation on the backend accepts lat 23–26, lng 65–68
  (`helpers.js` random generator matches).
- Scenario option is spelled `gracefulStop` (not `gracefulRampDown`).
