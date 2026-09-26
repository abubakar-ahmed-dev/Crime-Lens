# Phase 2: Health Checks

> Status: PLANNED (verified 2026-08-31 — no health endpoints exist; phase folder contained only plan.md)
> Branch: reuse `refactor/query-optimization` (current, includes Phase 1 commits `7ed7100` + `45345d3`)
> Depends on: Phase 1 (complete)

## Objective

Add production-style health endpoints (`/health`, `/ready`) for monitoring and
orchestration, designed forward-compatibly so Phase 3 (Redis) extends `/ready` without
redesign. Add graceful shutdown so process exit closes DB connections cleanly.
Backend-only change — no frontend work.

## Scope Decisions (verified current state — these differ from the original plan)

| Original plan item | Verdict | Reason |
|---|---|---|
| 4 endpoints (`/health`, `/ready`, `/healthz`, `/health/detailed`) | **Reduce to 2** (`/health`, `/ready`) | Backend CLAUDE.md §7 defines exactly two concepts: process-alive vs dependencies-ready. `/healthz` duplicates `/health`; `/health/detailed` is system-metrics reporting — that is Phase 8 (Prometheus) work arriving early. Two endpoints, done right. |
| `middleware/healthMonitor.js` (request-tracking metrics class) | **Drop** | Process-local state violates the statelessness rule (CLAUDE.md §8) that Phase 11 horizontal scaling depends on; duplicates the queryLogger timing hook from Phase 1; Phase 8 replaces it with real Prometheus metrics. |
| Frontend `apiHealth.js` + `APIHealthIndicator` (polls /health every 30s) | **Drop from this phase** | Frontend CLAUDE.md §8: "Do not repeatedly poll health endpoints from normal user-facing components unless explicitly required." A polling indicator is a product feature, not infrastructure. Backend-only phase per CLAUDE.md §3. Can be its own mini-phase later if wanted. |
| `import { version } from '../../package.json'` | **Replace with constant** | Backend is ESM (`"type": "module"`, Node v22.16.0 verified) — bare JSON import needs `with { type: "json" }` attributes. Version reporting adds a failure mode for zero current value; use a hardcoded `API_VERSION = "1.0.0"` constant (or omit). |
| `SIGTERM`/`SIGINT` graceful shutdown, close HTTP server + pool | **Keep** | Genuinely required for Phase 9 (Docker `docker stop`) and Phase 11 (rolling deploys). Close order: stop accepting connections → close DB pool → exit. |

## Files to Create

```
db-project-backend/controllers/healthController.js   (processHealth, readinessCheck)
db-project-backend/routes/healthRoutes.js            (2 routes)
```

## Files to Modify

```
db-project-backend/server.js   (mount health routes; graceful shutdown; keep server reference)
```

## Explicitly NOT Changed

- No frontend files (no polling indicator, no apiHealth monitor).
- No `healthMonitor.js` middleware (process-local metrics — Phase 8 concern).
- No new npm dependencies.
- Models, controllers, business logic — untouched. Phase 1 behavior — untouched.

---

## Implementation Steps

### Step 1 — `controllers/healthController.js`

```javascript
import db from "../models/index.js";

const API_VERSION = "1.0.0";

// GET /api/health — process-alive probe. No dependency calls. Always 200
// if the process can respond. Used to know the API is running.
export const processHealth = (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: API_VERSION,
    environment: process.env.NODE_ENV || "development",
  });
};

// GET /api/ready — dependency probe. 200 = can serve traffic; 503 = not ready.
// Phase 2: PostgreSQL only. Phase 3 (Redis) adds a redis check to the same
// response shape without redesign.
export const readinessCheck = async (req, res) => {
  const checks = {
    database: { status: "unknown", responseTime: null },
    redis: { status: "not_implemented", message: "Redis not yet implemented (Phase 3)" },
  };

  let ready = true;
  const started = Date.now();
  try {
    // SELECT 1 proves a live round-trip to the database.
    // (sequelize.authenticate() can pass off a pooled cached connection and
    // does not prove the database still accepts queries.)
    await db.sequelize.query("SELECT 1");
    checks.database = { status: "up", responseTime: Date.now() - started };
  } catch (error) {
    ready = false;
    // Do NOT expose error.message — pg connect errors can embed connection
    // details. Log server-side only; return a generic message.
    console.error("Readiness check: database unreachable:", error.message);
    checks.database = {
      status: "down",
      responseTime: Date.now() - started,
      message: "Database connection failed",
    };
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    timestamp: new Date().toISOString(),
    checks,
  });
};
```

Security notes (CLAUDE.md §9 — never expose credentials):
- The HTTP response contains a **generic** failure message only. The real
  `error.message` goes to server logs — pg connect failures can include host/credentials.
- `/health` and `/ready` expose only: status, timestamp, uptime, version,
  environment string, responseTime. No DATABASE_URL, no hosts, no pool internals.

### Step 2 — `routes/healthRoutes.js`

