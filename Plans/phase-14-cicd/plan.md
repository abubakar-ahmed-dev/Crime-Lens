# Phase 14: GitHub Actions CI/CD

## Objective

A CI pipeline that runs **checks that actually exist** on every PR and push
to `dev`/`main`: frontend lint + production build, backend syntax + live
smoke boot against real Postgres/Redis services, Docker image builds pushed
to GHCR, Trivy image scans, CodeQL, and `npm audit` at a threshold that
doesn't sit permanently red. Tag-triggered GitHub Releases. Deployment is
explicitly deferred — no server exists to deploy to.

## Audit Corrections vs Previous Plan (why this rewrite)

1. **Backend jobs ran scripts that do not exist.** `npm run lint` (no ESLint
   config in repo), `npx tsc --noEmit` (plain-JS backend, no tsconfig), and
   `npm run test:coverage` (no jest, no tests — package.json has only
   `start`) — every backend "quality" job would fail on day one. Replaced
   with real gates: `node --check` across the backend sources and a **live
   smoke boot** (new; see 3).
2. **Frontend test job was fiction too** — no vitest installed. Frontend CI
   = `eslint .` + `npm run build` (which already runs `tsc -b`, the real
   typecheck). A vitest suite is a separate future phase.
3. **No automated test of the actual server existed — added one.** New CI
   job boots the API against real `postgres:15` + `redis:7` service
   containers and asserts `/api/health`, `/ready`, and `/metrics` respond.
   This requires one small env-gated change: `DB_SSL=false` support in
   `config/db.js` (Supabase needs SSL; the CI Postgres doesn't — default
   stays `true`, so production behavior is untouched).
