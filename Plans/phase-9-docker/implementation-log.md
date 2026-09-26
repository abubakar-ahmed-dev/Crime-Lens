# Phase 9 — Docker: Implementation Log

Branch: `feature/phase-9-docker` · Date: 2026-09-16 · Plan: audit-rewritten before implementation (14 corrections, see plan.md).

## Implemented

- `Dockerfile.backend` — single-stage `node:22-alpine`, `npm ci --omit=dev`,
  non-root `node` user, built-in-`fetch` HEALTHCHECK against `/api/health`
  (PORT-aware). No curl/python/make/g++ in the image (possible because the
  dead native `bcrypt` dependency was removed; `bcryptjs` is used everywhere).
- `Dockerfile.frontend` — `node:22-alpine` builder (`npm ci` + `tsc -b &&
  vite build`) → `nginx:1.25-alpine` runtime with `docker/nginx.conf`.
- `docker/nginx.conf` — SPA `try_files`, hashed-asset 1y immutable cache,
  gzip, security headers (`X-Frame-Options DENY`, `nosniff`,
  `strict-origin-when-cross-origin`), `client_max_body_size 50m` (media
  uploads: nginx's 1 MB default would 413 every upload), `/api/` proxy to
  `backend:5001` with `X-Forwarded-*`. `/metrics` intentionally not proxied.
- `docker-compose.yml` — backend / frontend / redis / prometheus / grafana on
  one bridge network. Secrets only via `env_file: db-project-backend/.env`;
  in-compose overrides limited to `REDIS_URL=redis://redis:6379`,
  `TRUST_PROXY=1`, `CORS_ORIGINS=http://localhost:8080`, NODE_ENV/LOG_LEVEL.
  Redis internal-only with healthcheck; backend `depends_on: redis (healthy)`.
- `server.js` — `TRUST_PROXY` env support (`app.set("trust proxy", n)`).
  Without it, every request behind nginx shares the proxy IP and phase-4
  per-IP rate limiting collapses into one global bucket.
- `.dockerignore` (root) — `**/node_modules`, `**/dist`, secrets, tests,
  docs. `db-project-frontend/.env` consciously KEPT in context (public
  Supabase URL + anon key; Vite bakes VITE_* at build time). Backend `.env`
  excluded — verified absent from the built image.
- `db-project-frontend/.env.production` (NEW, plan gap found live) —
  `VITE_API_BASE_URL=/api`. Without it the production bundle baked
  `http://localhost:5001/api` and the containerized SPA would bypass nginx
  and call the host backend directly. Prod builds read this over `.env`;
  `npm run dev` (development mode) is unaffected.
- Infra configs: Prometheus targets → `backend:5001` +
  `host.docker.internal:5001`; Grafana datasource URL → `http://prometheus:9090`.
- Root `.env-sample` (compose-level vars only; no secrets). Backend deps:
  `bcrypt` + `@types/bcrypt` removed; `nodemon` moved to devDependencies.
- `docker-compose.override.yml` (gitignored, local-only): remaps host ports
  to 15001/18080/19090/13300 so the stack runs beside the host-run dev
  backend (:5001) and dev frontend (:8080).

## Deviations from plan

1. **Single-stage backend image** — plan specified builder+runtime stages,
   but with no build step left (audit removed `npm run build`) a builder
   stage adds nothing.
2. **`nodemon` → devDependencies** — beyond the plan's bcrypt removal, same
   rationale: dead weight in the production image.
3. **`.env.production` for the frontend** — plan defect discovered during
   live verification (see above); this file is what makes the container
   topology actually work.
4. **Stack left running** — `docker compose down -v` (plan's final step) not
   executed so the stack can be inspected live (ports 15001/18080/19090/13300).

## Validation (all actually executed)

```text
node --check server.js:                      PASS
Backend boot smoke (PORT=5092 TRUST_PROXY=1):PASS — DB + Redis connected
TRUST_PROXY rate-limit separation:           PASS — 51× XFF 203.0.113.77 → 429;
                                             XFF 203.0.113.78 → 200; no-XFF → 200
docker compose build:                        PASS — both images; frontend ran
                                             tsc -b && vite build in-container
docker compose up -d:                        PASS — all 5 up; redis healthy →
                                             backend healthy (depends_on chain)
SPA http://localhost:18080/:                 PASS — 200 text/html, full render
/api via nginx:                              PASS — live JSON, X-Cache: HIT,
                                             X-RateLimit-*, security headers
Prometheus :19090 targets:                   PASS — backend:5001 UP,
                                             host.docker.internal:5001 UP
Grafana :13300:                              PASS — dashboard uid crimelens-api
                                             provisioned; datasource health OK
Rate limit through proxy:                    PASS — 52nd burst via :18080 → 429
client_max_body_size:                        PASS — `nginx -T` shows 50m
Image hygiene:                               PASS — no curl/python3/make/g++;
                                             USER node; Node v22.23.2; no .env
                                             in backend image (only .env-sample)
Baked SPA API URL:                           PASS — bundle has baseURL "/api",
                                             zero localhost:5001 references
Playwright smoke (full stack):               PASS — landing renders; /map: 24
                                             tiles, marker clusters, all API
                                             calls same-origin :18080 → 200;
                                             /statistics: 8 charts with live
                                             data; 0 console errors
Redis failure drill:                         PASS — compose redis stopped →
                                             /api still 200 (cache-aside
                                             resilience); restarted → X-Cache HIT
ESLint (backend):                            NOT EXECUTED — no ESLint config in
                                             repo (unchanged since phase 5)
k6:                                          DEFERRED — phase 15 per roadmap
Login flow in browser:                       NOT EXECUTED — no test credentials
                                             available; API auth routes untouched
                                             this phase (only middleware order
                                             addition is TRUST_PROXY pre-logging)
```

## Notes

- Container backend and host backend use separate Redis instances (compose
  redis vs `crimelens-redis-host` on :6379), so rate-limit buckets are
  independent — observed during the 429 test.
- Host dev Redis now runs as `crimelens-redis-host` (redis:7-alpine,
  `--restart unless-stopped`) replacing the deleted temp-dir binary.
- Phase 10 (nginx reverse-proxy/LB) builds on `docker/nginx.conf`;
  `/metrics` network allow-listing lands there.

## Files

```
Dockerfile.backend, Dockerfile.frontend, docker-compose.yml, docker/nginx.conf,
.dockerignore, .env-sample, .gitignore          (new/updated, root)
db-project-backend/package.json + lock          (bcrypt removed, nodemon devDep)
db-project-backend/server.js                    (TRUST_PROXY)
db-project-frontend/.env.production             (NEW — /api base URL for builds)
db-project-frontend/.env-sample                 (doc note)
infra/prometheus/prometheus.yml                 (compose targets)
infra/grafana/provisioning/datasources/prometheus.yml (prometheus:9090)
Plans/phase-9-docker/plan.md                    (audit rewrite)
docker-compose.override.yml                     (gitignored, local-only)
```
