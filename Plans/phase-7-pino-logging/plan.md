# Phase 7: Pino Structured Logging

## Objective

Replace ad-hoc `console.*` output with structured Pino logging: leveled,
JSON in production / pretty in development, request-ID correlation on every
HTTP request, sensitive data redacted — without changing any business
behavior or API responses.

## What We'll Implement

1. **Pino logger** (`config/logger.js`) — single shared instance
2. **HTTP request logging + request IDs** via `pino-http` (ONE mechanism —
   the old plan had two competing ones)
3. **Structured logging across backend source** — ~85 `console.*` calls in
   21 files (tests/k6/scripts excluded)
4. **Log level by environment** — `LOG_LEVEL` env var, sane defaults
5. **Sensitive data redaction** — header/token paths censored, and a hard
   rule: request bodies are never logged at all

## Audit Corrections vs Previous Plan (why this rewrite)

1. **`uuid` import but never installed** — Step 3 used `uuid` without adding
   it to Step 1's install list. Node 22 has `crypto.randomUUID()`; no
   dependency needed.
2. **Two duplicate request-ID systems** — `pino-http`'s `genReqId` AND a
   separate `requestId.js` middleware both minted IDs (different formats!),
   and the middleware re-childed `req.log` that pino-http had already
   created. One mechanism: `genReqId` (honors incoming `x-request-id` /
   `x-correlation-id`), plus header echo.
3. **`req.path` doesn't exist on Node's raw request object** — the plan's
   `customSuccessMessage` used `req.path`, which is Express-only; pino-http
   receives the raw req → message would read `GET undefined 200`. Use
   `req.url`.
4. **Redact config self-contradiction** — Step 2 set `remove: true` while
   Step 7 set `censor: '***'` (mutually exclusive). Decision: censor with
   `***` for header paths.
5. **`req.body.*` redact paths are dead config** — pino-http never serializes
   request bodies, and controllers must never log them (backend CLAUDE.md §8).
   Body redaction removed; the rule becomes "bodies are not logged", stated
   and enforced by review.
6. **Plan's `unhandledRejection` snippet regressed shutdown** — it replaced
   the existing graceful-shutdown handler (`gracefulShutdown(...)`, with
   force-exit guard and pool close) with a bare `process.exit(1)`. Keep the
   existing handlers; only swap the log call.
7. **Plan's controller rewrite snippet broke the map endpoint** — its
   `getCrimesForMap` example destructured `{ mode, crimeType, zoneId }`,
   silently dropping `startDate/endDate/lat/lng/radius` filters. Controllers
   are NOT restructured — only the logging calls are touched.
8. **`utils/logAnalyzer.js` dropped** — dead code (CLAUDE.md §14): nothing
   calls it; log analysis belongs to `jq`/aggregation tooling. Also it
   guessed field names (`responseTime` as top-level, `err.type`) that don't
   match pino-http's actual output shape.
9. **`queryLogger.js` retired** — the existing dev-only slow-request logger
   is superseded by pino-http's per-request `responseTime` (its own comment
   anticipated this). Remove its usage and the file.
10. **Health-check log spam** — `/health`/`/ready` are polled; without an
    `autoLogging.ignore` they would flood logs. Added.

## Implementation Steps

### Step 1: Install

```bash
npm install pino pino-http pino-pretty
```

`pino-pretty` is loaded only by the development transport config but lives
in regular dependencies (this project runs from source; no build step to
exclude it from).

### Step 2: `db-project-backend/config/logger.js` (new)

Single module exporting:

- `logger` — pino instance:
  - `level`: `LOG_LEVEL` env var, default `debug` in development,
    `info` in production (`NODE_ENV === 'production'` decides; NODE_ENV is
    currently unset everywhere, so default runs are "development")
  - development: `pino-pretty` transport (colorize, `HH:MM:ss`, ignore
    pid/hostname); production: plain JSON lines
  - `timestamp: pino.stdTimeFunctions.isoTime`
  - `redact`: censor `***` on `req.headers.authorization`,
    `req.headers.cookie`, `*.token`, `*.password`, `*.apiKey`,
    `*.passwordHash` paths (defense-in-depth for any future object logging)
  - `base`: `{ service: 'crimelens-api' }` for multi-source aggregation
- `httpLogger` — `pino-http({...})`:
  - `genReqId`: use incoming `x-request-id` / `x-correlation-id` header,
    else `crypto.randomUUID()` (no `uuid` dependency)
  - `customSuccessMessage` / `customErrorMessage` built from
    `req.method` + `req.url` + `res.statusCode` (NOT `req.path`)
  - `customAttributeKeys: { reqId: 'request_id' }`
  - `autoLogging.ignore`: health endpoints (`/api/health`, `/health`,
    `/ready`) so polling does not flood logs
  - serializers: pino-http defaults (include method/url/status/
    responseTime/headers); bodies are never serialized
- `logger.child()` used directly where static context is useful — no custom
  factory wrapper needed.

### Step 3: Request-ID echo — inline, no new middleware file

`pino-http` sets `req.id`. A 3-line middleware in `server.js` right after
`httpLogger` echoes it back:

