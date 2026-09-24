# Deployment

## What CI produces

On every push to `dev`/`main` and every `v*` tag, the
[Docker Build workflow](../.github/workflows/docker-build.yml) builds, scans
(Trivy, CRITICAL/HIGH), and pushes two images to GHCR:

```
ghcr.io/abubakar-ahmed-dev/crime-lens/crimelens-backend:<tag>
ghcr.io/abubakar-ahmed-dev/crime-lens/crimelens-backend:latest
ghcr.io/abubakar-ahmed-dev/crime-lens/crimelens-frontend:<tag>
ghcr.io/abubakar-ahmed-dev/crime-lens/crimelens-frontend:latest
```

Tag schemes: branch name, PR, `sha-<short>`, semver on tags, `latest`.
PRs build-only (no push). The [Release workflow](../.github/workflows/release.yml)
creates a GitHub Release with a generated changelog on `v*` tags.

The same images run locally — `docker compose build` builds the identical
Dockerfiles, so "works locally" and "runs on a host" use one artifact.

## Deploying to a host (when one exists)

1. **Requirements**: Docker + compose plugin, ports 80/443 reachable, the
   backend env configured (see SETUP.md).
2. **Pull** the GHCR images (private repo → `docker login ghcr.io` with a
   `read:packages` token).
3. **Run** a host-side compose file mirroring the repo one but with
   `image:` references instead of `build:` (no build toolchain needed).
4. **Configure**: `DATABASE_URL` (Supabase pooler), `REDIS_URL` (managed
   Redis or a container), `JWT_SECRET` (96-char random hex; note compose
   interpolates `$` in env values — avoid `$` in secrets), Cloudinary and
   Supabase keys, `CORS_ORIGINS` for the real domain.
5. **Verify**: `/api/health` 200, `/api/ready` 200 (DB + Redis up),
   `/api/metrics` scraped (or 404 through the edge, by design).

## Deliberately deferred

| Item | Blocker |
|---|---|
| Cloudflare (TLS, WAF, CDN) — phase 13 | Needs a custom domain |
| Hosted environment (staging/production) | Needs a host; images + CI are ready |
| Grafana persistence | Volume provisioned when a host exists |
| Backend CI lint | No ESLint config in the backend yet |
