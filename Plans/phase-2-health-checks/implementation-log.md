# Phase 2: Health Checks — Implementation Log

## Status: IMPLEMENTED (2026-08-31)

Branch: `dev` (Phase 1 was merged via PR #13; Phase 2 builds directly on it).
Plan: `plan.md` in this folder (scope-reduced design, documented there).

## What Was Implemented

### 1. `controllers/healthController.js` (new)

- **`processHealth`** (GET `/api/health`): process-alive probe. Returns
  `{status:"healthy", timestamp, uptime, version, environment}`. Makes NO database
  call — stays fast and reliable even when dependencies are down. Version is a
  hardcoded `API_VERSION` constant (avoids ESM JSON-import-attribute failure mode;
  original plan's `import {version} from package.json` fails on Node 22 without
  `with { type: "json" }`).
- **`readinessCheck`** (GET `/api/ready`): dependency probe. Uses
  `sequelize.query("SELECT 1")` — a real round-trip — instead of
  `authenticate()` (which can pass off a cached pooled connection). Returns
  200 `{status:"ready", checks:{database:{status:"up", responseTime}, redis:"not_implemented"}}`
  or 503 `{status:"not_ready", checks:{database:{status:"down", message:"Database connection failed"}}}`.
  The redis placeholder keeps Phase 3 extension additive (same response shape).
- **Security correction over original plan**: real `error.message` is logged
  server-side ONLY; the HTTP body carries a generic message. Verified with a
  deliberately credential-bearing fake error (see testing log) — pg connect errors
  can embed connection strings, so exposing `error.message` would leak credentials.

### 2. `routes/healthRoutes.js` (new)

Two routes: `/health` → processHealth, `/ready` → readinessCheck. Nothing else.

### 3. `server.js` (modified)

- Health routes mounted FIRST (before `/api/admin` etc.) so probes stay responsive
  regardless of downstream route issues.
- `app.listen` return value now captured in `server` (was discarded) so shutdown
  can close the HTTP server.
- **Graceful shutdown** (replaces the old bare `unhandledRejection` handler):
  - `gracefulShutdown(signal, exitCode)` with a re-entrancy guard (repeated
    signals are ignored).
  - Awaits BOTH `server.close()` (in-flight requests drain) and
    `sequelize.close()` (pool) via `Promise.all` before exiting. (Self-review
    fix: the plan's sketch fired `process.exit` without awaiting `server.close()`.)
  - Force-exit guard: unref'd 5s timer armed per shutdown; exits(1) if drain/close
    hangs (e.g. DB unreachable). Timer is armed inside the shutdown function, not
    at startup — keeps normal operation clean.
  - Handlers: SIGTERM, SIGINT (exit 0); uncaughtException, unhandledRejection
    (exit 1, routed through the same graceful path).
  - `gracefulShutdown` is exported for testability — on Windows, external
    SIGINT/SIGTERM delivery terminates Node unconditionally (TerminateProcess),
    so signal handlers are not observable from outside; direct invocation is the
    honest way to verify the shutdown sequence on this platform.

## Deliberately NOT Done (per plan's scope decisions)

- No `/healthz`, no `/health/detailed` (duplicates / Phase 8 Prometheus territory).
- No `healthMonitor.js` request-metrics class (process-local state violates the
  statelessness rule Phase 11 depends on).
- No frontend indicator / polling monitor (frontend CLAUDE.md forbids polling
  health endpoints from user-facing components; backend-only phase).
- No new dependencies.

## Validation Executed

```text
node --check (3 files):                        PASS
GET /api/health:                               PASS — 200, correct shape,
                                               median 4ms warm (success criterion <100ms)
GET /api/ready (DB up):                        PASS — 200 ready, database up,
                                               responseTime present (~850-1080ms total,
                                               dominated by remote Supabase round-trip),
                                               redis placeholder present
GET /api/ready (DB down path):                 PASS — unit-style invocation of the real
                                               readinessCheck with a stubbed failing
                                               query: HTTP 503, not_ready, database down,
                                               generic message only
Credential-leak check:                         PASS — planted fake password/host appears
                                               ONLY in server log line, never in HTTP body
Regression (Phase 1 + existing routes):        PASS — /crimes/types 200, /stats/summary 200,
                                               /crimes legacy array, /crimes?page=1&limit=2
                                               paginated envelope, /crimes/all still police-only
Graceful shutdown (real invocation):           PASS — booted real server on :5099, health 200,
                                               invoked gracefulShutdown: "HTTP server closed" +
                                               "Database connection pool closed" +
                                               "Graceful shutdown completed", process exited
ESLint / TS / unit framework / build:          N/A — not configured in backend
Playwright:                                    NOT REQUIRED — backend-only endpoints not
                                               consumed by the frontend (CLAUDE.md §17)
k6:                                            DEFERRED to Phase 15 (user decision)
```

## Known Issues / Follow-ups

1. Readiness latency (~850-1080ms) is dominated by the remote Supabase round-trip —
   fine at orchestrator cadence; Phase 8 (Prometheus) should mind scrape intervals.
2. Windows external signal delivery (SIGINT/SIGTERM from other processes) terminates
   Node unconditionally — graceful shutdown on real signals is fully validated in
   Phase 9 (Docker, where SIGTERM is deliverable). Logic verified by direct invocation.
3. The bogus-DATABASE_URL instance test confirmed existing fail-fast behavior
   (`authenticate()` gate at startup exits 1 before HTTP serves) — the 503 readiness
   branch is therefore only reachable when the DB dies AFTER boot, which is exactly
   the scenario it exists for.
