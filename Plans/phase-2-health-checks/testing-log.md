# Phase 2: Health Checks — Testing Log

## Testing Record — 2026-08-31

Environment: Windows 10 Pro, main dev backend on :5001 (nodemon, hot-reload),
remote Supabase PostgreSQL. Secondary test instances on :5099 (isolated, killed
after tests). Test scripts and runners executed from temp directory (nodemon-
restart hazard documented in Phase 0).

## Test Results

### Static

```text
node --check healthController.js / healthRoutes.js / server.js:  PASS
ESLint / TypeScript / unit framework / build:                    N/A — not configured
```

### Endpoint Tests (scripted, live backend :5001)

```text
/health: HTTP 200                                          PASS
/health: response shape (status/timestamp/uptime/version/environment,
         no unexpected keys)                               PASS
/health: latency <100ms                                    PASS — first cold request 103ms
         (connection setup); warm median 4ms across 5 samples
/ready:  HTTP 200 when DB reachable                        PASS
/ready:  status "ready", database "up" + numeric responseTime,
         redis "not_implemented" placeholder               PASS
/ready:  no credentials/hosts in response body             PASS (asserted absence of
         postgres://, supabase.co, password substrings)
```

### DB-Down (503) Path

Direct HTTP test impossible: the existing startup gate (authenticate → exit 1)
refuses to boot without a DB (verified with a bogus-DATABASE_URL instance on
:5099 — correctly failed fast with ENOTFOUND before serving). The 503 branch
was therefore tested by invoking the REAL readinessCheck with a stubbed failing
sequelize.query:

```text
readinessCheck with DB failure:                            PASS — HTTP 503,
         status "not_ready", database "down", responseTime present
Credential-leak test (planted fake password + host in the simulated pg
error, the form pg connect errors actually take):          PASS — full error in
         server-side log ONLY; HTTP body contains generic
         "Database connection failed" message exclusively
```

### Graceful Shutdown

First attempt (external `child.kill('SIGINT')` from a spawner script): the
process died in 41-85ms with NO shutdown logs and exit code null — confirming
the documented Windows limitation: cross-process SIGINT/SIGTERM terminates Node
unconditionally (TerminateProcess); handlers are not invoked. Recorded honestly
as a platform limitation, not a code defect (plan §Risks anticipated this).

Verification method: exported `gracefulShutdown` from server.js (export is
production-code change documented in implementation log) and invoked the real
function in a booted server instance on :5099:

```text
Boot on :5099, GET /health → 200                           PASS
Invoke gracefulShutdown("TEST_SHUTDOWN"):                  PASS
  Log sequence: "TEST_SHUTDOWN received" →
  "HTTP server closed" →
  "Database connection pool closed" →
  "Graceful shutdown completed"                            ALL PRESENT
Process exited (runner's post-shutdown code never ran —
  process.exit inside gracefulShutdown worked)             PASS
Force-exit guard: armed unref'd per shutdown (cannot keep
  event loop alive); not exercised live (would require a
  hung pool close; logic reviewed, timing verified by code) DOCUMENTED
Full signal-path validation (real SIGTERM in Docker):      DEFERRED to Phase 9
```

### Regression (existing functionality)

```text
GET /api/crimes/types                       200             PASS
GET /api/stats/summary                      200 + keys      PASS
GET /api/crimes                             legacy array    PASS (Phase 1 parity)
GET /api/crimes?page=1&limit=2              envelope        PASS (Phase 1 pagination)
GET /api/crimes/all (unauthenticated)       403             PASS (auth intact)
```

## Not Executed (with reason)

```text
Playwright:            NOT REQUIRED — backend-only endpoints, no frontend consumer
                       (backend CLAUDE.md §17). No user-visible behavior changed.
k6:                    DEFERRED to Phase 15 (user decision, Phase 1 precedent).
/live, /healthz,
/health/detailed:      NOT BUILT — scope-reduced per plan (documented there).
```

## Issues Found During Testing

1. (Test-side) First latency check measured cold connection setup (103ms) —
   re-measured warm: median 4ms. No implementation issue.
2. (Test-side) Cross-process SIGINT kill produced no shutdown logs — Windows
   platform behavior, not an implementation bug; verified via direct invocation
   instead (above).
3. (Implementation, fixed during self-review before testing) `server.close()`
   was fired but not awaited — shutdown could exit while requests drained.
   Fixed to `Promise.all([serverClosed, poolClosed])` before exit.

## Final Testing Status — Phase 2

All executable validation PASSED. No regressions. Graceful-shutdown signal-path
validation deferred to Phase 9 (Docker) with the logic itself verified by direct
invocation on Windows.

Status: PHASE 2 TESTING COMPLETE.
