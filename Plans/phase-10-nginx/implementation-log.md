# Phase 10 — Nginx Reverse Proxy & LB: Implementation Log

Branch: `feature/phase-10-nginx` · Date: 2026-09-16 · Plan: audit-rewritten before implementation (17 corrections, see plan.md).

## Implemented

- `docker/nginx-edge.conf` (new) — edge reverse proxy + load balancer,
  mounted (not baked) into stock `nginx:1.25-alpine`:
  - `upstream crimelens_backend` → `server backend:5001 max_fails=3
    fail_timeout=30s` + `least_conn` + `keepalive 32`. Docker DNS fans the
    service name out to every running replica; passive checks eject dead ones.
  - `/` → `frontend:80` (phase-9 SPA container), `/api/` → backend pool with
    `X-Forwarded-*` (real client IP for `TRUST_PROXY=1`).
  - `client_max_body_size 50m`; upstream-timing `log_format` to stdout.
  - Explicit `location = /metrics { return 404; }` — metrics never cross the
    public edge; Prometheus scrapes `backend:5001` internally.
  - `listen 80` + `listen [::]:80` (IPv4+IPv6; busybox healthcheck resolved
    `localhost` to `::1` and got connection refused without the v6 listener).
- `docker-compose.yml` — `nginx` edge service published on `80:80` with
  healthcheck exercising the full chain (`wget 127.0.0.1/api/health`);
  `depends_on` backend+frontend `service_healthy`. `frontend` host publish
  removed (single-entrypoint topology). `CORS_ORIGINS` →
  `http://localhost:18000` (edge origin; browser calls are same-origin).
- `docker-compose.override.yml` (gitignored, local) — edge `18000:80`,
  backend **`15001-15003:5001` port range** (a single mapped port breaks
  `--scale backend=N` — each replica needs its own host port), prometheus
  `19090`, grafana `13300`.

## JWT_SECRET corruption found and fixed (phase-9 latent bug)

`docker compose up` warned `The "RT" variable is not set` — compose v2
**interpolates `$VAR` sequences inside `env_file` values** (no opt-out). The
user's `JWT_SECRET` contained `$RT` and `$EGVBNMNBVCDE`; the container got a
silently truncated secret (56→40 chars). `DATABASE_URL`/`DB_PASS` `$` chars
are followed by non-letters (`$#`) → passed literal (lengths verified equal).

Fix: rotated `db-project-backend/.env` `JWT_SECRET` to a 96-char
hex-crypto-random value (no `$`), with an explanatory comment in the file.
**Consequence: existing JWTs are invalid; all users must log in again.**
Operational rule recorded: env values destined for compose `env_file` must
not contain `$`.

## Edge-after-scale behavior (documented for Phase 11)

OSS nginx resolves upstream DNS once at startup. After
`--scale backend=N` (recreates containers → new IPs), the edge keeps serving
a stale IP until restarted: observed 24/24 requests on one replica after
scaling, then 11/13 across two replicas after `docker compose restart
nginx`. Phase 11 must restart (or `nginx -s reload`) the edge after every
scale change.

## Deviations from plan

1. **`location = /metrics` explicit 404 added** — plan said "not routed";
   first build leaked SPA `index.html` (200, text/html, zero metrics) via
   the fallback. Harmless, but made the intent explicit.
2. **`listen [::]:80` + healthcheck `127.0.0.1`** — not in plan; the edge
   container was permanently `unhealthy` until both were fixed (IPv6
   resolution of `localhost` by busybox wget).
3. **Override backend port range** (15001-15003) — plan assumed a single
   port; `--scale` smoke exposed the bind conflict.
4. **JWT_SECRET rotation in `db-project-backend/.env`** — outside the
   original file list; required to make the phase-9 compose deployment
   actually correct. Discovered via interpolation warnings during this
   phase's `up`.

## Validation (all actually executed)

```text
docker compose config:                    PASS (no interpolation warnings after fix)
compose up:                               PASS — 6/6 containers, edge healthy
SPA via edge :18000:                      PASS — 200 text/html
/api/health + /api/crimes/types via edge: PASS — live JSON
/metrics via edge:                        PASS — 404 (explicit), no metrics leak
Prometheus internal scrape:               PASS — backend:5001 UP (untouched)
client_max_body_size:                     PASS — nginx -T shows 50m
429 through edge:                         PASS — 52nd burst → 429 (app limiter
                                          + TRUST_PROXY over the new hop)
--scale backend=2:                        PASS — both healthy; after edge
                                          restart: 11+13 split across replicas
Failover drill:                           PASS — stopped backend-2: 24/24
                                          requests OK on backend-1 (passive
                                          max_fails ejection + least_conn)
Scale back to 1 + edge restart:           PASS — all healthy, X-Cache: HIT
Playwright (via edge :18000):             PASS — landing, /map (marker
                                          clusters + tiles), /statistics (8
                                          charts), /login renders; 0 console
                                          errors across all pages
nginx -t inside container:                PASS
Host-run workflows:                       PASS — dev backend :5001 and dev
                                          frontend :8080 untouched throughout
ESLint (backend):                         NOT EXECUTED — no ESLint config; no
                                          backend JS changed this phase
Login submission (browser):               NOT EXECUTED — no test credentials;
                                          auth routes untouched this phase
```

## Files

```
docker/nginx-edge.conf          (new)
docker-compose.yml              (edit — edge service, frontend internal, CORS)
docker-compose.override.yml     (gitignored, local — port remaps + range)
db-project-backend/.env         (JWT_SECRET rotated; gitignored, NOT committed)
Plans/phase-10-nginx/implementation-log.md, testing-log.md (new)
```
