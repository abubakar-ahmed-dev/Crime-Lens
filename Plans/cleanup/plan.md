# Post-Roadmap Cleanup Plan

Scope: remove everything the 16-phase implementation left behind that is no
longer needed — without touching anything production-relevant or user-owned.
Every item below lists evidence, the action, and whether it is
safe-to-auto-execute or needs your approval.

Executed on branch `feature/cleanup` (one PR), Docker Desktop must be
running. Verification bracket at the end (stack healthy, lint/build green,
nothing user-owned touched).

---

## A. Needs your decision (destructive / user-owned)

| # | Item | Evidence | Options |
|---|---|---|---|
| A1 | **~261 pending "Load Test Crime" reports** in shared Supabase (write-lane rerun) + **~233** from phase-0 runs + earlier k6 writes; also phase-16 invalid-payload probes created 0 | Public approved total is 6 — none of these pollute public reads; they sit in the admin/police verification queue | (a) delete via admin API (count recorded before/after), (b) keep as demo data |
| A2 | **Test agents** (`abuu`, `abuuu`, `bbu`, … from verification-flow testing) | Visible in Agent Records screenshot evidence | delete via admin API or keep |
| A3 | **25+ merged branches** (local + remote): all `feature/phase-*` + legacy `feat/*`, `refactor/*`, `security/*`, `perf/*`, `fix/*`, `k6-baseline`, `logging/pino`, `monitor/prometheus`, `Update/Schema/*` — every one verified merged into `dev` | `git branch --merged dev` | delete all merged (local + remote), keep `main`/`dev` |
| A4 | **`.claude/worktrees/homepage-redesign` worktree + `homepage-design` branch** | Contains YOUR untracked homepage plan docs (`HOMEPAGE_*PLAN.md` etc.) — **user-owned work in progress** | NOT touched by this cleanup unless you say so |
| A5 | **1.5 GB raw k6 JSON** under `Plans/phase-16-k6-final/results/baseline-comparison/raw/` | gitignored, SHA-256 checksums committed | verify checksums then delete locally (aggregates + logs stay in git) |
| A6 | **`crimelens-redis-host`** container (host Redis :6379, AOF, restart=unless-stopped) | was a workaround for the dying Windows redis binary; compose stack has its own Redis; host-run `npm start` backend uses it | (a) keep for host-run dev, (b) stop+remove (compose redis covers Docker workflow) |
| A7 | **Full compose stack** (7 containers) | currently running (Docker Desktop was stopped at audit time) | (a) keep for demos, (b) `docker compose down` (images retained, restart cheap) |

## B. Safe to auto-execute (no approval needed)

| # | Item | Action |
|---|---|---|
| B1 | **Dangling/unused Docker images + build cache** — old `crimelens-api`/frontend layers from repeated `--build` runs, phase-test postgres/redis service images | `docker image prune -f` + `docker builder prune -f` (tagged images in use are untouched); report freed GB via `docker system df` before/after |
| B2 | **Expired Redis keys** — both instances (compose + host) hold only TTL'd cache/limiter residue; queue `bull:*` keys preserved | verify `crimelens:*` count ≈ 0; delete ONLY `crimelens:stats/reference/crimes` patterns if any remain; never `FLUSHALL` |
| B3 | **`temp/` dir** (2.7 MB: old homepage mockups `Crimelens-homepage-*.png`, blog/design notes) | confirm with git (untracked, superseded by the homepage worktree docs) → move INTO the homepage worktree instead of deleting (user-owned content, relocated not destroyed) |
| B4 | **`.playwright-mcp/`** session snapshots (406 KB) | delete (regenerable session artifacts) |
| B5 | **Tracked build artifacts** `tsconfig.app.tsbuildinfo` / `tsconfig.node.tsbuildinfo` — churn in every git status | `git rm --cached` + gitignore (needs a commit; behavior-neutral) — borderline approval, flagged here since it changes tracked files |
| B6 | **GHCR dev-tagged images** (`crimelens-{backend,frontend}:dev`, `:sha-*`, `:feature-phase-14-cicd`) | leave — they are the deployment-ready artifacts (phase-14 deliverable); delete only on request |
| B7 | **Node processes** — none listening on 5001/5173/8080 at audit time | verify again at execution; kill strays if any appear |

## C. Execution order

1. Record before-state: `docker system df`, container/image lists, DB pending-report count (admin API), redis key counts, checksum verification of raw k6 files.
2. Apply approved A-items + all B-items (one logical commit per area).
3. Restore-state check: compose stack up (or down, per A7), `/health` + `/ready` green, lint + typecheck + build pass (B5 touches tracked files), `git worktree list` shows homepage worktree intact.
4. Single PR `feature/cleanup` → dev with the before/after table in the description.
5. Post-run note appended to `Plans/cleanup/` recording exactly what was removed and what was kept.

## Explicitly NOT touched

- Supabase schema, branches, agents/branches/zones reference data (except approved A2 test agents)
- Cloudinary media (deletion queue already handles orphans via worker)
- GHCR images (B6), `main`/`dev` branches, all `Plans/**` evidence except A5 raw files
- homepage worktree + its branches (A4) — yours
