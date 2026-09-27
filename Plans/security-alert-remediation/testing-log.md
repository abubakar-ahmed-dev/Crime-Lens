# Testing Log — security-alert-remediation

Branch: `feature/security-alert-remediation` · PR #31 → `dev` · Dates:
2026-09-26/27

## Static gates (local)

| Check | Result |
|---|---|
| Backend `node --check` (3 changed files) | PASS |
| Frontend ESLint | PASS (0 errors; 13 known exhaustive-deps warnings) |
| Frontend `tsc -b` | PASS |
| Frontend `vite build` | PASS (known chunk-size warning only) |
| Backend ESLint | NOT RUN — backend has no ESLint config (deferred, KNOWN_ISSUES) |

## Sanitizer verification (A3)

`checks/verify-sanitizer.md` (runnable copy + recorded output):

- Benign inputs: byte-identical old vs new (5/5)
- Script blocks / event handlers: parity on common forms; `</script >`
  variant now stripped (old miss)
- Adversarial timing: `<script>` markers ×40k **1268ms → 45ms**; all
  flagged ReDoS shapes bounded (<50ms)
- Intentional delta: `javascript:` substring strip removed (bypassable;
  flagged by CodeQL as js/incomplete-url-substring-sanitization)

## URL sanitization (A2)

isCloudinaryUrl spot-cases 7/7 PASS (valid hosts accept; `evil.com/...`
spoof, cross-host suffix, raw-resource path, unparseable rejected).

## CI (PR #31, final commit ea296fa)

All 12 checks **pass**, including the code-scanning results checks:

```
Lint Frontend: PASS          CodeQL: PASS (results check — was failing on #30)
Build Frontend + tsc: PASS   CodeQL Analysis: PASS
Backend Syntax: PASS         Trivy (results check): PASS
Backend Smoke (real PG/Redis, worker SIGTERM): PASS
Build Backend/Frontend Image: PASS
Scan Backend/Frontend Image (Trivy): PASS
Dependency Audit (criticals): PASS
```

Iteration history: first push failed the "CodeQL" results check with 3 new
alerts (2 = the deliberately-vulnerable fixtures in `verify-sanitizer.mjs`,
1 = the `javascript:` strip). Fixed by removing the bypassable strip,
excluding `**/Plans/**` from CodeQL analysis, and storing the check as
markdown evidence. Second push still flagged the fixture file → converted to
markdown, third push fully green. This loop is itself evidence the gate
works.

## Docker (C)

- Local rebuild on the branch: `nginx/1.28.3` reported inside
  `crimelens-main-frontend-1`; stack healthy through edge
  (`/api/health` healthy, `/api/ready` 200)

## Playwright / browser validation (A2, user-executed)

Playwright MCP credential entry was declined by the user; the user ran the
check manually on the running stack and confirmed:

- Admin/police record views with media: image thumbnails render (real
  Cloudinary previews, no broken icons/placeholders)
- Video thumbnail renders; click-through to full media works

Result reported by user: "all test passed, i verified it" (2026-09-27).

## Alert state

- 27 × `js/missing-rate-limiting`: dismissed (see `dismissal-log.md`)
- Remaining CodeQL alerts fixed by this branch; they close when the merged
  code is analyzed on `main`
- Trivy: fixed-by-base-bump CVEs auto-close on the post-merge rescan;
  residual no-fix CVEs to be dismissed with "won't fix" + recorded in
  `docs/KNOWN_ISSUES.md` (post-merge step)
