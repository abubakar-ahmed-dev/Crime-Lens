# Phase 7 — Pino Structured Logging: Implementation Log

## Status: Implemented & Validated

## What Was Implemented

- `config/logger.js` (new) — shared pino instance + pino-http wrapper:
  - level from `LOG_LEVEL`, default `debug` (development) / `info`
    (`NODE_ENV=production`)
  - pretty transport in development, raw JSON lines in production,
    `base: { service: 'crimelens-api' }`, ISO timestamps
  - redact `***`: `req.headers.authorization`, `req.headers.cookie`,
    `*.password`, `*.passwordHash`, `*.token`, `*.apiKey`
  - `httpLogger`: `genReqId` honors inbound `x-request-id` /
    `x-correlation-id`, else `crypto.randomUUID()` (no `uuid` dependency);
    `customAttributeKeys.reqId = 'request_id'`; `autoLogging.ignore` for
    `/api/health`, `/health`, `/ready`; success/error messages use
    `req.originalUrl || req.url` (see findings)
- `server.js` — `httpLogger` mounted FIRST (end-to-end timing) + 3-line
  `X-Request-ID` echo middleware; startup/shutdown/uncaught handlers log via
  `logger` and keep calling `gracefulShutdown(...)` unchanged;
  `dotenv.config({ quiet: true })` everywhere (silences dotenv tip noise)
- `middleware/queryLogger.js` DELETED — superseded by pino-http's
  per-request `responseTime`
- `middleware/securityMiddleware.js` — phase 5 security events now emit as
  `logger.warn({...}, "security_event")` (structured, same fields, no JSON
  stringifying)
- console.* sweep — 45+ sites replaced across: controllers (agent, crime,
  health, media, auth, citizenAuth, stats, zone, Branch), services
  (cacheService), middleware (auth, rateLimiter, cacheDecorator), config
  (redis, cloudinary, envValidation), utils (apiResponse). Catch sites with a
  request in scope use `req.log` (carries request_id); infrastructure uses
  the shared `logger`; errors passed as `{ err }` bindings; Cloudinary
  "non-critical" deletions logged at `warn`. Tests/k6/scripts keep console.
- `config/envValidation.js` + `.env-sample` — `LOG_LEVEL` optional var
  documented

## Key Findings / Deviations from Plan

1. **Express 5 strips raw `req.url` under mounted routers** — the plan's
   `customSuccessMessage(req.url)` produced `GET /types 200 completed` for
   `/api/crimes/types` (found live; the req SERIALIZED binding kept the full
   url, only the message was wrong). Fixed with `req.originalUrl || req.url`
   — messages now read `GET /api/crimes/types 200 completed`.
2. **dotenv tips persisted after server.js quiet fix** — every config module
   calls its own `dotenv.config()` (needed for import-time env reads), each
   printing tips. All four call sites (server, db, redis, cloudinary,
   multerMediaConfig) now pass `{ quiet: true }`.
3. **Plan's separate `middleware/requestId.js` not created** — duplicated ID
   generation against pino-http's `genReqId` and used the uninstalled `uuid`
   package; replaced by an inline 3-line header-echo after `httpLogger`.
4. **Plan's `logAnalyzer.js` not created** (dead code, wrong field shapes) —
   audit correction, see plan.
5. **Bodies are never logged** — no serializer emits `req.body`; the plan's
   `req.body.*` redact paths were dead config and were replaced by the
   stronger convention (nothing can log what is never serialized).
6. One commented-out block in `CrimeControllers.js` retains its original
   console line inside comments (not runtime code).

## Validation Performed

- `node --check` on all 20 touched files: PASS
- Runtime console sweep grep: zero `console.*` left in backend runtime
  source (tests/scripts exempt; one commented line excepted): PASS
- Boot (:5092, development) — pretty, leveled startup logs; dotenv noise gone
- Request logging: one line per request with `request_id`, full
  `req.method/req.url`, status, `responseTime`, serialized req/res: PASS
  (`{"level":30,...,"req":{"id","method","url"},...,"responseTime":18,"msg":"GET /api/crimes/types 200 completed"}`)
- Correlation: inbound `X-Request-ID: test-corr-123` → echoed header +
  `"id": "test-corr-123"` in log line: PASS
- Redaction: login attempt with `password: "supersecret123"` and
  `Authorization: Bearer secret-token-abc` → neither string anywhere in
  server output (grep count 0): PASS
- Health silence: 3 × `/api/health` polls → zero request log lines: PASS
- `LOG_LEVEL=warn` instance: info-level request lines suppressed: PASS
- `NODE_ENV=production` instance: raw JSON lines (no pretty transport): PASS
- Regression (:5092): phase 3 `X-Cache: MISS/HIT`, phase 4
  `X-RateLimit-Limit/Remaining`, phase 5 validation gates + 401s on
  report-crime / crime update (PUT) all intact: PASS

## Not Executed (with reason)

- Playwright: logging-only change, no frontend or contract behavior change
  (CLAUDE.md §17 lists logging changes as not requiring browser validation);
  additive `X-Request-ID` response header is invisible to UI flows
- k6 / Prometheus: not in this phase
- ESLint / TypeScript: no backend ESLint config; plain JS (pre-existing gap)

## Notes for Testing Agent

- `X-Request-ID` is a NEW response header on every request — additive; not
  added to CORS `exposedHeaders` (browser JS does not need it). Revisit only
  if the frontend ever displays trace IDs.
- Development default level is `debug` — noisier than before by design.
  Set `LOG_LEVEL=info` to trim.
- The `req.headers` block in production request lines includes user-agent
  etc.; `authorization`/`cookie` are redacted. If new sensitive headers are
  ever introduced, extend the redact list in `config/logger.js`.
- Multiple dotenv `config({ quiet: true })` calls across config modules are
  intentional (import-time env reads in standalone contexts).
