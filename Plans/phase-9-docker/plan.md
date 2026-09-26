# Phase 9: Docker Containerization

## Objective

Containerize the stack (backend, frontend, Redis, Prometheus, Grafana) with
production-shaped images and a Compose file that actually boots end-to-end:
healthy containers, working nginx→backend API path, Prometheus scraping the
containerized backend, Grafana rendering the provisioned dashboard.

Database stays external (Supabase) — the original objective's "PostgreSQL
container" does not match this project.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **`bcrypt` (native) is a dead dependency** — imported nowhere (bcryptjs is
   used). On Alpine it would force a source build needing python3/make/g++.
   Remove `bcrypt` + `@types/bcrypt` from package.json instead of shipping a
   toolchain in the image.
2. **`npm run build` in the backend builder is dead** — no build script
   exists (`|| true` masked it). Removed.
3. **`curl` in the runtime image existed only for HEALTHCHECK** — replaced by
   a Node-builtin `fetch` healthcheck; no extra package.
4. **`/app/logs` volume is dead** — pino logs go to stdout (phase 7); the app
   never writes log files. Dropped.
5. **Missed `client_max_body_size`** — nginx defaults to 1 MB request bodies;
   every media upload (up to 5 MB/file) would 413 through the proxy. Set
   explicitly.
6. **Missed `trust proxy`** — behind the nginx proxy every request would
   share the proxy's IP, collapsing phase-4 per-IP rate limiting into ONE
   bucket for all users. Backend gains `TRUST_PROXY` env support
   (`app.set("trust proxy", n)`); compose sets `TRUST_PROXY=1`.
7. **Prometheus target paths stale** — phase 8 moved configs to
   `infra/prometheus/`; inside the compose network the backend is
   `backend:5001`, not `localhost:5001`. Committed `infra/prometheus/
   prometheus.yml` targets become `backend:5001` (compose) +
   `host.docker.internal:5001` (host-run); the `localhost` target (always
   DOWN from a container) is dropped.
8. **Grafana paths + datasource URL stale** — provisioning moved to
   `infra/grafana/`; the dashboard volume the loader reads was missing from
   the plan; datasource URL becomes `http://prometheus:9090` (compose DNS).
   Host-run users swap that one URL (documented in the file).
9. **`version: '3.8'` + `docker-compose` spelling** — obsolete; Compose v2
   (`docker compose`, no version key).
10. **Duplicate healthchecks** — Dockerfile HEALTHCHECK is the single source;
    the compose backend healthcheck block is dropped.
11. **`.dockerignore` mechanics wrong** — only the context-root file is
    honored; bare `node_modules` matches only the root level. Use
    `**/node_modules`, `**/dist` etc. Critical hygiene: root `.env` is
    excluded from build context (compose reads it from disk, not context),
    while `db-project-frontend/.env` must REMAIN in context — Vite bakes
    `VITE_*` at build time and its values (Supabase URL + anon key) are
    public by design. Per-subdir .dockerignore files dropped (ignored by
    Docker).
12. **`.docker.env` dropped** — its `DOCKER_*_PORT` vars were referenced by
    nothing. Ports documented in compose comments.
13. **Compose secrets surface trimmed** — `env_file: db-project-backend/.env`
    carries secrets; explicit `environment:` list reduced to the overrides
    that MUST differ in-compose (`REDIS_URL`, `TRUST_PROXY`,
    `CORS_ORIGINS=http://localhost:8080`, NODE_ENV/LOG_LEVEL). No duplicate
    secret literals in the compose file.
14. **Node 22, not 20** — matches the dev/runtime Node (22.x) actually used
    through phases 0–8.

## Scope boundary with Phase 10

The frontend's nginx serves the SPA and proxies `/api/` — that is deployment
glue and lives here. The dedicated Nginx reverse-proxy/LB layer (unified
entrypoint, load balancing across API replicas, network allow-listing of
`/metrics`) is Phase 10 and will build on these files.

## Implementation Steps

### Step 1: Dependency cleanup (backend)

```bash
npm uninstall bcrypt @types/bcrypt   # dead native dep; bcryptjs used everywhere
```

### Step 2: `Dockerfile.backend` (repo root)

- Stage 1 `builder`: `node:22-alpine`, `npm ci` (no toolchain needed once
  bcrypt is gone), copy app source
- Stage 2: `node:22-alpine`, `apk add --no-cache curl` NOT needed —
  HEALTHCHECK via `node -e "fetch(...)"`; non-root `nodejs` user; `EXPOSE
  5001`; `CMD ["node", "server.js"]`
- No logs dir, no build step

### Step 3: `Dockerfile.frontend` (repo root)

- Stage 1 `builder`: `node:22-alpine`, `npm ci`, copy source (its `.env`
  rides in the context), `npm run build`
- Stage 2: `nginx:1.25-alpine`, copy `docker/nginx.conf` +
  `dist/` → `/usr/share/nginx/html`; EXPOSE 80; busybox-wget HEALTHCHECK

### Step 4: `docker/nginx.conf`

- SPA `try_files`, static-asset 1y cache, gzip for static types
- Security headers: `X-Frame-Options DENY`, `X-Content-Type-Options
  nosniff`, `Referrer-Policy strict-origin-when-cross-origin` (no
  `X-XSS-Protection` — deprecated; CSP is a frontend-phase concern)
- `client_max_body_size 50m` (media uploads: 10 files × 5 MB)
- `location /api/ { proxy_pass http://backend:5001; ... }` with
  X-Forwarded-For/Proto + Host headers (no `/metrics` proxy — metrics stay
  off the public entrypoint)

