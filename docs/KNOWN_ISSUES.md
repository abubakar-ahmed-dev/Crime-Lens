# Known Issues

Current known limits and deferred work. Items fixed during the 16-phase
system-design upgrade were removed from this list; the phase record in
`Plans/` is the full history (the former REQUIRED_FIXES checklist was
triaged: every resolvable item was resolved and verified by its phase —
open items live here).

## Build Warnings (non-blocking)

`npm run build` in `db-project-frontend` passes but Vite reports:

- CSS `@import` order warning for the Outfit font import.
- Large JavaScript chunk warning after minification (single ~1.3 MB bundle;
  code-splitting is a future improvement).

## No Real Test Suites

CI covers frontend lint + build (tsc), backend syntax, and a live smoke boot
against real Postgres/Redis, plus k6 suites run manually — but there are no
jest/vitest unit/integration suites yet. Recorded as deferred work.

## Lint Debt (accepted)

13 `react-hooks/exhaustive-deps` warnings remain in the frontend
(intentionally — fixing them changes effect timing and risks behavioral
regressions). CI enforces errors only; the warnings stay visible in lint
output for a future behavioral-cleanup pass.

## Setup SQL And Views

- Production seed data for zones is not included in `supabase-setup.sql`;
  zones must exist for zone-based features.
- Whether `activitylog` should be filled by database triggers is not
  implemented in current code.

## UploadLog Enum Difference

The `UploadLog` model enum and the setup SQL enum differ slightly in
allowed values; reconciling them needs a live-DB migration decision.

## Infrastructure Limits (measured, deferred)

- **Ephemeral monitoring**: Grafana has no persistent volume; dashboards
  reset when the stack is recreated.
- **Single-host ceiling**: ~100–110 req/s open-model on a mixed profile;
  the Postgres connection pool (10) is the binding resource. Next lever is
  DB-side (radius query tuning/index), not the web tier.
- **Deferred phases**: Cloudflare/TLS/CDN (needs a domain), hosted
  deployment (needs a host — GHCR images are ready), real test suites.
