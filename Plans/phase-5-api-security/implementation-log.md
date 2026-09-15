# Phase 5 — API Security Hardening: Implementation Log

## Status: Implemented & Validated (API + browser)

## What Was Implemented

### New files

- `db-project-backend/validators/schemas.js` — Zod 4 schemas matching the REAL
  API contracts (verified against frontend callers + controller logic):
  `loginSchema` (+ `verify_role`), `citizenRegisterSchema`, `citizenLoginSchema`,
  `googleAuthSchema`, `crimeReportSchema` (string coordinates via `z.coerce`,
  optional `title`, optional `zone` with `""` → undefined),
  `crimeUpdateSchema` (incl. `mediaOperations` passthrough), `mapQuerySchema`
  (all real map filter params), `paginationQuerySchema`, `statsQuerySchema`
  (`YYYY-MM-DD` date inputs, `""` → undefined), `zoneSeverityQuerySchema`,
  `agentRequestSchema`, `branchCreateSchema`.
- `db-project-backend/middleware/validationMiddleware.js` —
  `validate(schema, target)`: `body` target REPLACES `req.body` with parsed,
  unknown-key-stripped data; `query`/`params` targets are GATE-ONLY (reject
  invalid with 400, never write back — Express 5 `req.query` is a read-only
  getter, assignment throws). 400 shape:
  `{ success:false, message:"Validation failed", code:"VALIDATION_ERROR",
  errors:[{field,message}] }`.
  `sanitizeInput`: global, mutates string values of `req.body`/`req.query` IN
  PLACE (Express 5-safe), stripping `<script>` blocks, `javascript:` URIs and
  inline `on*=` handlers; logs `INPUT_SANITIZED` security event when it fires.
- `db-project-backend/middleware/securityMiddleware.js` —
  `logSecurityEvent(eventType, req, details)`: structured console.warn events
  (`SECURITY_EVENT {...}`), metadata only (ip/method/path/field names — never
  bodies/tokens). Ready for Pino (phase 7) / Prometheus counters (phase 8).

### Modified files

- `server.js` — helmet 8 (`frameguard: DENY`, referrer-policy
  `strict-origin-when-cross-origin`, CORP `cross-origin` so media-thumbnail
  redirects stay embeddable; everything else helmet defaults incl. CSP, HSTS
  1y+subDomains, nosniff, X-Powered-By removal);
  `express.json({ limit: "1mb" })` (413 on excess JSON; multipart still
  bounded by multer: media 5MB/file, CSV 1MB); global `sanitizeInput`; CORS
  hardened with `allowedHeaders`, `maxAge: 86400`, and `exposedHeaders`
  (`X-Cache`, `X-RateLimit-*` — browser JS could not read these before).
  Origin allow-list unchanged (array form: unlisted origins simply get no
  ACAO header).
- Routes (validation placed after auth → rate limit, before controller):
  `authRoutes.js` (login), `citizenAuthRoutes.js` (register/login/google-auth),
  `userRoutes.js` (report-crime), `crimeRoutes.js` (`/` map query gate,
  `/all` pagination gate, `update/:id` body), `statsRoutes.js` (4 endpoints,
  query gate), `zoneRoutes.js` (severity query gate), `agentRoutes.js`
  (`/request` body), `adminRoutes.js` (`POST /branches` body).

## Key Implementation Decisions / Deviations from Plan

1. **Login schema requires `verify_role`** — plan's `loginSchema`
   (username/password only) would 400 every real login; frontend sends
   `{username, password, verify_role: "admin"|"police"}` (verified in
   `LoginAdminPolice.tsx` / `services/api.ts`). Legacy display names
   ("Administrator", "Police Agent") also accepted (controller maps them).
2. **Express 5 `req.query` is a getter** — plan's middleware REPLACES
   `req.query` with validated data, which throws in strict-mode ESM. Query
   validation is therefore gate-only; controllers keep reading original
   string values. `req.body` replacement is safe (writable own property).
3. **Report/crime schemas tolerate the frontend's actual types** — the report
   form sends latitude/longitude/zone/crimeTypeId as STRINGS (React state of
   form inputs), so numeric fields use `z.coerce` with `"" → undefined`
   preprocessing (`Number("") === 0` would otherwise pass coerce validation).
   Plan's strict `z.number()` would have rejected every citizen report.
4. **Report `title` optional** — controller defaults `title || "Untitled
   Crime"`; plan's required `min(3)` would break title-less reports.
5. **`crimeUpdateSchema` includes `mediaOperations`** — plan omitted it, so
   its body-replacement would silently strip police media updates
   (visibility/caption/evidence/toRemove). Real shape validated, unknown
   keys stripped.
6. **Map query schema has all real params** — plan applied a
   pagination-only schema to `GET /api/crimes`, whose replacement would strip
   `mode/crimeType/zoneId/startDate/endDate/lat/lng/radius` and break the map.
7. **Stats dates are `YYYY-MM-DD`** — frontend uses `<input type="date">`
   values; plan's `z.string().datetime()` (full ISO) would reject them, and
   empty-string params (axios sends `start=`) are treated as absent.
8. **No `express-validator`** — plan Step 1 installs it alongside Zod but the
   implementation uses only Zod; second validation library = dead dependency.
