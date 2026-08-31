# Phase 1: PostgreSQL Optimization & Pagination

> Status: PLANNED (not started — verified 2026-08-30; phase folder contained only this plan,
> no `utils/pagination.js`, no `middleware/queryLogger.js`, no `scripts/add-performance-indexes.sql`)
> Branch: create `phase-1-postgresql-optimization` from `k6-baseline`
> Depends on: Phase 0 baseline (complete — see `Plans/phase-0-k6-baseline/testing-log.md`)

## Objective

Optimize database queries and add opt-in pagination to the two unbounded list endpoints,
reducing DB load before caching layers are introduced (Phase 3). Preserve every existing
API response byte-for-byte when pagination parameters are not supplied.

## ⚠️ Resolved Design Decision: Opt-In Pagination (approved by user, 2026-08-30)

The original plan made pagination always-on (default limit 50, envelope response always).
That would have broken the frontend:

- `db-project-frontend/src/pages/MapViewPage/index.tsx:94-96` consumes `GET /api/crimes`
  as a **bare array** (`setCrimeData(data)` → `CrimeMarkers.tsx` iterates it).
- `db-project-frontend/src/pages/AllRecordsPage/component/AllRecords.tsx:123-133` loads the
  **full dataset** from `/crimes/all` into `backupRecords` for client-side search; a 50-row
  cap would silently limit search scope.

**Decision: pagination is opt-in.** No `page`/`limit` params → legacy behavior unchanged.
Params present → paginated envelope. Frontend is NOT modified in this phase.

```text
GET /api/crimes                      (no page/limit)
→ [ { id, title, ..., media: [...all] } ]              (byte-compatible legacy array)

GET /api/crimes?page=1&limit=50
→ { success: true,
    data: [ ...≤limit rows, media capped at 3 ],
    pagination: { page, limit, total, totalPages, hasNextPage, hasPrevPage } }

GET /api/crimes/all                  (no page/limit)
→ { success: true, data: [ ...full dataset ] }         (unchanged legacy envelope)

GET /api/crimes/all?page=1&limit=50
→ { success: true, data: [...], pagination: {...} }
```

Media cap of 3 applies ONLY in paginated mode (legacy mode keeps full media fetch —
`CrimeMarkers.tsx:43-44` computes `policeOnlyMediaCount` from `mediaCount` minus public
media, and truncation there would skew the displayed counts).

## Verified Current-State Facts (2026-08-30 — do not re-assume)

| Fact | Evidence |
|---|---|
| Phase 1 not started | Phase folder has only `plan.md`; target files absent |
| `getCrimesForMap` has NO `ORDER BY` | `CrimeControllers.js:63-200` — LIMIT/OFFSET would be nondeterministic without adding one |
| `getAllCrimes` has deterministic `ORDER BY` | `CrimeControllers.js:872` — `incidentDate DESC, id DESC` (safe to paginate as-is) |
| `Latest_schema.sql` is STALE | `Crime` table def (line 65-81) lacks `mediaCount`/`thumbnailUrl` (added by `migration-media-upload.sql`); it also contains **zero** `CREATE INDEX` statements |
| `Crime` model declares 5 indexes in Sequelize | `models/Crime.js:63-70` (crimeTypeId, reportedAt, status, [zoneId, reportedAt], GIST location) — but `sync()` is never called (Supabase SQL scripts used instead), so these MAY NOT EXIST in the live DB |
| `CrimeMedia` model ALSO declares never-applied indexes | `models/CrimeMedia.js:109-114` (CrimeId, fileType, visibility, [CrimeId, visibility]) — same `sync()`-never-runs caveat; composite [CrimeId, visibility] exactly matches the map media query pattern |
| New env vars are validation-safe | `config/envValidation.js` only enforces 4 required vars (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET) and never rejects extras — `DB_POOL_MAX`/`DB_POOL_MIN`/`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` need no validator changes |
| `db.sequelize` is accessible as the plan's code assumes | `models/index.js:1` imports from `config/db.js` and controllers already use `db.sequelize.query` |
| Backend has NO ESLint, NO test runner, NO build script, NO TypeScript | `db-project-backend/package.json` — only `start: nodemon server.js` |
| k6 `public-map.js` sends no page/limit params | grep confirmed — legacy shape under opt-in design; **no k6 script changes needed** |
| Pool config | `config/db.js` — hardcoded `max: 5, min: 0` |
| Master-plan progress checkboxes are all `[x]` incorrectly | `SYSTEM-DESIGN-IMPLEMENTATION.md:109-124` — doc bug; fix at phase completion (only Phase 0/1 rows true) |
| Query logger mount point | `server.js` — after `express.json()` (line 37), before route mounting |
| Pre-existing bug (OUT OF SCOPE) | `CrimeControllers.js:1214` reads `mediaStats[0].firstthumbnail` but alias is `firstThumbnail` — log as known issue, do NOT fix in this phase |