4. **Deployment workflows pointed at an imaginary server.** No staging or
   production host exists: no `staging.crimelens.example.com`, no SSH
   secrets, no `/opt/crimelens`, no `docker-compose.staging.yml`, no
   migration script (`npm run migrate` doesn't exist), no rollback command
   (`docker-compose ... rollback` isn't a thing). The entire deploy workflow
   + staging compose + GitHub environments are **dropped and deferred**
   until a real host exists — same blocker bucket as the Cloudflare domain
   (phase 13). CI-only now: build, test, scan, publish to GHCR.
5. **Node 20 → Node 22** — the repo standardized on 22 in phase 9 (images,
   local dev); CI must match the runtime.
6. **Deprecated/outdated action versions** — `upload-artifact@v3` (→ v4),
   `codeql-action@v2` (→ v3), unpinned `trivy-action@master` (→ version
   tag). Bumped/pinned throughout.
7. **`npm audit --production` would sit permanently red** — the dependency
   tree already carries known advisories. Changed to
   `--audit-level=critical` so CI fails only on criticals while the report
   stays visible in logs.
8. **Codecov upload dropped** — no coverage is produced by any test runner;
   uploading `coverage/lcov.info` from nothing fails the step.
9. **The Trivy job rebuilt the image a second time for scanning** — kept the
   shape but the second build hits the GHA layer cache, so it costs seconds,
   not minutes.
10. **"Repository secrets" for Docker builds were redundant** — GHCR auth
    uses the automatic `GITHUB_TOKEN` with `packages: write`. Documented
    instead of listed as setup work.
11. **Release workflow kept** (it works and is useful) but its changelog
    command breaks on the first tag (`git describe` with no prior tag) —
    guarded with a fallback.
12. **Cache paths fixed** — `cache-dependency-path` entries were correct but
    each job re-declared setup; consolidated into a reusable composite step
    pattern per job for maintainability.

## Scope boundary

- **Deferred until a real deployment target exists** (VPS or PaaS):
  deploy.yml, staging/production environments, SSH secrets,
  docker-compose.staging.yml, migrations step, rollback. When it exists,
  the deploy workflow pulls the GHCR images this phase publishes.
- No new test frameworks (jest/vitest) — that's its own phase.
- Phase 13 (Cloudflare) remains deferred pending a domain.

## Implementation Steps

### Step 1: `DB_SSL` toggle (small, required by the smoke job)

`config/db.js`: `ssl: process.env.DB_SSL === "false" ? false : { require:
true, rejectUnauthorized: false }` — default unchanged (Supabase path).

### Step 2: `.github/workflows/ci.yml`

Trigger: `push` (dev, main) + `pull_request` (dev, main) + manual.
All jobs Node 22 + npm cache.

- **lint-frontend** — `npm ci && npm run lint`
- **build-frontend** — `npm ci && npm run build`; upload `dist` artifact
  (upload-artifact@v4, 7 days). Failing here = the Dockerfile.frontend
  builder stage will fail too, caught earlier and cheaper.
- **backend-syntax** — `node --check` over `server.js`, `worker.js`,
  `config/**/*.js`, `controllers/**/*.js`, `routes/**/*.js`,
  `services/**/*.js`, `middleware/**/*.js`, `validators/**/*.js`,
  `models/**/*.js`
- **backend-smoke** — services: `postgres:15` + `redis:7-alpine` (health
  gated); env: `DB_SSL=false`, `DATABASE_URL` to the service DB, `REDIS_URL`
  to the service Redis, `JWT_SECRET=ci_only_secret`, fake Supabase vars;
  steps: `npm ci`, start `node server.js` in background, poll
  `/api/health` → 200 with `mode:"redis"` rate limiting, `/api/ready` →
  200, `/metrics` → 200 containing `crimelens_`, then SIGTERM and assert
  clean exit; then boot `node worker.js`, assert started log line, SIGTERM.
- **codeql** — javascript-typescript, actions v3
- **npm-audit** — backend + frontend, `npm audit --omit=dev
  --audit-level=critical` (non-zero only on criticals; full report in log)

### Step 3: `.github/workflows/docker-build.yml`

Trigger: push to dev/main, tags `v*`, PRs (build-only on PRs).

- **build-backend / build-frontend** — buildx + `docker/build-push-action@v6`,
  push to `ghcr.io/<owner>/<repo>/crimelens-{backend,frontend}` with
  branch/semver/sha/latest tags via `docker/metadata-action@v5`;
  `cache-from/to: type=gha`; push only on non-PR events; `permissions:
  packages: write`.
- **scan-backend / scan-frontend** — needs its build job; rebuild with
  `load: true` (GHA cache makes this fast), Trivy (pinned version) SARIF
  CRITICAL+HIGH → `github/codeql-action/upload-sarif@v3`. Scans are
  informative gates: upload always, fail only on `ignore-unfixed: false`
  CRITICALs (threshold documented).

### Step 4: `.github/workflows/release.yml`

On `v*` tags: generate changelog (guarded for first-tag case via
`git describe ... || HEAD`), create GitHub Release
(`softprops/action-gh-release`, `contents: write`).

### Step 5: Validation (all live)

```bash
# act-style local validation is unreliable; validate by pushing the branch:
# 1. open a draft PR from feature/phase-14-cicd → observe ci.yml all green
# 2. observe docker-build.yml: builds (push skipped on PR), Trivy SARIF uploaded
# 3. push a v0.1.0-ci-test tag → release workflow creates the release,
#    then delete tag + release
# 4. verify GHCR images exist after merge (push event) — or temporarily
#    workflow_dispatch on the branch with push enabled, then delete images
# 5. confirm backend smoke job logs: health/ready/metrics assertions output
```

### Step 6: Docs

- `.env-sample` (backend) — document `DB_SSL` (defaults true; set false only
  for local/CI Postgres).
- README section: required checks for branch protection once set
  (`lint-frontend`, `build-frontend`, `backend-syntax`, `backend-smoke`,
  `scan-backend`, `scan-frontend`).

## Out of Scope

- Deployment to any server (deferred — no target exists; revisit with a
  VPS or the Vercel/Render option discussed for phase 13)
- jest/vitest test suites (separate phase; the smoke job is this phase's
  real signal)
- Branch-protection rule changes (repo settings, user-owned; documented)

## Success Criteria

- [ ] ci.yml all green on this phase's own PR (real checks, no fiction)
- [ ] backend-smoke proves: server boots against vanilla Postgres+Redis,
      health/ready/metrics respond, worker boots, clean SIGTERM exits
- [ ] docker-build.yml builds both images on PR; pushes to GHCR on dev/main;
      Trivy SARIF uploaded for both
- [ ] Tag push creates a GitHub Release
- [ ] No workflow references scripts, servers, or secrets that don't exist
- [ ] Production behavior unchanged (`DB_SSL` defaults to the current path)

## Files Created/Modified

```
.github/workflows/ci.yml            (new)
.github/workflows/docker-build.yml  (new)
.github/workflows/release.yml       (new)
db-project-backend/config/db.js     (edit — DB_SSL env toggle)
db-project-backend/.env-sample      (edit — DB_SSL documented)
Plans/phase-14-cicd/implementation-log.md (new)
Plans/phase-14-cicd/testing-log.md        (new)
```

## Rollback

Delete the three workflow files; revert the `db.js` toggle (one line). No
runtime behavior changes otherwise.

## Estimated Completion Time

- db.js toggle + workflow authoring: 1.5 h
- PR validation cycles (Actions runs are slow): 1–2 h
- Release/tag test + cleanup: 30 min
- **Total: ~3–4 h**