```javascript
app.use((req, res, next) => {
  if (req.id) res.setHeader("X-Request-ID", req.id);
  next();
});
```

(The old plan's separate `middleware/requestId.js` duplicated ID generation
and is not created.)

### Step 4: `server.js` wiring

- `app.use(httpLogger)` FIRST (before helmet) so every request is timed
  end-to-end; request-ID echo next
- Remove `queryLoggerMiddleware` import + usage; delete
  `middleware/queryLogger.js`
- Replace console calls in startup/shutdown paths (`database connected`,
  `Server running`, shutdown steps, `uncaughtException`,
  `unhandledRejection`) with `logger.info/error` — **handlers keep calling
  `gracefulShutdown(...)` exactly as today**
- `dotenv.config({ quiet: true })` to silence dotenv's [dotenv@17] tip lines
  (stdout noise) — behavior-neutral

### Step 5: Replace `console.*` across backend source (~85 calls, 21 files)

Rules (mechanical, no logic changes):

- Catch blocks: `console.error("X:", err)` → `req.log.error({ err }, "X")`
  where `req` is in scope (pino-http guarantees `req.log` with the
  request ID on every request); infrastructure without request context
  (`config/redis.js`, `services/cacheService.js`, `config/cloudinaryConfig.js`,
  `envValidation.js`) uses the shared `logger`
- Startup/operational notices → `logger.info`; recoverable anomalies →
  `logger.warn`; failures → `logger.error`
- Pass `err` as the first argument (`{ err }` binding / `err` param) so
  pino serializes message + stack — do NOT hand-extract `err.message`
- Never log request bodies, tokens, auth headers (redact config is
  backup, not license)
- `middleware/securityMiddleware.js`: `SECURITY_EVENT` console.warn becomes
  `logger.warn({ eventType, ...details }, "security_event")` — keeps phase 5
  contract, now structured
- `tests/k6/*` and `scripts/syncDb.js` keep console (not part of the server
  runtime)

### Step 6: Environment configuration

- `config/envValidation.js`: add `LOG_LEVEL` to optional vars (warn-default
  list like REDIS_URL)
- `.env-sample`: document `LOG_LEVEL` (dev default `debug`, production
  default `info`)

## Testing

```bash
# 1. Structured request log + request id + response time
curl -s -D - -o /dev/null http://localhost:5001/api/crimes/types
#   Server log: one JSON (or pretty) line with level/time/request_id/
#   req.method/req.url/res.statusCode/responseTime; response carries X-Request-ID

# 2. Correlation: inbound request id is honored
curl -s -D - -o /dev/null -H "X-Request-ID: test-corr-123" http://localhost:5001/api/crimes/types
#   X-Request-ID: test-corr-123 echoed; log line carries the same request_id

# 3. Redaction: trigger a 429/failed login and confirm no Authorization
#    header or password material appears anywhere in server output
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret-token-abc" \
  -d '{"username":"nosuchuser","password":"supersecret123","verify_role":"admin"}'
#   Log line shows the 401/404; 'supersecret123' and 'secret-token-abc' absent

# 4. Health endpoints do not produce request log lines (poll /health 5x)

# 5. Error path: force a validation 400 and a 5xx-capable error (bad JSON body)
#    and confirm error/warn lines carry request_id + err serialization

# 6. Regression: phase 3/4/5 headers + bodies unchanged (X-Cache, X-RateLimit-*,
#    VALIDATION_ERROR shape); grep source for leftover console.* in runtime code
```

## Out of Scope

- Log shipping/aggregation infrastructure (External systems read stdout)
- Prometheus metrics (phase 8), though log lines are structured for it
- `utils/logAnalyzer.js` (dropped — see audit note 8)

## Success Criteria

- [ ] Every request produces exactly one structured log line with
      request_id, method, url, status, responseTime (except health)
- [ ] Inbound `X-Request-ID` honored + echoed; generated IDs are UUIDs
- [ ] No `console.*` left in backend runtime source (tests/scripts exempt)
- [ ] No password/token/auth-header material in any log output (verified by test 3)
- [ ] `LOG_LEVEL` respected; development pretty / production JSON
- [ ] Graceful shutdown behavior unchanged (still uses gracefulShutdown)
- [ ] API responses byte-identical to phase 6 (logging must not alter contracts)

## Files Created/Modified

```
db-project-backend/
├── config/logger.js            (new)
├── server.js                   (modified — httpLogger, echo, startup logs, dotenv quiet)
├── config/envValidation.js     (modified — LOG_LEVEL optional var)
├── .env-sample                 (modified — LOG_LEVEL documented)
├── middleware/queryLogger.js   (deleted — superseded)
├── middleware/securityMiddleware.js (modified — logger.warn)
└── controllers/*, services/*, middleware/*, config/*  (console.* → logger, ~85 sites)
```

## Rollback

Revert `server.js` wiring (remove httpLogger + echo + dotenv quiet) and the
logger import lines; restore queryLogger usage if desired. No schema, cache,
or contract changes involved.

## Estimated Completion Time

- Logger module + wiring: 45 min
- console.* sweep (21 files, mechanical): 1.5–2 h
- Validation + log review: 45 min
- **Total: ~3–3.5 h**
