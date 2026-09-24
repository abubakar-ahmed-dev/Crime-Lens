# Baseline Comparison — Testing Log

Rerun executor record · 2026-09-18 · All commands executed against
`API_BASE_URL=http://localhost:18000` (nginx edge). Credentials loaded from
the local gitignored `db-project-backend/tests/k6/.k6.env` into the shell
per run; never printed, never committed.

## Pre-run verification

- All 10 k6 scripts (`runs/baseline|stress|spike.js`, `scenarios/*`,
  `lib/*`, `smoke-test.js`) diffed against commit `a112370`:
  **byte-identical** — no workload, threshold, or payload changes needed.
- Contract compatibility re-verified against current backend: phase-0
  report payload passes current `crimeReportSchema` (zod), citizen login
  response shape matches (`session.access_token`), `verify_role` accepted.
- Stack: 1 backend replica (forced), limiter OFF via local override
  (`"rateLimiting":{"enabled":false,"mode":"redis"}` asserted via
  `/health`), app-cache keys flushed (patterns `crimelens:stats:*`,
  `crimelens:reference:*`, `crimelens:crimes:*`) — BullMQ (`bull:*`) and
  limiter namespaces untouched. Cold start: 0 `crimelens:*` keys.
- Environment + dataset recorded in `environment.md`.

## Execution (original order, cooldowns between runs)

| # | Run | Window (PST) | Result |
|---|---|---|---|
| 1 | smoke-test.js | 11:38–11:39 | PASS 6/6 checks (incl. admin login) |
| — | baseline attempt (aborted) | 11:40 | k6 exit 127 — raw-output directory missing (operator error, 0 requests). Log kept: `aborted-baseline-console.log`. Cache re-flushed to 0 keys before retry. |
| 2 | baseline.js | 11:49–12:05 (16m) | 53,972 reqs, 55.4 req/s, p95 655 ms (p95 gate crossed — preserved), 0.006% errors, checks 99.26% |
| — | cooldown | 12:05–12:08 (3m) | `/health` healthy, `/ready` db+redis up (recorded in `cooldown-after-baseline.log`) |
| 3 | stress.js | 12:09–12:26 (17m) | 289,121 reqs, 282.2 req/s, p95 2.8 s, 0.00% errors, checks 93.27% |
| — | cooldown | 12:26–12:29 (3m) | healthy + ready (recorded) |
| 4 | spike.js | 12:29–12:37 (7m) | exit 0 — thresholds passed; normal/spike/recovery p50 18/181/19 ms; 31 spike failures (0.06%) |

## Evidence captured per run

- Console log with start/end timestamps (exit codes in-file)
- Compact `--summary-export` JSON + full `--out json=` raw (gitignored,
  1.5 GB total, SHA-256 in `raw-checksums.txt`)
- Per-endpoint aggregation via the phase-0 `aggregate-results.mjs`:
  `baseline-per-endpoint.txt`, `stress-per-endpoint.txt`,
  `spike-per-endpoint.txt`; spike per-scenario via `spike-phases.mjs` →
  `spike-per-phase.txt`
- Prometheus during runs (corrected label queries, 10m/5m windows):
  `evidence-baseline-mid.txt` (pool used max 10, avg 1.15, waiting max 8;
  request rate 43.4 req/s at minute ~4), `evidence-stress-mid.txt` (used
  max 10, avg 4.95), `evidence-spike-mid.txt` (backend CPU 106.8%)
- docker stats snapshots in the same evidence files

## Post-suite state

- Limiter restored ON, backend force-recreated, `/health`
  `"rateLimiting":{"enabled":true,"mode":"redis"}`, `/ready` db+redis up,
  1 replica healthy (`post-suite-state.txt`).
- Write-lane reports: 263 attempts → **261 created** (status=pending), 2
  failed — left in place, none deleted (policy: explicit approval
  required). Public approved-crime totals unchanged by the runs (pending
  reports don't enter public reads).

## Comparison report

`comparison-report.md` — separates directly comparable results,
per-endpoint deltas, per-path improvement attribution, confirmed
improvements, remaining bottlenecks, and limitations; corrects the earlier
phase-16 claim that Phase 0 was never executed.

## Status

All four planned executions completed with full evidence. No threshold was
altered; both crossing thresholds (baseline p95) are preserved and
reported as measurements.
