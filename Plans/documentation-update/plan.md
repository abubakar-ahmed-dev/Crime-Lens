# Documentation Update Plan — merge-to-main readiness

Goal: when `dev` merges to `main`, the repo reads like a professional
production-style project: accurate flagship README, current `docs/`, no
pre-upgrade debt docs contradicting reality, clean structure, zero secrets.

Audit basis (2026-09-24): README (160 lines) describes the pre-upgrade app
well but omits the entire 16-phase system-design work; `docs/` has 10 files
(SETUP/AUTHORIZATION/DATABASE flagged stale by their own text;
REQUIRED_FIXES is a half-ticked pre-upgrade checklist); frontend README is
the raw Vite template; backend has no README; no LICENSE; the live-demo
Vercel link predates the infra work.

## Principles

- Every claim verified against code/config before it is written (no doc
  fiction — the same rule that governed the phase reports).
- Keep `docs/` filenames stable so existing links keep working; refresh
  content in place; new topics get new files.
- `CLAUDE.md` files and `Plans/**` are engineering/agent records — they stay
  as-is (Plans IS the audit trail; the README will link to it as history).
- No secrets: env values only in `.env-sample` files, hostnames redacted.

## 1. Root `README.md` — full rewrite (flagship)

Structure:

1. **Title + badges** — CI (`ci.yml`), CodeQL, GHCR images
   (`docker-build.yml`), license badge (once LICENSE exists)
2. **One-paragraph pitch** + screenshot (reuse existing repo assets)
3. **Features** — condensed from current README (roles/features stay, tightened)
4. **Architecture** — mermaid diagram of the real system:
   `client → nginx edge → API replicas (stateless) → Postgres/PostGIS
   (Supabase)`, with Redis (cache + rate limits + BullMQ), worker,
   Prometheus/Grafana, Cloudinary
5. **System-design upgrades** — compact 16-phase table: phase → what it
   delivers → measured result (from the phase reports; only measured numbers)
6. **Performance** — headline results (2.2× baseline throughput, 8.7× stress,
   p95 −87/−92%, 100% cache hit ratio, verified rate-limit tiers, ~100–110
   req/s single-host ceiling with DB-pool analysis) + link to
   `Plans/phase-16-k6-final/results/baseline-comparison/comparison-report.md`
7. **Quickstart (Docker)** — one-command compose up + URL table (edge 18000
   etc. via documented override) + health checks
8. **Manual development** — condensed, points to `docs/SETUP.md`
9. **Environment variables** — pointer table to the two `.env-sample` files
10. **Testing & validation** — lint/typecheck/build, CI jobs, k6 suites,
    Playwright convention
11. **Project structure** — annotated tree
12. **Documentation index** — links into `docs/`
13. **Deployment** — GHCR images + `docs/DEPLOYMENT.md` pointer
14. **License**

## 2. `docs/` refresh (in place) + 3 new files

| File | Action |
|---|---|
| `SETUP.md` | Rewrite: Docker-first quickstart, then manual dev; full env tables; Supabase/PostGIS/Cloudinary/Google-OAuth setup pointers; k6 credentials env (gitignored `.k6.env` pattern) |
| `ARCHITECTURE.md` | Extend to current reality: nginx edge, stateless API, Redis cache-aside (keys/TTL/invalidation/failure), rate-limit tiers table, BullMQ worker design, pool budget math (instances × 10 ≤ 60), observability stack; mermaid diagrams |
| `API.md` | Re-verify against `routes/*.js`: add `/api/health`, `/api/ready`, `/metrics`, `/api/jobs/*` (admin), rate-limit headers + per-route tiers, pagination conventions; mark auth requirements per endpoint |
| `DATABASE.md` | Pool config (env-driven max 10), key tables, PostGIS usage, `EXPLAIN ANALYZE` convention, connection-budget note |
| `OBSERVABILITY.md` (new) | Metrics list (what each is for), Grafana provisioning, log fields, health/ready semantics, queue-depth/pool queries incl. correct `state=` label usage |
| `OPERATIONS.md` (new) | Runbook: compose up/scale (`scripts/scale-backend.sh`), `analyze-db-pool.js`, queue admin endpoints, cache flush patterns (`crimelens:*` vs `bull:*`), failure drills (Redis down, replica kill) with expected behavior |
| `DEPLOYMENT.md` (new) | GHCR image names/tags produced by CI, compose deploy path, env checklist, what remains deferred (host, TLS/CDN) |
| `KNOWN_ISSUES.md` | Prune stale; keep true items (chunk-size warning, ephemeral Grafana volume); add the deferred-work register (Cloudflare/domain, host, real test suites, 13 exhaustive-deps warnings, DB radius tuning as next lever) |
| `REQUIRED_FIXES.md` | Audit every checkbox against current code: mark genuinely-fixed items done, move still-open ones into KNOWN_ISSUES, then either delete the file or shrink to an "resolved history" note — decision below |
| `AUTHORIZATION.md`, `CSV_UPLOAD.md`, `GOOGLE_OAUTH_SETUP.md`, `FRONTEND_ROUTES.md` | Verify against code; light corrections only |
| `PERFORMANCE.md` (new, small) | Methodology (k6, closed vs open model), headline tables, link to full comparison report — for readers who won't open `Plans/` |

## 3. Sub-project READMEs

- `db-project-backend/README.md` (new): scripts, env, structure, worker, k6 suite locations
- `db-project-frontend/README.md`: replace Vite template with real content (scripts, env, structure)

## 4. Repo hygiene for a professional main branch

- `LICENSE` — needs your decision (type + name/year; MIT recommended)
- `PROJECT_ANALYSIS.md` — superseded pre-upgrade analysis → move to
  `docs/history/PROJECT_ANALYSIS.md` (decision below)
- Verify: all README/docs links resolve; mermaid renders on GitHub; no
  credentials anywhere (grep pass); live-demo Vercel link — confirm the
  old deployment still exists or drop the link (decision below)
- Validation bracket: link check, markdown lint by eye, `git diff` review,
  CI green on the PR

## Decisions needed from you

1. **LICENSE**: MIT? (name to put in it — your name/handle, year 2026)
2. **Live demo link**: keep `crimelens-ten.vercel.app` (still your old
   deployment?) or drop until a real deployment exists?
3. **`PROJECT_ANALYSIS.md`**: archive to `docs/history/` or delete?
4. **`REQUIRED_FIXES.md`**: after triage — delete file (resolved items noted
   in commit history) or keep as resolved-history page?
5. **Screenshots**: reuse existing repo images, or do you want fresh
   screenshots of the current UI (map/dashboard/stats) for the README?

Unanswered items default to: MIT with your GitHub display name, drop demo
link, archive to `docs/history/`, keep REQUIRED_FIXES as resolved-history,
reuse existing images.

## Execution

One branch `feature/documentation-update`, one commit per section group
(root README / docs refresh / sub-READMEs / hygiene), PR to `dev`, link +
secret-scan pass, CI green, then dev → main is clean.

Estimated: audit-verify ~1.5 h, writing ~2.5 h, hygiene + checks ~1 h.
