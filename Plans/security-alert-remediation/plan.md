# Security Alert Remediation Plan — CodeQL + Trivy (post-merge cleanup)

## Goal

Zero open code-scanning alerts on `main` after this PR merges, with:
- No architecture changes (Redis limiter stays, no new security deps)
- No behavior changes to validated APIs (same status codes, same payloads)
- All remediation evidence-based (each alert either fixed in code or
  dismissed with a written justification)

Success criteria (measurable):
1. Code-scanning on `main`: 33 CodeQL alerts → 0 open (5 fixed + 28 dismissed
   with justification)
2. Trivy container alerts: reduced to only CVEs with no available base-image
   fix, each dismissed with "no fix available" justification
3. "CodeQL" results check green on the next PR that touches backend/frontend
   code
4. Regression gates all pass (lint, tsc, build, syntax, smoke boot, k6 smoke
   + rate-limit lanes, Playwright for the one frontend change)

## Background

PR #30's "CodeQL" check failed (run 108343932752): the check compares
CodeQL SARIF against the PR diff; the diff vs the stale `main` was the whole
16-phase upgrade, so 32 alerts were attributed as "introduced". The
screenshot commit only triggered the re-run. Merging left 133 open alerts on
`main`: 33 CodeQL (code) + ~100 Trivy (container base images).

## Findings and actions

### A. Fix in code (6 alerts, 4 files)

| # | Alert | Location | Root cause | Fix |
|---|---|---|---|---|
| A1 | `js/type-confusion-through-parameter-tampering` (critical) | `db-project-backend/controllers/mediaController.js:69` | `req.body.captions` trusted as array; tampered string makes `captions.length` string-length and breaks the caption/file match check | Coerce explicitly: `Array.isArray(captions) ? captions : []` before use. Non-array input → `[]` → existing `CAPTION_MISMATCH`/no-caption path unchanged for valid clients |
| A2 | `js/incomplete-url-substring-sanitization` | `db-project-frontend/src/utils/thumbnailUtils.ts:12` | `isCloudinaryUrl` uses `url.includes('cloudinary.com')` — `https://evil.com/cloudinary.com/...` passes | Parse with `new URL()` (prepend `https://` if scheme missing, preserving legacy no-scheme URL handling), check `hostname === 'res.cloudinary.com' \|\| hostname.endsWith('.cloudinary.com')` + pathname segments. Unparseable → `false` (same as today's non-Cloudinary path) |
| A3 | `js/polynomial-redos` ×2 + `js/bad-tag-filter` ×1 | `db-project-backend/middleware/validationMiddleware.js:54,64,65` | Hand-rolled `SANITIZE_PATTERNS`: `<script[\s\S]*?<\/script>` (lazy-dot-all = ReDoS-prone, misses `</script >`), `on\w+\s*=\s*(...)` on uncontrolled input | Replace regex loop with linear, indexOf-based scanner: `stripScriptBlocks` (matches `<script...>` … `</script>` with optional whitespace before `>`, fixes bad-tag-filter too), `stripEventHandlers` (single-pass scan), keep linear `/javascript:/gi`. Pure function; same strip semantics for benign input; worst-case O(n) — verified with adversarial timing test vs old regex |
| A4 | `js/polynomial-redos` ×1 | `db-project-backend/controllers/citizenAuthController.js:27` | Manual `emailRegex.test()` — flagged pattern; redundant: route already runs `validate(citizenRegisterSchema)` with `z.email().max(254)` before the controller | Delete the manual email-format check from `registerCitizen`; zod schema is the single validator (also removes dual-source drift) |

### B. Dismiss with justification (27 alerts)

`js/missing-rate-limiting` on 27 route handlers. CodeQL does not recognize
CrimeLens's custom `applyRateLimit(...)` wrapper (it flagged
`authRoutes.js:11`, which HAS a limiter on the flagged line). Evidence that
limiting exists and works:

- Redis-backed `rate-limiter-flexible` tiers (`config/rateLimiter.js`): AUTH
  5/min + 5-min lockout, WRITE 10/min, SENSITIVE 3/h, PUBLIC 50/min
- Verified live in phase 16 (`rate-limit-final.js`): 429 at exactly N+1 per
  tier, shared across replicas

Dismissal comment (per alert): rate limiting present via distributed
Redis-backed middleware on the abuse-sensitive tiers; remaining flagged
routes are authenticated role-gated staff/admin operations; swapping the
distributed limiter for `express-rate-limit` (the pattern CodeQL recognizes)
would be an architecture regression.

Rejections considered: adding a global fallback limiter changes measured
phase-16 behavior and duplicates tier design — rejected per no-overengineering
rule.

### C. Base image bump (Trivy ~100 alerts)

| Image | Current | Action |
|---|---|---|
| `Dockerfile.frontend` runtime | `nginx:1.25-alpine` (EOL since May 2024; source of libxml2/libxslt/musl/busybox/curl/openssl CVEs) | Bump to current stable `nginx:1.28-alpine` |
| `Dockerfile.frontend` builder + `Dockerfile.backend` | `node:22-alpine` | Floating tag — already tracks patched alpine; rebuild refreshes digest |

After rebuild+push, Trivy rescans in `docker-build.yml`; GitHub auto-closes
alerts absent from the new scan. CVEs still reported with no fixed package
in alpine → dismiss each with "no fix available in base image; re-evaluate
on next base bump" and record in `docs/KNOWN_ISSUES.md`.

## Files changed (expected)

```
db-project-backend/controllers/mediaController.js        # A1
db-project-backend/controllers/citizenAuthController.js  # A4
db-project-backend/middleware/validationMiddleware.js    # A3
db-project-frontend/src/utils/thumbnailUtils.ts          # A2
Dockerfile.frontend                                      # C
docs/KNOWN_ISSUES.md                                     # C residual CVEs
Plans/security-alert-remediation/…                       # logs + evidence
```

Dismissals are API actions (no repo files), logged in
`Plans/security-alert-remediation/dismissal-log.md`.

## Execution order

1. Branch `feature/security-alert-remediation` off `dev`
2. A3 → A1 → A4 (backend), local ReDoS timing check + sanitizer behavior
   spot-check via node script
3. A2 (frontend), then Playwright: media gallery thumbnails render for
   citizen + police views
4. C (Dockerfile bump), docker build both images, stack up, smoke
5. Full gate: ESLint, tsc/build, `node --check`, backend smoke boot, k6
   smoke-test.js + rate-limit lanes (429 at N+1 unchanged)
6. PR → `dev`; verify PR's "CodeQL" results check passes
7. After merge: Trivy rescan on dev; dismiss residual no-fix CVEs; verify
   main-side alert count after next dev→main sync

## Risks

- Sanitizer rewrite: must keep strip semantics identical for benign inputs —
  covered by behavior spot-check before/after on sample payloads (report
  form strings, script-tag attacks, `</script >` variant)
- thumbnailUtils: only consumer is `MediaGallery.tsx`; Playwright validates
  real thumbnails
- Dismissals are reversible (Code scanning UI can restore alerts)
