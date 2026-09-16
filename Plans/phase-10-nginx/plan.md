# Phase 10: Nginx Reverse Proxy & Load Balancing

## Objective

One public entrypoint for the compose stack: an edge nginx that serves the SPA
(via the existing frontend container) and load-balances `/api/` across the
backend replicas using Docker DNS + passive health checks. Verified live with
multiple backend replicas, failover, and `/metrics` kept off the edge.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **`check interval=30s rise=2 fall=3;` is not stock nginx** — that
   directive belongs to a third-party upstream-check patch; stock
   `nginx:1.25-alpine` refuses to start with it. Passive health checking
   (`max_fails` / `fail_timeout` on `server` entries) is the built-in
   equivalent and is what we use.
2. **Hardcoded `backend1/2/3:5001` upstreams are broken** — no such
   containers exist. With one `backend` service in compose, `backend1`
   doesn't resolve and nginx fails at startup ("host not found in
   upstream"). Correct Docker-native form: `server backend:5001` — Docker's
   embedded DNS returns ALL replica IPs and round-robins per resolution;
   passive health checks drop dead replicas.
3. **TLS/SSL dropped from this phase** — no domain, no certs, and Cloudflare
   (phase 13) terminates TLS at the edge in the target architecture. The old
   plan's self-signed certs + HTTP→HTTPS 301 + `ssllabs` test against a fake
   domain would break every local workflow (Playwright, curl, dev server) for
   zero real security. Nginx stays HTTP on the internal network — identical
   trust domain to the app containers.