```javascript
import express from "express";
import { processHealth, readinessCheck } from "../controllers/healthController.js";

const router = express.Router();

router.get("/health", processHealth);  // process-alive probe
router.get("/ready", readinessCheck);  // dependency probe (DB now; + Redis in Phase 3)

export default router;
```

### Step 3 — `server.js` changes

1. Mount health routes FIRST, before the other `/api/*` mounts:

```javascript
import healthRoutes from "./routes/healthRoutes.js";
// ...
app.use(queryLoggerMiddleware);          // existing (Phase 1)
app.use("/api", healthRoutes);           // NEW — before other /api mounts
app.use("/api/admin", adminRoutes);      // existing mounts unchanged
```

2. Keep a reference to the HTTP server (currently the return value of `app.listen`
   is discarded):

```javascript
const server = app.listen(PORT, () => { ... });
```

3. Graceful shutdown — replaces the current bare `unhandledRejection` handler:

```javascript
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received; shutting down gracefully...`);

  // 1. Stop accepting new connections; in-flight requests finish
  server.close(() => console.log("HTTP server closed"));

  // 2. Close the database pool
  try {
    await sequelize.close();
    console.log("Database connection pool closed");
  } catch (err) {
    console.error("Error closing database pool:", err.message);
  }

  process.exit(0);
};

// Force-exit guard: never hang shutdown because the pool won't close
// (e.g. DB already unreachable)
setTimeout(() => {
  console.error("Graceful shutdown timed out; forcing exit");
  process.exit(1);
}, 5000).unref();

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});
```

Notes:
- The `setTimeout(...).unref()` must be registered once at startup (unref'd so it never
  keeps the process alive during normal operation), not inside `gracefulShutdown`.
- Exit codes: 0 for signals; 1 for uncaught exception / timeout.
- `server.close()` waits for in-flight requests; combined with the 5s guard this bounds
  shutdown time. (A `server.closeIdleConnections()` refinement is available on Node 18+
  and may be added if in-flight requests delay shutdown during testing.)

### Step 4 — Validation

| Check | Method |
|---|---|
| Syntax | `node --check` on new/changed files |
| `/api/health` | curl → HTTP 200, `{status:"healthy", uptime, version, environment}`; latency <100ms |
| `/api/ready` (DB up) | curl → HTTP 200, `checks.database.status:"up"` + responseTime, `checks.redis:"not_implemented"` |
| `/api/ready` (DB down) | HTTP 503 + `database.status:"down"`. Proof method: start a second backend instance on port 5099 with a bogus `DATABASE_URL` (env override only — no config file changes), curl it, kill it |
| No wedge after down-state | The normal backend instance still serves all routes normally after a 503 readiness response |
| Graceful shutdown | Kill the dev backend (taskkill /Ctrl+C); observe "HTTP server closed" + "Database connection pool closed" logs; process actually exits (Windows/nodemon signal delivery is unreliable — record honestly what is observable; full signal validation lands with Docker in Phase 9) |
| Regression | Quick curl of `/api/crimes/types`, `/api/stats/summary`, `/api/crimes?page=1&limit=2` (Phase 1 opt-in pagination still intact) |
| ESLint/TS/tests/build | N/A — not configured in backend (unchanged since Phase 1; report honestly) |
| Playwright | Not required — backend-only endpoints not consumed by the frontend (CLAUDE.md §17). Optional browser smoke if the user wants one |
| k6 | Deferred to Phase 15 (user decision, Phase 1 precedent) |

## Success Criteria

- [ ] `/api/health` returns 200 in <100ms and makes NO database round-trip
- [ ] `/api/ready` returns 200 with `database.status:"up"` + responseTime when DB reachable
- [ ] `/api/ready` uses `SELECT 1` (honest round-trip), not `authenticate()`
- [ ] `/api/ready` returns 503 with generic error message when DB unreachable (proven via bogus-URL instance, then cleaned up)
- [ ] No credentials/hosts/error details leaked in health responses
- [ ] Graceful shutdown closes pool with a 5s force-exit guard; no hung processes
- [ ] No frontend changes; no process-local metrics state introduced
- [ ] Existing routes and Phase 1 pagination behavior unaffected (regression curls)
- [ ] Phase logs written; master tracker updated (Phase 2 → Complete)

## Risks & Notes

- **Secret leakage**: pg connect errors can embed the connection string — mitigated by
  generic HTTP messages + server-side-only logging (correction over original plan, which
  returned `error.message` directly).
- `SELECT 1` per readiness call = one Supabase round-trip per probe. Fine at
  human/orchestrator cadence; Prometheus scraping cadence is a Phase 8 consideration.
- Windows + nodemon signal delivery is unreliable; graceful shutdown may only be partially
  observable locally. Document actual observed behavior; complete validation in Phase 9.
- `environment` field reflects `NODE_ENV` (dev/production) — not sensitive.

## Rollback

Remove `app.use("/api", healthRoutes)` and the shutdown handlers from `server.js`;
delete the two new files. Nothing else depends on them. Phase 1 changes are unaffected.
