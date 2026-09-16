# Phase 10 — Nginx Reverse Proxy & LB: Testing Log

Testing agent record · 2026-09-16 · All results from live execution against
the compose stack on this machine (edge at host :18000 via local override).

## Edge proxy & routing

- Tests: SPA through edge, `/api/health`, `/api/crimes/types`,
  `/metrics` block, Prometheus internal scrape, body-size config.
- Result: PASS
- Notes: `/metrics` initially answered by the SPA fallback (200 index.html,
  zero metrics). Fixed with explicit `location = /metrics { return 404; }`;
  retest → 404. `backend:5001` scrape stayed UP throughout.

## Edge container health

- Tests: compose ps health status.
- Result: FAIL → PASS
- Problem: edge reported permanently `unhealthy`; healthcheck log showed
  `wget: can't connect to remote host (127.0.0.1/::1): Connection refused`.
- Cause: busybox wget resolves `localhost` to `::1`; edge listened IPv4-only.
- Fix (implementation): `listen [::]:80` + healthcheck target `127.0.0.1`.
- Retest: edge `healthy`; full chain verified through the healthcheck route.
- Status: Fixed and verified.

## Rate limiting through the new proxy hop

- Tests: 51× burst `/api/zones/severity` via edge → 52nd request.
- Result: PASS (429)
- Notes: proves backend `TRUST_PROXY=1` resolves the real client IP from the
  edge's `X-Forwarded-For`; app-level Redis limiter unaffected by topology.

## Load balancing (temporary --scale backend=2)

- Tests: scale to 2, 24 requests through edge, per-replica pino log counts.
- Result: FAIL → PASS
- Problem (first run): all 24 requests landed on one replica.
- Cause: OSS nginx resolves upstream DNS once at startup; `up -d --scale`
  recreated backend containers with new IPs; edge held a stale IP.
- Fix (operational): `docker compose restart nginx` after scale changes.
- Retest: 11 + 13 requests split across the two replicas.
- Status: Fixed and verified. Recorded as a Phase 11 operational
  requirement.

## Failover (passive health checks)

- Tests: `docker stop` one replica → 24 sequential requests through edge.
- Result: PASS — 24/24 HTTP 200 on the surviving replica, zero client
  errors (`max_fails=3 fail_timeout=30s` ejection + `least_conn` retry).
- Restore: replica restarted, edge restarted, all containers healthy.

## Second-replica startup failure during scale-up

- Result: FAIL → PASS (environment fix)
- Problem: `--scale backend=2` failed — replica 2 could not bind the
  already-allocated host port 15001 (override file mapped a single port).
- Fix: override maps a port range `15001-15003:5001` so each replica takes
  the next free port.
- Retest: both replicas started and passed healthchecks.
- Status: Fixed and verified (local override only).

## Compose env_file interpolation (defect found in Phase 9 artifact)

- Result: FAIL → PASS
- Problem: `docker compose up` warned `The "RT" variable is not set`; the
  containerized backend had a truncated `JWT_SECRET` (56 → 40 chars) because
  compose interpolates `$VAR` inside `env_file` values.
- Verification: host vs container value lengths compared (`DATABASE_URL` and
  `DB_PASS` intact — their `$` chars are followed by non-letters;
  `JWT_SECRET` lost both `$…` sequences).
- Fix: JWT_SECRET rotated to a `$`-free 96-char value in
  `db-project-backend/.env` (not committed — gitignored file).
- Retest: no interpolation warnings; container `JWT_SECRET` length 96.
- Status: Fixed and verified. Consequence: previously issued JWTs invalid
  (users must log in again).

## Browser regression (Playwright MCP, through the edge)

- Tests: landing page, `/map` (marker clusters + tiles), `/statistics`
  (8 charts with live data), `/login` renders; console per page.
- Result: PASS — 0 console errors on every page; API calls all same-origin
  through the edge with 200s.

## Not executed

- Backend ESLint: no ESLint config in repo; no backend JS changed this phase.
- Login submission with real credentials: no test accounts available; auth
  routes and middleware untouched by this phase.
- k6 load comparison of 1 vs 2 instances: Phase 11 scope.

## Final status

All executed tests PASS. Stack left running for inspection
(edge :18000, prometheus :19090, grafana :13300, direct API :15001).
