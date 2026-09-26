# Phase 1: PostgreSQL Optimization & Pagination — Implementation Log

## Status: IMPLEMENTED (2026-08-31)

Branch: `refactor/query-optimization` (off `k6-baseline`/`dev` line).
Plan: `plan.md` in this folder (opt-in pagination design, user-approved).

## What Was Implemented

### 1. Pagination utility — `utils/pagination.js` (new)

- `parsePaginationParams` / `buildPaginationMeta` / `buildPaginatedResponse`.
- `DEFAULT_LIMIT` / `MAX_LIMIT` read `DEFAULT_PAGE_SIZE` / `MAX_PAGE_SIZE` env vars
  (defaults 50 / 200) — no dead config.
- `buildPaginationMeta` normalizes pg's string COUNT to a number.

### 2. Opt-in pagination — `getCrimesForMap` (`controllers/CrimeControllers.js`)

- Pagination activates ONLY when `page` or `limit` query params are present.
  Without them: legacy bare-array response, full media per crime, no ORDER BY —
  byte-compatible with pre-change behavior (verified against captured baseline).
- Paginated mode adds:
  - COUNT over a subquery sharing the identical JOIN/WHERE set (correct totals
    under crimeType/zone/date/radius filters).
  - `ORDER BY c."reportedAt" DESC, c.id DESC` + `LIMIT :limit OFFSET :offset`
    (deterministic ordering; tiebreaker on id).
  - Media capped at `LIMIT 3` per crime (map preview); legacy mode keeps full media.
- Error shape: legacy mode still returns `500 []`; paginated mode returns
  `500 { success, message }`.

### 3. Opt-in pagination — `getAllCrimes` (same file)

- Same opt-in trigger. Legacy mode: unchanged `{ success, data }` full dataset.
- Paginated mode: `COUNT(*) FROM "Crime" WHERE status='approved'` + existing
  deterministic ORDER BY + `LIMIT/OFFSET` + pagination metadata.
- Media fetch unchanged (police list keeps all media per crime).

### 4. `getStatsSummary` optimization (`controllers/statsController.js`)