4. **HSTS `preload` dropped** — contradicts the phase-5 decision ("no
   preload; irreversible; revisit when a production domain exists"). The old
   plan also added `X-XSS-Protection "1; mode=block"` — deprecated header
   helmet 8 deliberately sends as `0`.
5. **CSP at the proxy dropped** — untested CSP with `unsafe-inline` guesses
   can break the SPA (Vite/Tailwind/leaflet asset origins), and headers are
   already owned by the frontend nginx + backend helmet (phase 5). CSP is a
   frontend-phase concern.
6. **nginx-level `limit_req`/`limit_conn` dropped** — duplicates phase-4
   Redis-backed rate limiting with a second, different limit set on a
   different key. Two independent 429/503 layers make behavior unexplainable.
   Abuse protection stays in the app (shared across replicas, which nginx
   `limit_req` cannot offer per-instance anyway).
7. **`/metrics` is NOT proxied at all** — the old plan proxied `/metrics`
   through the public edge with `allow 172.16.0.0/12; deny all`. From a
   published host port, host processes arrive from the bridge gateway and
   would be allowed. Simpler and safer: no `/metrics` location on the edge.
   Prometheus scrapes `backend:5001` directly on the internal network
   (phase 9 config already does this) and never needs the proxy.
8. **`/health` + `/ready` locations were wrong** — the backend mounts health
   routes at `/api/health` and `/api/ready`; proxying bare `/health` 404s.
   The nginx container healthcheck used that same dead route, so the edge
   would report permanently unhealthy. Fixed to real routes.
9. **The old edge config served `root /usr/share/nginx/html` from a stock
   `nginx:1.25-alpine` with no dist copied** — the SPA would 404. Fixed by
   making the edge a pure proxy: `/` → `frontend:80` (the phase-9 static
   container), `/api/` → backend upstream. No second static-serving config
   to maintain.
10. **`nginx-dev.conf` variant dropped** — with proxy-only edge config there
    is one config; nothing to fork for dev.
11. **`setup-ssl.sh`, `nginx/ssl` volume, `scripts/nginx-reload.sh` dropped**
    — TLS out of scope (see 3); reload script hardcodes a container name for
    a `docker compose exec nginx nginx -s reload` one-liner (documented
    instead). YAGNI.
12. **`Upgrade`/`Connection: upgrade` proxy headers dropped** — the app has
    no websockets; setting upgrade headers on every request is wrong, not
    neutral.
13. **`client_max_body_size 10m` raised to 50m** — media uploads are 10
    files × 5 MB (same finding as phase 9; 10m would 413 legitimate
    multi-image reports).
14. **Logging: no `/var/log/nginx` volume** — the nginx image symlinks its
    logs to stdout/stderr; a volume would hide them from `docker logs`. The
    upstream-timing `log_format` (rt/uct/urt) is kept — it feeds phase-11
    scaling and phase-15 k6 comparisons.
15. **`server_name crimelens.example.com` → `server_name _;`** — no domain
    exists; the edge is the default server.
16. **Ports** — only `80` published (443 gone with TLS). The phase-9
    frontend host publish (`8080`) is removed so ALL traffic enters through
    the edge; backend keeps its host publish (override file) for direct
    verification. Local port conflicts handled by the gitignored
    `docker-compose.override.yml` as in phase 9.
17. **`CORS_ORIGINS` updated to the edge origin** — browser API calls become
    same-origin through the edge; the override moves from
    `http://localhost:8080` to the edge's published origin.

## Scope boundary

- Backend replicas/scale comparison belong to Phase 11; this phase proves the
  upstream works with a temporary `--scale backend=2` smoke (both replicas
  receive traffic, failover on container kill), then returns to 1 replica.
- TLS termination arrives with Cloudflare (Phase 13).
- The frontend container's `docker/nginx.conf` keeps its `/api` location —
  unreachable once the edge intercepts `/api/` first, left untouched
  (minimal change; noted in the implementation log).

## Implementation Steps

### Step 1: `docker/nginx-edge.conf` (new)

Stock-nginx-safe, proxy-only edge:

- `upstream crimelens_backend { least_conn; server backend:5001 max_fails=3
  fail_timeout=30s; }` (Docker DNS fan-out; no `check` directive)
- `log_format` with `$request_time`/`$upstream_response_time` → stdout
- `server_name _;` listen 80
- `client_max_body_size 50m`
- `location /` → `proxy_pass http://frontend:80` (static SPA container)
- `location /api/` → `proxy_pass http://crimelens_backend;` with
  `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` / `Host`
  (real-client IP for TRUST_PROXY=1 rate limiting)
- NO `/metrics`, NO TLS, NO nginx rate limiting, NO CSP/HSTS additions
- `proxy_read_timeout 60s` (Cloudinary uploads run inside the request)

### Step 2: `docker-compose.yml` (edit)

- New `nginx` (edge) service: `nginx:1.25-alpine`, ports `80:80`,
  mounts `./docker/nginx-edge.conf:/etc/nginx/nginx.conf:ro`,
  `depends_on: backend + frontend`, healthcheck via
  `wget -q -O /dev/null http://localhost/api/health` (real route)
- `frontend`: remove `ports` (internal-only)
- `backend`: unchanged (host publish already overridable)
- Override file (gitignored, local): remap edge to `18000:80` since host
  port 80 is likely taken on this machine

### Step 3: Compose environment tweak

- `backend` environment: `CORS_ORIGINS=http://localhost:18000` (edge origin;
  same-origin browser calls make CORS mostly moot, kept consistent)

### Step 4: Live verification (all executed)

```bash
docker compose build && docker compose up -d
docker compose ps                       # edge + 5 services healthy
curl -f http://localhost:18000/               # SPA through edge
curl -f http://localhost:18000/api/health     # real health route via upstream
curl -f http://localhost:18000/api/crimes/types
# /metrics must NOT be reachable through the edge:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18000/metrics
# Prometheus still scrapes internally (backend:5001 target UP):
curl -s http://localhost:19090/api/v1/targets
```

Load-balancing smoke (temporary, returned to 1 replica after):

```bash
docker compose up -d --scale backend=2
docker compose logs backend | ...       # both replicas serve requests
docker stop <one backend container>     # failover: traffic continues
                                        # (passive max_fails ejection)
docker compose up -d --scale backend=1  # restore
```

Rate limit through edge (app-level, proves TRUST_PROXY over the new hop):

```bash
# burst 51× http://localhost:18000/api/zones/severity → 429
```

Upload-size check: `docker compose exec nginx nginx -T | grep client_max_body_size` → 50m.

Playwright smoke through the edge: landing, map (markers), statistics,
login page renders; console clean.

### Step 5: Validation bookkeeping

- `docker/nginx-edge.conf` syntax: `docker compose exec nginx nginx -t`
- implementation-log.md + testing-log.md per Plans/CLAUDE.md

## Out of Scope

- TLS/SSL (Phase 13 Cloudflare), HSTS
- nginx rate limiting / connection limiting (app Redis limiter owns this)
- Full replica scaling + 1/2/3-instance comparison (Phase 11)
- Access logs aggregation/dashboards

## Success Criteria

- [ ] Edge nginx is the single published entrypoint (SPA + `/api` both
      through :80; frontend container no longer host-published)
- [ ] `/metrics` returns 404 through the edge; Prometheus still scrapes
      `backend:5001` UP internally
- [ ] `--scale backend=2` smoke: both replicas serve traffic; killing one
      does not drop requests (passive health check failover)
- [ ] 429 still enforced through the edge (TRUST_PROXY + XFF chain)
- [ ] Uploads would not 413 (`client_max_body_size 50m` in effect)
- [ ] Edge container healthcheck passes against `/api/health`
- [ ] Playwright smoke through the edge passes with clean console
- [ ] Host-run workflows unaffected (dev backend/dev server untouched)

## Files Created/Modified

```
├── docker/nginx-edge.conf        (new — edge proxy + upstream)
├── docker-compose.yml            (edit — nginx service, frontend internal-only,
│                                  CORS_ORIGINS to edge origin)
└── docker-compose.override.yml   (gitignored local — edge port remap)
Plans/phase-10-nginx/implementation-log.md (new)
Plans/phase-10-nginx/testing-log.md        (new)
```

## Rollback

Remove the `nginx` service + restore `frontend` ports in compose; delete
`docker/nginx-edge.conf`. Backend/frontend images are untouched by this
phase — no rebuild needed.

## Estimated Completion Time

- Edge config + compose edits: 45 min
- Live verification incl. scale/failover smoke: 1–1.5 h
- **Total: ~2–2.5 h**