9. **No `limitRequestSize` middleware** — plan's Content-Length check is
   redundant: `express.json({limit})` caps JSON, multer caps uploads, and
   Content-Length is client-controlled (chunked encoding bypasses it).
   Global JSON limit loosened from Express' 100kb default to 1mb
   intentionally (plan's target) — report-crime JSON with mediaData fits.
10. **Helmet 8 reality vs plan** — `xssFilter`/`hidePoweredBy` options no
    longer exist (silently ignored in 8.3; verified empirically). helmet()
    already removes X-Powered-By and sends `X-XSS-Protection: 0`
    (browsers deprecated the auditor); CSP is the real mitigation. Plan's
    custom CSP directives replaced by helmet defaults (stricter for a JSON
    API). HSTS `preload` deliberately NOT set (irreversible list submission;
    revisit with a production domain).
11. **No runtime SQL scanner (`utils/sqlSafety.js`)** — regex-scanning query
    strings adds no protection (values are parameterized at the driver).
    Instead an AUDIT was performed: every user value reaches Postgres via
    Sequelize `:named` replacements or ORM models; the only `${...}` content
    inside SQL templates is code-built fragments (`conditions.join`,
    static `mediaLimit`, numeric `createdMedia.length`). No user input is
    ever interpolated into SQL. Audit PASS; documented here instead of
    shipping dead code (CLAUDE.md §14).
12. **No blocking `monitorAbuse` middleware** — plan Step 9 would
    JSON.stringify every body and 400 on `<script`/`union select` patterns.
    On a crime-reporting app, report TEXT legitimately contains such strings
    (users describe scams/attacks) → false-positive blocking of real reports;
    plus per-request cost. Replaced by the non-blocking security event log
    (`logSecurityEvent`) on validation blocks and sanitize hits.
13. **Endpoints intentionally left without Zod** (documented, not missed):
    `POST /api/zones/:id/contains` (fails soft today: returns
    `{inside:false}` 200, a 400 would be a behavior change), media multipart
    endpoints (multer validates files; `captions`/`crimeId` handled in
    controller), `approve/reject` (complex composite bodies, controller
    validates coordinates/zone itself), admin `assignBranchHead` /
    `createPoliceAgent` (outside plan's scope list).
14. **No global error handler added** — express.json's 413 error surfaces via
    Express' default handler (HTML body, stack logged in dev only).
    Pre-existing multer errors behave the same way; a unified JSON error
    handler is a follow-up, not smuggled into this phase.

## Validation Performed (Implementation Agent)

- `node --check` on all 12 created/modified files: PASS
- helmet 8 option probe: `xssFilter`/`hidePoweredBy` options accepted but
  no-ops (evidence for deviation 10)
- Harness (real middleware + route modules, no DB) — **48/48 PASS**:
  schema units (login verify_role, string-coordinate reports, coerce,
  unknown-key stripping, `""` handling, impossible calendar dates,
  mediaOperations survival, stats date formats), sanitizeInPlace units,
  security headers (nosniff / frame DENY / HSTS / CSP / no X-Powered-By /
  CORP / referrer-policy / X-XSS-Protection 0), CORS (allow-list, no ACAO for
  foreign origins, preflight, authorization header), validation gates
  (400 + VALIDATION_ERROR shape before controllers; valid shapes pass through
  to controllers), auth ordering (401 before validation on report-crime,
  update, branches), 2MB JSON → 413, health unaffected
- Real server boot (port 5092, Supabase + Redis connected) — **12/12 PASS**:
  security headers + `X-RateLimit-*` + `X-Cache` MISS→HIT coexist on one
  response; expose-headers CORS visible; stats/map/zone valid-filter 200s;
  bad date 400; login 400 shape; valid-shape login reaches DB (404);
  401s preserved (report-crime, update, media); citizen register bad email
  400; zones contains unchanged (200 soft-fail path)
- Regression: crime types payload intact; cache keys unaffected (validation
  is gate-only, query never rewritten → phase 3 cache keying unchanged)

## Not Executed (with reason)

- ESLint / TypeScript: backend has no ESLint config and is plain JS
  (pre-existing gap, unchanged from phases 3–4)
- Playwright: pending — validation middleware affects user-facing forms, so
  browser flows (login, report form, map filters) must be re-verified against
  the restarted backend before final sign-off (requires user to restart the
  :5001 instance onto the new code)
- k6: not applicable this phase (no load-behavior claim made)

## Playwright MCP Validation (PASS)

Against the user's restarted :5001 backend (phase 5 code) + :5173 frontend:

- **Map**: loads with markers; Theft filter + Search refetches
  (`/api/crimes?mode=basic&crimeType=Theft` 200) and displayed markers change;
  Highlight Zones renders severity overlays (`/api/zones/severity` 200,
  including the trailing-empty-query form)
- **Statistics**: summary cards populated; 3 charts render; the frontend's
  empty-string params (`start=&end=`) pass the gate (the exact regression the
  `"" → undefined` preprocessing prevents); real date range (2024-01-01 →
  2026-12-31) refetches 200
- **Admin login**: role selection → wrong-credentials submission reaches the
  backend as a valid shape (404 "User not found") and the message renders in
  the form — the validation gate did NOT swallow or misclassify it
- **Citizen**: /report-crime redirects unauthenticated visitors to
  /login-citizen; wrong-credentials citizen login → 401 "Invalid credentials"
  rendered
- Console errors observed were only the expected 401/404 XHR noise

## Notes for Testing Agent

- `sanitizeInput` runs GLOBALLY before route validation: an XSS payload in a
  date field becomes `""` → treated as absent → 200, not 400. Gate tests
  should use non-XSS garbage ("garbage", "not-a-date") to assert 400s.
- Rate-limit + Redis keys shared with the user's running instance — flush
  `crimelens:rl:*` between flood suites (phase 4 notes apply; Windows
  redis-cli `--scan` produced no output, use KEYS/DEL).
- 400 responses now have shape `{success, message, code, errors[]}`; frontend
  form error handling renders `message` — verify UX in Playwright.
- helmet sends `Cross-Origin-Resource-Policy: cross-origin` deliberately
  (media thumbnail redirects); do not "fix" to same-origin without checking
  `<img>` embeds.