- Replaced the two `findOne` + correlated-subquery-per-row top-type/top-zone
  queries (Phase 0's worst endpoint: baseline P50 4.8s, stress P50 29.4s) with
  single aggregate `GROUP BY ... LEFT JOIN ... ORDER BY count DESC LIMIT 1` queries.
- Response shape verified identical: same keys, same values, `crimeCount` still
  pg string type, `null` when tables empty (matches previous findOne behavior).

### 5. Connection pool — `config/db.js`

- Env-driven: `DB_POOL_MAX` (default 10, up from hardcoded 5 — Phase 0 identified
  pool max 5 as the global throughput ceiling), `DB_POOL_MIN` (default 0).
- Explicit default branch: same pool regardless of `NODE_ENV` value (the original
  plan's dev/prod branching silently fell through to Sequelize defaults when
  `NODE_ENV` was unset).
- `benchmark: true` in development only. No global `define.timestamps` override
  (models set it individually; `CrimeReportsSubmitter` uses `true`).

### 6. Slow-request logger — `middleware/queryLogger.js` (new) + mount in `server.js`

- Dev-only (`NODE_ENV === 'development'`); logs requests whose response took >100ms.
- Mounted in `server.js` immediately after `express.json()` (the plan originally
  omitted the mount; added).
- No-op in other environments. Pino structured logging remains Phase 7.

### 7. Performance indexes — `scripts/add-performance-indexes.sql` (new) + applied

Live `pg_indexes` audit (2026-08-31) corrected the plan's assumptions:
17 indexes already existed (supabase-setup.sql btree + GIST indexes;
migration-media-upload.sql `CrimeMedia` indexes including
`idx_crime_media_crime_visibility` = the plan's media-visibility target).

Applied (4 indexes, 17 → 21 total, all guarded `IF NOT EXISTS` + `ANALYZE`):

| Index | Purpose |
|---|---|
| `idx_crime_status_reported (status, reportedAt DESC)` | map hot path |
| `idx_crime_approved_date (reportedAt DESC) WHERE status='approved'` | smallest hot-path index (partial) |
| `idx_crime_stats_covering (crimeTypeId, status, reportedAt)` | stats group-bys |
| `idx_crime_zone_status (zoneId, status)` | zone-filtered approved queries |

Skipped from the original plan, with reasons:
- `idx_crime_type_status` — leftmost prefix of `idx_crime_stats_covering` (redundant).
- `idx_crime_media_visibility` — already exists as `idx_crime_media_crime_visibility`.

`EXPLAIN (ANALYZE, BUFFERS)` on the paginated map query confirms
`Index Scan using idx_crime_approved_date` (execution 0.25ms server-side at
current row counts).

### 8. Env & docs

- `.env-sample`: added `DB_POOL_MAX=10`, `DB_POOL_MIN=0`, `DEFAULT_PAGE_SIZE=50`,
  `MAX_PAGE_SIZE=200` (placeholders; no existing vars renamed).
- `routes/crimeRoutes.js`: comment-only documentation of the opt-in contract.
- `config/envValidation.js` untouched (new vars are optional with safe defaults).

## Deliberately NOT Done

- No frontend changes (opt-in design keeps param-less responses identical).
- `getPendingSubmissions` remains unpaginated (out of phase scope; candidate later).
- Pre-existing bug NOT fixed (out of scope): `CrimeControllers.js` `updateCrime`
  reads `mediaStats[0].firstthumbnail` but the SQL alias is `firstThumbnail` —
  thumbnail can be nulled on media updates via that path. Flagged for a future fix.
- k6 comparison run deferred to Phase 15 (user decision: load testing runs after
  all phases, not per phase). Index/pool/query changes are individually verified
  by the checks below instead.

## Validation Executed (by Implementation Agent)

```text
node --check (7 touched/created JS files):        PASS
Legacy parity GET /api/crimes (no params):        PASS — bare array, same ids,
                                                  same row shape as pre-change baseline
Legacy parity GET /api/crimes/all:                PASS — { success, data }, 12 rows,
                                                  same keys, media uncapped, police-only (403 unauth)
Paginated map (?page=&limit=):                    PASS — envelope, meta math, page separation,
                                                  full 3-page union == legacy ids, media cap ≤3
Param edge cases:                                 PASS — limit 99999→200, page abc→1,
                                                  page -2→1, beyond-last→empty data + correct meta
Filters + pagination (crimeType/zoneId/radius):   PASS
Stats shape parity:                               PASS — identical keys/values, string crimeCount
pg_indexes before/after snapshots:                PASS — 17 → 21, no near-duplicates
EXPLAIN ANALYZE paginated map query:              PASS — uses idx_crime_approved_date
Playwright MCP browser regression:                PASS — map renders markers/clusters/popups from
                                                  legacy array payload; /all-records (police) shows all
                                                  12 records and client-side "Crime Type = Theft" search
                                                  filters correctly; /statistics shows correct summary
                                                  values (Top Crime Theft, Top Zone North Nazimabad);
                                                  zero user-visible changes
ESLint / TypeScript / unit tests / build:         N/A — not configured in backend
                                                  (package.json has no lint/test/build scripts)
k6 comparison:                                    DEFERRED to Phase 15 (user decision)
```

## Test Artifacts

Pre-change baselines, pg_indexes snapshots, and the test scripts were run from a
temp directory outside the repo (nodemon-restart hazard noted in Phase 0 log).
Baseline values referenced above: 12 approved crimes, 4 zones, 7 crime types in
the local dev database.

## Known Issues / Follow-ups

1. `firstthumbnail` alias typo in `updateCrime` (pre-existing; see above).
2. `Crime.mediaCount` can drift from actual media rows (dev data: crime 20 has
   `mediaCount=4` but 2 rows) — pre-existing denormalization drift, not touched.
3. Crimes with `location` at (0,0) exist in dev data (ids 7, 9) — data quality,
   pre-existing.
4. Frontend adoption of pagination (page/limit params) is intentionally deferred;
   the backend contract is live and documented when needed.