### Step 5: `docker-compose.yml` (repo root, no `version:` key)

Services on one `crimelens-network` bridge:

- `backend` — build `Dockerfile.backend`; `env_file:
  db-project-backend/.env`; environment overrides: `NODE_ENV=production`,
  `LOG_LEVEL=info`, `REDIS_URL=redis://redis:6379`, `TRUST_PROXY=1`,
  `CORS_ORIGINS=http://localhost:8080`; `depends_on: redis (healthy)`
- `frontend` — build `Dockerfile.frontend`; publishes `8080:80`; `depends_on:
  backend`
- `redis` — `redis:7-alpine`, AOF + 256MB LRU; healthcheck `redis-cli ping`;
  NO host port publish (internal-only)
- `prometheus` — `prom/prometheus`; mounts
  `./infra/prometheus/prometheus.yml`; publishes 9090; retention 200h
- `grafana` — `grafana/grafana`; mounts `./infra/grafana/provisioning` and
  `./infra/grafana/dashboards` (the missing volume from the old plan);
  publishes 3000; admin creds from env with `admin` defaults;
  `GF_USERS_ALLOW_SIGN_UP=false`

Host publishes: 8080 (frontend), 9090 (prometheus), 3000 (grafana), 5001
(backend — for direct API access; can be dropped behind phase-10 nginx).
Redis stays internal.

### Step 6: Backend `TRUST_PROXY` support (small, required)

`server.js`: after `const app = express()`:

```javascript
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));
```

So `req.ip` (and therefore phase-4 rate limiting + security-event logs) uses
the real client IP from nginx's `X-Forwarded-For`.

### Step 7: Config file updates

- `infra/prometheus/prometheus.yml`: targets → `backend:5001` +
  `host.docker.internal:5001` (container-resolvable forms)
- `infra/grafana/provisioning/datasources/prometheus.yml`: URL →
  `http://prometheus:9090` (host-run users swap this one line; noted in file)
- `.dockerignore` (repo root): `**/node_modules`, `**/dist`, `**/*.log`,
  `.git`, `.claude`, `docs`, `Plans`, `*.md`, `.env`, `.env.*`,
  `db-project-backend/tests`, `coverage` — WITHOUT excluding
  `db-project-frontend/.env` (public build-time values; Vite requires it)
- `.env-sample` (root, new): documents the variables compose interpolates
  (`GRAFANA_ADMIN_USER/PASSWORD`) and points at
  `db-project-backend/.env` for app secrets

### Step 8: Build + run + verify (all live this time)

```bash
docker compose build                      # both images build
docker compose up -d                      # redis healthy → backend healthy
docker compose ps                         # all healthy
curl -f http://localhost:8080/            # SPA HTML served
curl -f http://localhost:8080/api/crimes/types   # nginx → backend proxy, JSON
curl -f http://localhost:8080/api/health  # health through the proxy
curl -s http://localhost:9090/api/v1/targets     # backend target UP
# Grafana dashboard endpoint with provisioning (admin/admin default)
#   http://localhost:3000/api/dashboards/uid/crimelens-api
# rate-limit sanity: burst /api/zones/severity 51× via 8080 → 429 (proves
# TRUST_PROXY splits by client IP, not proxy IP; single-IP test still hits limit)
docker compose down -v
```

## Out of Scope

- Nginx reverse-proxy/LB layer, `/metrics` network allow-listing (Phase 10)
- CI image builds (Phase 15 CI/CD)
- A PostgreSQL container (Supabase remains the DB)

## Success Criteria

- [ ] `docker compose build` succeeds; no native compile step needed
- [ ] `docker compose up -d` → all services healthy (redis → backend chain)
- [ ] SPA served on :8080; `/api/*` proxied to backend and returns live JSON
- [ ] Media-size uploads would not 413 (client_max_body_size 50m set;
      verified by config inspection + a >1 MB upload or explicit config dump)
- [ ] Rate limiting still 429s through the proxy (TRUST_PROXY working)
- [ ] Prometheus scrapes `backend:5001` target UP; Grafana dashboard
      provisioned with datasource reachable
- [ ] Backend image has no curl/python/make/g++; runs as non-root
- [ ] Frontend `.env` handled consciously: in context (public values), root
      `.env` excluded from context
- [ ] Host workflows unaffected (host-run API/Redis still work as before)

## Files Created/Modified

```
├── Dockerfile.backend               (new)
├── Dockerfile.frontend              (new)
├── docker-compose.yml               (new)
├── docker/nginx.conf                (new)
├── .dockerignore                    (new)
├── .env-sample                      (new — compose-level vars pointer)
├── db-project-backend/
│   ├── package.json / package-lock.json  (bcrypt + @types/bcrypt removed)
│   └── server.js                    (TRUST_PROXY support)
└── infra/
    ├── prometheus/prometheus.yml    (targets → backend:5001 + host.docker.internal)
    └── grafana/provisioning/datasources/prometheus.yml (URL → prometheus:9090)
Plans/phase-9-docker/implementation-log.md (new)
```

## Rollback

Remove the new root files; revert the three small config edits (prometheus
targets, grafana datasource URL, server.js TRUST_PROXY lines) and the
bcrypt uninstall. Host-run workflow is unchanged by this phase otherwise.

## Estimated Completion Time

- Dockerfiles + nginx + compose: 1.5 h
- Config updates + TRUST_PROXY: 30 min
- Live build/up/verify (incl. image builds over network): 1.5–2 h
- **Total: ~4 h**