## Files to Create

```
db-project-backend/utils/pagination.js                  (new — pagination utility)
db-project-backend/middleware/queryLogger.js            (new — dev slow-request logger)
db-project-backend/scripts/add-performance-indexes.sql  (new — guarded index script)
Plans/phase-1-postgresql-optimization/implementation-log.md
Plans/phase-1-postgresql-optimization/testing-log.md
```

## Files to Modify

```
db-project-backend/controllers/CrimeControllers.js      (getCrimesForMap, getAllCrimes only)
db-project-backend/controllers/statsController.js       (getStatsSummary only)
db-project-backend/config/db.js                         (env-driven pool, explicit default branch)
db-project-backend/server.js                            (mount queryLogger — one line)
db-project-backend/.env-sample                          (document new env vars)
Plans/SYSTEM-DESIGN-IMPLEMENTATION.md                   (progress tracker — at completion only)
```

## Explicitly NOT Changed

- **All frontend files** (per approved decision).
- `getPendingSubmissions` (also unbounded, but out of plan scope — note for a future phase).
- All write paths (`reportCrime`, `approveCrimeReport`, `rejectCrimeReport`, `updateCrime`, `deleteCrime`).
- `crimeRoutes.js` middleware chain and all auth middleware.
- The `firstthumbnail` typo (known-issue log only).
- No Redis/caching/compression — future phases. No speculative `X-Cacheable` headers
  (original plan's Step 4 added them; that is Phase 3 concern — removed).

---

## Implementation Steps

### Step 1 — Pagination utility

**File: `db-project-backend/utils/pagination.js`** (new)

Follow the original plan's utility, with one correction: wire the constants to the env vars
the plan adds (no dead config). Defaults preserve the original plan's values.

```javascript
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = parseInt(process.env.DEFAULT_PAGE_SIZE || "50", 10);
export const MAX_LIMIT = parseInt(process.env.MAX_PAGE_SIZE || "200", 10);

export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

export function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      page, limit, total, totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export function buildPaginatedResponse(data, meta) {
  return { success: true, data, ...meta };
}
```

Edge cases to handle: `page=abc` → page 1; `limit=-5` → 1; `limit=99999` → clamped to
MAX_LIMIT; `page` beyond last page → empty `data` array with correct metadata (not an error).

### Step 2 — Opt-in pagination for `getCrimesForMap`

**File: `db-project-backend/controllers/CrimeControllers.js`** (`getCrimesForMap`, line 63)

Structure:

```javascript
import { parsePaginationParams, buildPaginationMeta, buildPaginatedResponse } from "../utils/pagination.js";

export const getCrimesForMap = async (req, res) => {
  try {
    const { mode, crimeType, zoneId, startDate, endDate, lat, lng, radius,
            page: pageParam, limit: limitParam } = req.query;

    const paginated = pageParam !== undefined || limitParam !== undefined;
    const pagination = paginated ? parsePaginationParams(req.query) : null;
    const userRole = req.user?.role || "citizen";

    // ... existing base SQL + filter building (UNCHANGED) ...

    // NEW (paginated mode only): count query sharing the identical WHERE/JOIN set
    if (paginated) {
      const countResult = await db.sequelize.query(countSql, { ... });
      total = countResult[0].total;
    }

    // NEW: ORDER BY is added ONLY when paginating. Legacy responses must stay
    // byte-compatible; adding ORDER BY without LIMIT is also a (safe, but
    // out-of-minimal-change) behavior delta — keep it scoped to paginated mode.
    if (paginated) {
      sql += ` ORDER BY c."reportedAt" DESC, c.id DESC LIMIT :limit OFFSET :offset`;
      replacements.limit = pagination.limit;
      replacements.offset = pagination.offset;
    } else {
      sql += ";";  // exactly as today
    }

    // ... existing execution + media fetch, with ONE change:
    // media query gains `LIMIT 3` only when paginated (preview cap) ...

    // Response:
    if (paginated) {
      const meta = buildPaginationMeta(pagination.page, pagination.limit, total);
      return res.json(buildPaginatedResponse(formatted, meta));
    }
    return res.json(formatted);   // legacy array — unchanged
  } catch (err) { /* unchanged */ }
};
```

Requirements:
- Count query and data query MUST share identical JOINs and WHERE conditions (including
  the radius `ST_DWithin` clause) — otherwise pagination totals are wrong under filters.
- Deterministic pagination order: `ORDER BY c."reportedAt" DESC, c.id DESC` (the tiebreaker
  matters — `reportedAt` alone can repeat).
- Error responses unchanged (`res.status(500).json([])` in legacy mode; in paginated mode
  return `res.status(500).json({ success: false, message: "Internal server error" })` —
  consistent with envelope mode).

### Step 3 — Opt-in pagination for `getAllCrimes`

**File: `db-project-backend/controllers/CrimeControllers.js`** (`getAllCrimes`, line 833)

Same opt-in pattern. Existing query already has deterministic `ORDER BY c."incidentDate" DESC, c.id DESC`
(no change needed there). Paginated mode adds:
- `SELECT COUNT(*) FROM "Crime" WHERE status = 'approved'` (matches the data query's WHERE).
- `LIMIT :limit OFFSET :offset` appended after the existing ORDER BY.
- Response: legacy mode → `{ success: true, data }` (unchanged); paginated →
  `{ success: true, data, pagination }`.
- Media fetch unchanged (police list shows all media per crime).

### Step 4 — Optimize `getStatsSummary`

**File: `db-project-backend/controllers/statsController.js`** (`getStatsSummary`, line 6)

Phase 0 identified this as the worst endpoint (baseline P50 4.8s → stress P50 29.4s). The
current `findOne` + correlated-subquery-per-row pattern scans O(types × crimes). Replace the
two `findOne` calls with single aggregate queries:

```sql
-- Top crime type (replaces findOne + correlated literal)
SELECT ct.id, ct.name, COUNT(c.id) AS "crimeCount"
FROM "CrimeType" ct
LEFT JOIN "Crime" c ON c."crimeTypeId" = ct.id AND c.status = 'approved'
GROUP BY ct.id, ct.name
ORDER BY "crimeCount" DESC
LIMIT 1;

-- Top zone (same shape)
SELECT z.id, z.name, COUNT(c.id) AS "crimeCount"
FROM "Zone" z
LEFT JOIN "Crime" c ON c."zoneId" = z.id AND c.status = 'approved'
GROUP BY z.id, z.name
ORDER BY "crimeCount" DESC
LIMIT 1;
```

Constraints:
- Response JSON shape MUST stay identical: `{ totalZones, totalCrimes, topCrimeType, topZone }`.
  Verify the current response with curl BEFORE changing, and match `crimeCount`'s JSON type
  (pg returns COUNT as string; confirm what the ORM path returns today and cast to match).
- `Zone.count()` and the 30-day `Crime.count()` remain as-is (already cheap and indexed).
- No caching headers, no materialized views — Redis caching is Phase 3.

### Step 5 — Connection pool configuration

**File: `db-project-backend/config/db.js`**

Rewrite with env-driven pool. Two corrections to the original plan:
1. **Explicit default branch** — original plan applied dev pool only when
   `NODE_ENV === 'development'` and prod pool only when `'production'`; with `NODE_ENV`
   unset (local `npm start` default), NEITHER branch applied and Sequelize silently used
   its own defaults. The default branch must be explicit.
2. **Skip the plan's global `define: { timestamps: false }`** — every model already sets
   `timestamps` explicitly (and `CrimeReportsSubmitter` uses `true`; a global false would be
   redundant at best and misleading at worst). Minimal change: pool only.

```javascript
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  min: parseInt(process.env.DB_POOL_MIN || "0", 10),
  acquire: 30000,
  idle: 10000,
  evict: 5000,
};

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  benchmark: process.env.NODE_ENV === "development",
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  pool: poolConfig,
  retry: { max: 3 },
});
```

Notes:
- Default `max` raised 5 → 10 (Phase 0 evidence: pool max 5 was the global throughput
  ceiling — all endpoints converged to a shared latency plateau). Override via `DB_POOL_MAX`.
- Supabase capacity check: 10 connections × 1 instance is well within limits; the
  `instances × connections` formula is revisited in Phase 11 (do not pre-optimize).
- Keep `retry.max: 3` from original plan; document that retry applies to connection
  acquisition failures.

### Step 6 — Performance indexes (VERIFY-FIRST)

**File: `db-project-backend/scripts/add-performance-indexes.sql`** (new)

⚠️ `Latest_schema.sql` is stale and the DB's actual index state is unknown (model-declared
indexes are only created by `sync()`, which never runs). Therefore:

1. **Before applying**: capture current indexes —
   `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('Crime','CrimeMedia','CrimeType','Zone') ORDER BY tablename, indexname;`
   (run via a short `node` script using `DATABASE_URL` + `sequelize.query`, or Supabase SQL editor — psql is not guaranteed on this machine).
2. Compare against the target set; drop any of the six below that already exist under a
   different name (avoid near-duplicate indexes). Note: the `CrimeMedia` composite index
   target is model-declared (`CrimeMedia.js:113`) and the `Crime` indexes are model-declared
   (`Crime.js:63-70`) — expected to be MISSING in the live DB, but verify, don't assume.
3. Apply the guarded script (all `IF NOT EXISTS`, so re-runnable):

```sql
-- Composite for the map query pattern (status + recency)
CREATE INDEX IF NOT EXISTS idx_crime_status_reported ON "Crime"(status, "reportedAt" DESC);
-- Type filtering with status
CREATE INDEX IF NOT EXISTS idx_crime_type_status ON "Crime"("crimeTypeId", status);
-- Zone filtering with status
CREATE INDEX IF NOT EXISTS idx_crime_zone_status ON "Crime"("zoneId", status);
-- Partial index: approved-only recency (smaller, matches map/stats hot path)
CREATE INDEX IF NOT EXISTS idx_crime_approved_date ON "Crime"("reportedAt" DESC) WHERE status = 'approved';
-- Covering index for stats group-bys
CREATE INDEX IF NOT EXISTS idx_crime_stats_covering ON "Crime"("crimeTypeId", status, "reportedAt");
-- Media visibility lookups (map media fetch)
CREATE INDEX IF NOT EXISTS idx_crime_media_visibility ON "CrimeMedia"("CrimeId", "visibility");

ANALYZE "Crime";
ANALYZE "CrimeMedia";
ANALYZE "CrimeType";
ANALYZE "Zone";
```

4. **After applying**: re-run the `pg_indexes` report; save before/after into the testing log.
   Where practical, `EXPLAIN ANALYZE` the map query (with crimeType/zone/date filters) and
   record plan changes. CLAUDE.md forbids blind index additions — the before/after evidence
   is the deliverable, not the script itself.
5. `EXPLAIN ANALYZE` output must not be committed if it embeds data values — commit only
   the plan shape (node types + index names).

### Step 7 — Dev slow-request logger + mount

**File: `db-project-backend/middleware/queryLogger.js`** (new) — as per original plan
(>100ms dev-only warning on `res.json`). **The original plan omitted this**: it must also be
mounted in `server.js`, immediately after `app.use(express.json())` and before route mounts:

```javascript
import { queryLoggerMiddleware } from "./middleware/queryLogger.js";
// ...
app.use(express.json());
app.use(queryLoggerMiddleware);   // dev-only no-op in other environments
```

Keep the implementation minimal (original plan's version is fine); no timing of the DB
itself — that arrives with Pino/Phase 7.

### Step 8 — Environment variables

**File: `db-project-backend/.env-sample`** — append (placeholders only, no secrets):

```bash
# Database Connection Pool (Phase 1)
DB_POOL_MAX=10
DB_POOL_MIN=0

# Pagination Defaults (Phase 1) — consumed by utils/pagination.js
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=200
```

Do NOT rename or remove any existing variable. `envValidation.js` is not touched
(these are optional vars with safe defaults).

### Step 9 — Route documentation (comment-only)

**File: `db-project-backend/routes/crimeRoutes.js`** — comment-only addition documenting
the new query params (`page`, `limit`) and the opt-in contract. No middleware or route
changes.

### Step 10 — Phase logs + tracker

- Create `implementation-log.md` (current implementation state) and `testing-log.md`
  (testing record) per `Plans/CLAUDE.md` ownership rules.
- At completion, fix the progress tracker in `SYSTEM-DESIGN-IMPLEMENTATION.md`: mark
  Phase 1 checkbox `[x]` only, and leave 2–15 unchecked (they are all currently, and
  incorrectly, checked).

---

## Validation Plan

| Check | Tool | Notes |
|---|---|---|
| Syntax | `node --check` on every touched `.js` file | Executable substitute — backend has no lint/typecheck/test tooling (package.json verified) |
| ESLint / TypeScript / unit tests | **N/A** | Not configured in backend; report as N/A, do not claim PASS |
| Legacy parity | curl | `GET /api/crimes` (no params) and `/crimes/all` (no params) return byte-equivalent structures to pre-change responses (capture before/after) |
| Pagination behavior | curl | `page=1&limit=10` vs `page=2&limit=10` → different rows, correct `total/totalPages/hasNextPage`; `limit=99999` clamps; `page=abc` → defaults; filters + pagination combine correctly (radius, crimeType, zone, dates) |
| Stats shape | curl | `/api/stats/summary` JSON identical pre/post (capture before change) |
| Indexes | `pg_indexes` before/after + `EXPLAIN ANALYZE` where practical | Evidence into testing log |
| Pool | Backend start log + curl under k6 | Verify pool sizes applied via Sequelize `pool` config logging in dev |
| k6 compare | `k6 run tests/k6/runs/baseline.js` | Compare vs Phase 0 (P95 5.13s / P99 7.69s / 25.5 req/s @ 100 VU). Record actuals; the plan's "20% improvement" is an expectation, not a claim. No k6 script edits needed (opt-in design keeps legacy shape for param-less requests) |
| **Playwright MCP** | Browser | **Required** (backend CLAUDE.md §16 — pagination-affecting change): map renders with markers/media popups as today; police AllRecords loads and client-side search works as today; citizen map view unchanged. Expect NO visible differences — any visible difference is a regression |
| Git | `git status` + `git diff` review | Only intended files; no secrets; phase-scoped commit(s) on `phase-1-postgresql-optimization` |

Playwright note: if a browser regression appears → STOP, fix, re-run automated checks,
re-run Playwright (per CLAUDE.md §7/§17). Only the Implementation Agent commits/pushes.

## Acceptance Criteria

- [ ] Pagination utility created; constants wired to env vars (no dead config)
- [ ] `getCrimesForMap` + `getAllCrimes` support opt-in pagination with deterministic ordering
- [ ] Param-less requests return legacy responses (verified by captured before/after comparison)
- [ ] `getStatsSummary` uses aggregate JOIN queries; response shape identical
- [ ] Index script applied; before/after `pg_indexes` evidence recorded; no near-duplicate indexes
- [ ] Pool env-driven with explicit default branch; documented in `.env-sample`
- [ ] Query logger created AND mounted in `server.js` (dev-only)
- [ ] k6 baseline re-run; actuals recorded vs Phase 0 in testing log
- [ ] Playwright map + AllRecords regression: no user-visible change
- [ ] Phase logs created; master tracker corrected (Phase 1 only)
- [ ] `git diff` reviewed; no unrelated files, no secrets

## Rollback Procedure

1. Revert controller/pool/middleware changes (`git revert` the phase commit(s)).
2. Drop the six indexes if they caused issues (`DROP INDEX IF EXISTS idx_...` — they are
   additive and safe to leave in place if harmless).
3. Restart backend; re-run legacy-parity curl checks.

## Risks & Notes

- **Highest risk: silent response-shake regression** — mitigated by the opt-in design and
  mandatory Playwright pass.
- `ORDER BY c."reportedAt" DESC` on the map query in paginated mode requires
  `idx_crime_status_reported` / partial `idx_crime_approved_date` to avoid a sort —
  verify with `EXPLAIN ANALYZE` after index creation.
- Supabase network RTT dominates local-dev latencies (Phase 0 finding); pool/index gains
  may be partially masked — report what is measured, not what is hoped.
- One instance × pool max 10 is safe for Supabase; Phase 11 owns the multi-instance math.
