# Phase 14 — GitHub Actions CI/CD: Implementation Log

Branch: `feature/phase-14-cicd` · Date: 2026-09-17 · Plan: audit-rewritten before implementation (12 corrections, see plan.md).

## Implemented

- `.github/workflows/ci.yml` — every job runs checks that actually exist:
  - **lint-frontend** — report-only (`continue-on-error: true`): the frontend
    carries pre-existing lint debt (no-explicit-any across AuthContext and
    components, react-refresh export rules). Enforcing would red every PR
    for reasons unrelated to a change. Flip to enforcing after a lint
    cleanup phase.
  - **build-frontend** — `npm run build` (includes `tsc -b` typecheck),
    dist artifact uploaded (upload-artifact@v4).
  - **backend-syntax** — `node --check` over all backend JS sources.
  - **backend-smoke** — boots the real API against `postgres:15` +
    `redis:7-alpine` service containers (`DB_SSL=false`), asserts
    `/api/health` 200 with `rateLimiting.mode == "redis"`, `/api/ready`
    200, `/metrics` containing `crimelens_` series, clean SIGTERM exit 0;
    then boots `worker.js`, asserts the start log and clean SIGTERM exit 0.
  - **codeql** (actions v3, javascript-typescript) and
    **npm-audit** (`--omit=dev --audit-level=critical` — fails only on
    criticals; full report stays in the log).
- `.github/workflows/docker-build.yml` — buildx builds of the phase-9
  images to `ghcr.io/<owner>/<repo>/crimelens-{backend,frontend}` with
  branch/pr/semver/sha/latest tags (metadata-action@v5,
  build-push-action@v6), GHA layer cache; push only on push events or an
  explicit `workflow_dispatch` `push_images` input; PRs build-only.
  Trivy scans (pinned `v0.36.0`, CRITICAL/HIGH, ignore-unfixed) → SARIF →
  Security tab (upload-sarif@v3, `if: always()`).
- `.github/workflows/release.yml` — tag (`v*`) releases with generated
  changelog, guarded for the first-tag case.
- `config/db.js` — `DB_SSL=false` opt-out (plain Postgres rejects
  SSL-with-require; Supabase default path byte-identical when unset).
  Documented in `db-project-backend/.env-sample`.

## Fixes during live validation (iteration on the PR's own runs)

1. `type=sha,prefix={{branch}}-` produced an invalid `-c8cd860` tag on PR
   events (empty branch) → constant `sha-` prefix + `type=ref,event=pr` tag.
2. `aquasecurity/trivy-action@0.28.0` doesn't exist → pinned `v0.36.0`
   (verified via GitHub API tag list).
3. Frontend lint red on first run → report-only mode (see above).

## Deviations from plan

- Trivy pinned version differs from the plan's assumed one (plan didn't
  verify the tag exists — lesson recorded).
- Semver-tag Docker build: the validation tag `v0.1.0-ci-test` was deleted
  right after the release check, and the run record vanished with it —
  semver tag push was NOT fully observed end-to-end. Same build steps were
  proven on branch push, PR, and workflow_dispatch events.

## Validation (all actually executed — this PR validated itself)

```text
CI workflow (run 35198196238, PR event):       SUCCESS — all jobs:
  Backend Smoke:                success (health 200 mode:redis on service
                                containers; ready 200; metrics series
                                present; API exit 0; worker started +
                                exit 0 — verified in step logs)
  Build Frontend (tsc):         success
  Backend Syntax:               success
  CodeQL:                       success
  npm audit criticals:          success
  Lint Frontend:                report-only failure (expected; documented)
Docker Build (run 35198196252, PR): SUCCESS — backend/frontend built,
  both Trivy scans + SARIF uploads succeeded (push correctly skipped)
Docker Build (run 35198674312, dispatch push_images=true): SUCCESS —
  images PUSHED to GHCR (buildx "pushing layers done", tags
  crime-lens/crimelens-{frontend,backend}:feature-phase-14-cicd,
  :sha-a5d09d7). gh CLI cannot list packages (token lacks read:packages),
  so verification is via run logs, not the registry API.
Release (run 35233361157, tag v0.1.0-ci-test): SUCCESS — release created
  with correct generated changelog; test release + tag deleted after.
ESLint (backend):              NOT EXECUTED — no repo config (unchanged)
Playwright:                    NOT EXECUTED — no user-visible change
```

## Deferred (recorded, not built)

- **Deployment** (staging/production environments, SSH deploys, migrations,
  rollback): no server exists. When one does, it pulls these GHCR images.
- **Frontend lint enforcement**: needs a lint-debt cleanup phase first.
- **Real test suites** (jest/vitest): separate phase; the smoke job is the
  live signal until then.

## Files

```
.github/workflows/ci.yml, docker-build.yml, release.yml   (new)
db-project-backend/config/db.js                           (DB_SSL toggle)
db-project-backend/.env-sample                            (DB_SSL documented)
Plans/phase-14-cicd/implementation-log.md, testing-log.md (new)
```
