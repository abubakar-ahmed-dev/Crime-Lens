# Phase 1: PostgreSQL Optimization & Pagination — Testing Log

## Testing Record — 2026-08-31

Environment: Windows 10 Pro, backend via `npm start` (nodemon, hot-reload),
Supabase PostgreSQL (remote), frontend via Vite dev server (Playwright checks).
Police-role access for `/crimes/all` via a 1-hour dev test JWT signed with the
backend's `JWT_SECRET` (same `verifyToken` path as a real login; user-approved).

## Pre-Change Baseline Capture

Before any code change, captured from the running pre-change backend:

- `GET /api/crimes` → bare array, 12 crimes, full media (map-legacy)
- `GET /api/crimes/all` (police JWT) → `{ success, data[12] }`, full media per row
- `GET /api/stats/summary` → `{ totalZones:4, totalCrimes:6, topCrimeType:Theft/"5",
  topZone:North Nazimabad/"8" }` — note `crimeCount` is a STRING (pg COUNT)
- `pg_indexes` snapshot → 17 indexes on audited tables

## Pre-Test Finding That Changed the Plan

`Latest_schema.sql` is stale, but the LIVE DB already had 17 indexes —
`supabase-setup.sql:157-173` creates btree + GIST indexes, and
`migration-media-upload.sql` created `CrimeMedia` indexes including
`(CrimeId, visibility)` — the original plan's `idx_crime_media_visibility`
target. Audit-before-apply prevented creating 2 redundant/duplicate indexes.
Applied set reduced from the plan's 6 to 4 (see implementation log).

## Test Results

### Syntax / Static

```text
node --check on 7 touched files:            PASS
ESLint / TypeScript / unit tests / build:   N/A — no tooling configured in backend
```

### API Parity & Behavior (34 checks scripted against live backend)

```text
Legacy parity (map bare array, ids, shape):            PASS
Legacy parity (/crimes/all envelope, count, keys):     PASS
Auth regression (/crimes/all still police-only):       PASS (403 unauth)
Pagination envelope + metadata math:                   PASS
Page separation + full 3-page union == legacy ids:     PASS
Media cap ≤3 paginated / uncapped legacy:              PASS
Clamping (99999→200) and invalid params (abc, -2):     PASS
Beyond-last-page → empty data + correct meta:          PASS
Filters combine with pagination (type/zone/radius):    PASS
Stats summary shape/value/type parity:                 PASS (crimeCount stays string)

Result: 33/34 PASS on first run; the single FAIL was a TEST-SCRIPT bug
(union check fetched 2 of 3 pages). Re-run with all 3 pages: PASS.
No implementation defects found.
```

### Database Evidence

```text
Index apply (4x CREATE INDEX IF NOT EXISTS + ANALYZE): PASS
pg_indexes after snapshot:                             21 indexes (17 → 4 new, no dupes)
EXPLAIN (ANALYZE, BUFFERS) paginated map query:        Index Scan using idx_crime_approved_date,
                                                       execution 0.252ms server-side
```

### Playwright MCP Browser Regression

Frontend: Vite dev server; police session injected via localStorage
(`authMode=staff`, `staffRole=police`, minted JWT) — mirrors real login storage keys.

```text
Homepage load:                                    PASS
/map (public):                                    PASS — Leaflet renders, markers + clusters
                                                  ("3"/"5" cluster buttons) expandable;
                                                  network request /api/crimes?mode=basic returned
                                                  legacy bare array (12 crimes, full media, public-
                                                  visibility filtering intact) — array consumer
                                                  contract unchanged
/all-records (police):                            PASS — all 12 records in table; client-side
                                                  search (Crime Type = Theft) filters correctly;
                                                  legacy full-dataset behavior intact
/statistics:                                      PASS — Total Zones 4, Total Crimes 6,
                                                  Top Crime Theft, Top Zone North Nazimabad
                                                  (matches API values); trend/bar/pie charts render
User-visible changes:                             NONE (goal was zero, achieved)
```

### Not Executed (with reason)

```text
k6 baseline comparison:   DEFERRED to Phase 15 per user instruction (load testing
                          runs after all phases, not per phase). Phase 0 baseline
                          numbers remain the comparison reference.
Production build:         N/A — backend has no build step (plain Node, nodemon).
```

## Final Testing Status — Phase 1

All executable validation for this phase PASSED. No regressions found in map,
AllRecords, statistics, auth/authorization, or media behavior. No outstanding
defects from testing. (Pre-existing data/code issues are listed in the
implementation log as follow-ups, none introduced by this phase.)

Status: PHASE 1 TESTING COMPLETE (within deferred-k6 scope).
