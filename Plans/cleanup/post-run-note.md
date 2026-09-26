# Cleanup Post-Run Note

Execution: 2026-09-23 (non-Docker) + 2026-09-24 (Docker items). Branch
`feature/cleanup`. Every A-item decision came from the user.

| Item | Action | Result |
|---|---|---|
| A1 pending test reports | Two-step deletion script built (`scripts/cleanup/delete-test-pending-reports.mjs`, dry-run default). Dry run found **0 pending crimes** | **RESOLVED EXTERNALLY** — see anomaly note below |
| A2 test agents | kept (user decision) | n/a |
| A3 merged branches | kept (user decision) | n/a |
| A4 homepage worktree | 5 untracked plan docs archived to `temp/homepage-worktree-docs/`, worktree removed, `worktree-homepage-redesign` (0 unique commits) + `homepage-design` (2 experiment commits, reflog-recoverable) deleted | DONE 09-23 |
| A5 raw k6 JSON | 6/6 SHA-256 verified → 1.5 GB deleted; aggregates + checksums stay committed | DONE 09-23 |
| A6 `crimelens-redis-host` | Docker Desktop was uninstalled+reinstalled by the user — **container gone with the old install** | MOOT |
| A7 compose stack | fresh install: 0 containers, 0 images, 0 volumes | MOOT |
| B1 image/builder prune | fresh install has nothing to prune (`docker system df` empty) | MOOT |
| B2 redis residue | no Redis instances exist post-reinstall | MOOT |
| B3 `temp/` mockups | kept in place; worktree docs joined them | DONE |
| B4 `.playwright-mcp/` | deleted (406 KB) | DONE 09-23 |
| B5 tracked tsbuildinfo | untracked + gitignored; `npm run build` PASS (18.9s) after | DONE 09-23 |

## A1 anomaly note (recorded honestly)

On 2026-09-18 the comparison rerun created 261 pending reports (263
attempts) and the citizen dashboard showed 229 pending on 2026-09-17. On
2026-09-24 the direct-DB dry run found **17 crimes total, all with
reportedAt ≤ 2026-08-24, zero September rows, zero pending** (approved 10,
rejected 3, deleted 4; CrimeSubmission rows = 17, consistent). The compose
stack used the same `db-project-backend/.env` DATABASE_URL this script
queried, so the writes did land in this database. Conclusion: pending test
rows were removed out-of-band between 2026-09-18 and 2026-09-24 (user
cleanup or a Supabase restore) — not by this session. A1's objective
(clean pending test data) is met; the committed script remains as the
reusable, dry-run-first tool for any future occurrence.

## Final state

- Git: worktree + 2 branches removed, build artifacts untracked, 1.5 GB
  local raw deleted (checksums committed), cleanup tooling + this note
  committed.
- Docker: fresh Desktop install, zero containers/images/volumes — clean
  slate. Recreating the stack later = `docker compose ... up -d --build`
  (images rebuild from committed Dockerfiles).
- Supabase: 17 crime rows (approved 10 / rejected 3 / deleted 4), no
  pending, test agents kept per user decision.
