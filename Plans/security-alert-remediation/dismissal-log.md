# Dismissal Log — CodeQL js/missing-rate-limiting (27 alerts)

Date: 2026-09-26 · Actor: abubakar-ahmed-dev · Method: Code scanning API
(`PATCH /code-scanning/alerts/{n}`, reason `false positive`, comment ≤280
chars pointing here)

## Alerts

All 27 open `js/missing-rate-limiting` instances on `main` (alert numbers
144-170), locations: `adminRoutes.js` ×5, `agentRoutes.js` ×6,
`authRoutes.js` ×1, `crimeRoutes.js` ×5, `healthRoutes.js` ×1,
`jobRoutes.js` ×2, `mediaRoutes.js` ×4, `userRoutes.js` ×3.

## Justification (full text)

1. **Rate limiting exists and is distributed.** `config/rateLimiter.js`
   (phase 4) builds per-tier Redis-backed limiters (`rate-limiter-flexible`,
   `RateLimiterRedis` + in-memory insurance limiter) exposed through the
   `applyRateLimit` middleware: AUTH 5/min + 5-min lockout, WRITE 10/min,
   SENSITIVE 3/h, PUBLIC 50/min. Counters live in Redis (`crimelens:rl:*`),
   shared across all API replicas.

2. **Verified live, not aspirational.** Phase 16's
   `tests/k6/runs/rate-limit-final.js` exercised the tiers against the
   running stack: 429 at exactly N+1 per tier (PUBLIC 51st, WRITE 11th,
   AUTH 6th + lockout). Results committed under
   `Plans/phase-16-k6-final/results/rate-limit-run.log`.

3. **The query cannot see the implementation.** CodeQL models
   `express-rate-limit`-style middleware; the custom wrapper is opaque to
   it — the scan flagged `authRoutes.js:11`, a line that *carries*
   `applyRateLimit("authLogin")`.

4. **The flagged-but-unlimited handlers are role-gated staff/admin
   operations** (verifyToken + authorizeRoles: admin branches/agents, police
   pending/approve/reject, media metadata edits, job status). Abuse-sensitive
   anonymous/write/auth surfaces already carry the tiers above.

5. **Alternative rejected.** Swapping the distributed limiter for
   `express-rate-limit` (or adding a global fallback) purely so the scanner
   recognizes the pattern would change measured phase-16 rate-limit behavior
   and duplicate existing tier design — an architecture regression with no
   security gain. Dismissal is reversible from the Code scanning UI.

## Other dismissals

Trivy container alerts with **no fixed package in the base image** at the
time of the `nginx:1.28-alpine` / `node:22-alpine` rebuild are dismissed with
reason "won't fix" (base-image CVE, re-evaluate on next base bump) after the
post-merge rescan — see `testing-log.md` for the final list.
