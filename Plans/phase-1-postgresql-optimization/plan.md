# Phase 1: PostgreSQL Optimization & Pagination

## Objective

Optimize database queries and implement pagination to improve performance and enable scalability. This phase focuses on database-level improvements before adding caching layers.

## What We'll Implement

1. **Pagination** - Add pagination to all list endpoints
2. **Query optimization** - Review and optimize expensive queries
3. **Index verification** - Ensure all critical indexes are in place
4. **Connection pool tuning** - Optimize for the workload

## Current State Analysis

**Files to modify:**
- `db-project-backend/controllers/CrimeControllers.js` - Map and list queries
- `db-project-backend/controllers/statsController.js` - Statistics queries
- `db-project-backend/config/db.js` - Connection pool configuration
- `db-project-backend/models/Crime.js` - Index definitions
- `db-project-backend/routes/crimeRoutes.js` - Route definitions

**Current Issues:**
- `getCrimesForMap()` fetches ALL crimes with media (N+1 problem)
- `getAllCrimes()` returns all records without pagination
- Statistics queries use raw SQL but could be optimized
- Connection pool has max: 5, min: 0 (may need adjustment for scaling)

## Implementation Steps

### Step 1: Add Pagination Utility

**File: `db-project-backend/utils/pagination.js`**

```javascript
/**
 * Pagination utility for consistent pagination across endpoints
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/**
 * Parse and validate pagination parameters
 * @param {Object} query - Express request query object
 * @returns {Object} Parsed pagination parameters
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT)
  );

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build pagination metadata for response
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
export function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Apply pagination to Sequelize query options
 * @param {Object} options - Sequelize query options
 * @param {Object} pagination - Pagination params from parsePaginationParams
 * @returns {Object} Enhanced query options with pagination
 */
export function applyPaginationToQuery(options, pagination) {
  return {
    ...options,
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

/**
 * Build paginated response
 * @param {Array} data - Paginated data
 * @param {Object} meta - Pagination metadata
 * @returns {Object} Formatted response with pagination
 */
export function buildPaginatedResponse(data, meta) {
  return {
    success: true,
    data,
    ...meta,
  };
}
```

### Step 2: Add Pagination to getCrimesForMap

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
// Add import at top
import { parsePaginationParams, buildPaginationMeta, buildPaginatedResponse } from '../utils/pagination.js';

// Modify getCrimesForMap function
export const getCrimesForMap = async (req, res) => {
  try {
    const { mode, crimeType, zoneId, startDate, endDate, lat, lng, radius } = req.query;
    
    // Parse pagination parameters
    const pagination = parsePaginationParams(req.query);

    // Determine user role for visibility filtering
    const userRole = req.user?.role || 'citizen';

    // Count query first
    let countSql = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM "Crime" c
      JOIN "CrimeType" ct ON c."crimeTypeId" = ct.id
      LEFT JOIN "Zone" z ON c."zoneId" = z.id
      WHERE c.status = 'approved'
    `;

    const countConditions = [];
    const countReplacements = {};

    // Apply same filters as data query
    if (crimeType && crimeType !== "All") {
      countConditions.push(`ct.name ILIKE :crimeType`);
      countReplacements.crimeType = crimeType;
    }
    if (zoneId && zoneId !== "All") {
      countConditions.push(`c."zoneId" = :zoneId`);
      countReplacements.zoneId = zoneId;
    }
    if (startDate) {
      countConditions.push(`c."incidentDate" >= :startDate`);
      countReplacements.startDate = new Date(startDate).toISOString();
    }
    if (endDate) {
      countConditions.push(`c."incidentDate" <= :endDate`);
      countReplacements.endDate = new Date(endDate).toISOString();
    }
    if (mode === "radius" && lat && lng && radius) {
      countConditions.push(`
        ST_DWithin(
          c.location::geography,
          ST_SetSRID(ST_Point(:lng, :lat), 4326),
          :radius
        )
      `);
      countReplacements.lat = parseFloat(lat);
      countReplacements.lng = parseFloat(lng);
      countReplacements.radius = parseFloat(radius);
    }

    if (countConditions.length > 0) {
      countSql += " AND " + countConditions.join(" AND ");
    }

    const countResult = await db.sequelize.query(countSql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements: countReplacements,
    });
    const total = countResult[0].total;

    // Data query with pagination
    let sql = `
      SELECT
        c.id,
        c.title,
        c.description,
        c.address,
        c."zoneId",
        z.name AS "zoneName",
        c."crimeTypeId",
        ct.name AS "crimeTypeName",
        c.status,
        c."incidentDate",
        c."thumbnailUrl",
        c."mediaCount",
        ST_AsGeoJSON(c.location)::json AS geom
      FROM "Crime" c
      JOIN "CrimeType" ct ON c."crimeTypeId" = ct.id
      LEFT JOIN "Zone" z ON c."zoneId" = z.id
      WHERE c.status = 'approved'
    `;

    const conditions = [];
    const replacements = {};

    // Apply filters (same as count)
    if (crimeType && crimeType !== "All") {
      conditions.push(`ct.name ILIKE :crimeType`);
      replacements.crimeType = crimeType;
    }
    if (zoneId && zoneId !== "All") {
      conditions.push(`c."zoneId" = :zoneId`);
      replacements.zoneId = zoneId;
    }
    if (startDate) {
      conditions.push(`c."incidentDate" >= :startDate`);
      replacements.startDate = new Date(startDate).toISOString();
    }
    if (endDate) {
      conditions.push(`c."incidentDate" <= :endDate`);
      replacements.endDate = new Date(endDate).toISOString();
    }
    if (mode === "radius" && lat && lng && radius) {
      conditions.push(`
        ST_DWithin(
          c.location::geography,
          ST_SetSRID(ST_Point(:lng, :lat), 4326),
          :radius
        )
      `);
      replacements.lat = parseFloat(lat);
      replacements.lng = parseFloat(lng);
      replacements.radius = parseFloat(radius);
    }

    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    // Add pagination
    sql += ` ORDER BY c."reportedAt" DESC LIMIT :limit OFFSET :offset;`;
    replacements.limit = pagination.limit;
    replacements.offset = pagination.offset;

    const crimes = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements,
    });

    // Fetch media (optimize: only for current page)
    const crimesWithMedia = await Promise.all(
      crimes.map(async (c) => {
        if (!c.geom) return null;

        const loc = typeof c.geom === "string" ? JSON.parse(c.geom) : c.geom;

        let media = [];
        if (c.mediaCount > 0) {
          const mediaQuery = userRole === 'citizen'
            ? `SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                      "visibility", "evidenceMarked", "originalName", "fileSize"
               FROM "CrimeMedia"
               WHERE "CrimeId" = :crimeId AND "visibility" = 'public'
               ORDER BY id ASC
               LIMIT 3;`  // Only fetch first 3 for map preview
            : `SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                      "visibility", "evidenceMarked", "originalName", "fileSize"
               FROM "CrimeMedia"
               WHERE "CrimeId" = :crimeId
               ORDER BY id ASC
               LIMIT 3;`;

          const mediaRows = await db.sequelize.query(mediaQuery, {
            replacements: { crimeId: c.id },
            type: db.sequelize.QueryTypes.SELECT,
          });
          media = mediaRows;
        }

        return {
          id: c.id,
          crimeTypeId: c.crimeTypeId,
          crimeTypeName: c.crimeTypeName,
          incidentDate: c.incidentDate,
          status: c.status,
          latitude: loc.coordinates[1],
          longitude: loc.coordinates[0],
          title: c.title,
          description: c.description,
          address: c.address,
          zoneId: c.zoneId,
          zoneName: c.zoneName,
          thumbnailUrl: c.thumbnailUrl,
          mediaCount: c.mediaCount || 0,
          media: media,
        };
      })
    );

    const formatted = crimesWithMedia.filter(Boolean);
    const meta = buildPaginationMeta(pagination.page, pagination.limit, total);

    return res.json(buildPaginatedResponse(formatted, meta));

  } catch (err) {
    console.error("Map Crime Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
```

### Step 3: Add Pagination to getAllCrimes

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
export const getAllCrimes = async (req, res) => {
  try {
    const pagination = parsePaginationParams(req.query);
    
    // Count query
    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM "Crime" WHERE status = 'approved';`,
      { type: QueryTypes.SELECT }
    );
    const total = countResult[0].total;

    // Data query with pagination
    const crimes = await sequelize.query(
      `
      SELECT c.id AS id,
             c.title AS title,
             c.description AS description,
             c.address AS address,
             c."thumbnailUrl" AS "thumbnailUrl",
             c."mediaCount" AS "mediaCount",
             z.name AS "zoneName",
             pb.id AS "registeredBranchId",
             crs."submitterCnic" AS "submitterCnic",
             ct.name AS "crimeTypeName",
             c."incidentDate" AS "incidentDate",
             c.status AS status,
             ST_AsGeoJSON(c.location)::json AS location,
             CASE WHEN c.location IS NOT NULL THEN ST_Y(c.location) END AS latitude,
             CASE WHEN c.location IS NOT NULL THEN ST_X(c.location) END AS longitude
      FROM "Crime" c
      LEFT JOIN "Zone" z ON z.id = c."zoneId"
      LEFT JOIN LATERAL (
        SELECT pb_inner.id
        FROM "PoliceBranch" pb_inner
        WHERE pb_inner."zoneId" = c."zoneId"
        ORDER BY pb_inner.id ASC
        LIMIT 1
      ) pb ON true
      LEFT JOIN "CrimeType" ct ON ct.id = c."crimeTypeId"
      LEFT JOIN LATERAL (
        SELECT cs."submitterId"
        FROM "CrimeSubmission" cs
        WHERE cs."CrimeId" = c.id
        ORDER BY cs."submittedAt" DESC
        LIMIT 1
      ) cs_latest ON true
      LEFT JOIN "CrimeReportsSubmitter" crs ON crs.id = cs_latest."submitterId"
      WHERE c.status = 'approved'
      ORDER BY c."incidentDate" DESC, c.id DESC
      LIMIT :limit OFFSET :offset;
      `,
      { 
        type: QueryTypes.SELECT,
        replacements: { 
          limit: pagination.limit,
          offset: pagination.offset 
        }
      }
    );

    // Fetch media only for current page
    const crimesWithMedia = await Promise.all(
      crimes.map(async (crime) => {
        const mediaRows = await sequelize.query(
          `
          SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                 "visibility", "evidenceMarked", "originalName", "fileSize",
                 "uploadedBy", "uploadedAt"
          FROM "CrimeMedia"
          WHERE "CrimeId" = :crimeId
          ORDER BY id ASC;
          `,
          {
            replacements: { crimeId: crime.id },
            type: QueryTypes.SELECT,
          }
        );
        return {
          ...crime,
          media: mediaRows,
        };
      })
    );

    const meta = buildPaginationMeta(pagination.page, pagination.limit, total);

    return res.status(200).json(buildPaginatedResponse(crimesWithMedia, meta));

  } catch (error) {
    console.error("❌ Error fetching crimes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching crime records"
    });
  }
};
```

### Step 4: Optimize Statistics Queries

**File: `db-project-backend/controllers/statsController.js`**

```javascript
// Add materialized view hint or optimize queries
// Current queries are already using raw SQL which is good
// Add query result caching hint for future Redis implementation

export const getStatsSummary = async (req, res) => {
  try {
    const { Crime, CrimeType, Zone } = db;

    // Add cache control hint for future Redis
    res.setHeader('X-Cacheable', 'true');
    res.setHeader('X-Cache-TTL', '300'); // 5 minutes

    // Total zones
    const totalZones = await Zone.count();

    // Total approved crimes in last 30 days (already indexed)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalCrimes = await Crime.count({
      where: {
        status: "approved",
        reportedAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // Top Crime Type (use indexed column)
    const topCrimeType = await CrimeType.findOne({
      attributes: [
        "id",
        "name",
        [
          literal(`
            (SELECT COUNT(*) 
             FROM "Crime" AS c 
             WHERE c."crimeTypeId" = "CrimeType"."id"
             AND c."status" = 'approved')
          `),
          "crimeCount"
        ]
      ],
      order: [[literal("crimeCount"), "DESC"]],
      limit: 1,
      raw: true // Add raw: true for better performance
    });

    // Top Zone (use indexed column)
    const topZone = await Zone.findOne({
      attributes: [
        "id",
        "name",
        [
          literal(`
            (SELECT COUNT(*) 
             FROM "Crime" AS c 
             WHERE c."zoneId" = "Zone"."id"
             AND c."status" = 'approved')
          `),
          "crimeCount"
        ]
      ],
      order: [[literal("crimeCount"), "DESC"]],
      limit: 1,
      raw: true
    });

    res.json({
      totalZones,
      totalCrimes,
      topCrimeType,
      topZone
    });

  } catch (err) {
    console.error("Stats summary error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
};
```

### Step 5: Optimize Connection Pool

**File: `db-project-backend/config/db.js`**

```javascript
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Calculate optimal pool size based on expected load
// Formula: (number of CPUs * 2) + effective_spindle_factor
// For now, use conservative values that can be adjusted per environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const poolConfig = {
  // For development: smaller pool
  ...(isDevelopment ? {
    max: 5,
    min: 0,
  } : {}),
  
  // For production: larger pool
  ...(isProduction ? {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
  } : {}),
  
  // Common settings
  acquire: 30000,
  idle: 10000,
  evict: 5000, // Run eviction every 5 seconds
};

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: isDevelopment ? console.log : false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  pool: poolConfig,
  
  // Performance optimizations
  define: {
    timestamps: false, // Disable timestamps for better performance
    underscored: false, // Keep camelCase
  },
  
  // Query optimization
  benchmark: isDevelopment, // Log query execution time in dev
  retry: {
    max: 3, // Retry failed queries up to 3 times
  },
});

export default sequelize;
```

### Step 6: Verify and Add Missing Indexes

**File: `db-project-backend/scripts/add-performance-indexes.sql`**

```sql
-- Add additional performance indexes if missing

-- Check if indexes exist, create if not
DO $$
BEGIN
    -- Composite index for common map query pattern
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_status_reported'
    ) THEN
        CREATE INDEX idx_crime_status_reported 
        ON "Crime"(status, "reportedAt" DESC);
    END IF;

    -- Index for crime type filtering with status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_type_status'
    ) THEN
        CREATE INDEX idx_crime_type_status 
        ON "Crime"("crimeTypeId", status);
    END IF;

    -- Index for zone-based queries with status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_zone_status'
    ) THEN
        CREATE INDEX idx_crime_zone_status 
        ON "Crime"("zoneId", status);
    END IF;

    -- Partial index for approved crimes only (smaller index, faster queries)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_approved_date'
    ) THEN
        CREATE INDEX idx_crime_approved_date 
        ON "Crime"("reportedAt" DESC) 
        WHERE status = 'approved';
    END IF;

    -- Covering index for common statistics queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_stats_covering'
    ) THEN
        CREATE INDEX idx_crime_stats_covering 
        ON "Crime"("crimeTypeId", status, "reportedAt");
    END IF;

    -- Index for media visibility queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_crime_media_visibility'
    ) THEN
        CREATE INDEX idx_crime_media_visibility 
        ON "CrimeMedia"("CrimeId", "visibility");
    END IF;
END $$;

-- Analyze tables to update statistics
ANALYZE "Crime";
ANALYZE "CrimeMedia";
ANALYZE "CrimeType";
ANALYZE "Zone";

-- Report index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
    AND tablename IN ('Crime', 'CrimeMedia', 'CrimeType', 'Zone')
ORDER BY tablename, indexname;
```

### Step 7: Add Query Logging for Development

**File: `db-project-backend/middleware/queryLogger.js`**

```javascript
/**
 * Query logging middleware for development
 * Logs slow queries (>100ms) for optimization
 */

export function queryLoggerMiddleware(req, res, next) {
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  const startTime = Date.now();
  
  // Log response with query time
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    if (duration > 100) {
      console.log(`⚠️  Slow query detected:`, {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        query: req.query,
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

export default queryLoggerMiddleware;
```

### Step 8: Add Environment Variables

**File: `db-project-backend/.env-sample`**

```bash
# Add to existing .env-sample

# Database Connection Pool
DB_POOL_MAX=20
DB_POOL_MIN=5

# Pagination Defaults
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=200
```

### Step 9: Update Routes

**File: `db-project-backend/routes/crimeRoutes.js`**

```javascript
// Add query parameter documentation
router.get(
  "/",
  optionalAuth,
  getCrimesForMap
);
// Query params: page, limit, crimeType, zoneId, startDate, endDate, lat, lng, radius, mode

router.get("/all", policeOnly, getAllCrimes);
// Query params: page, limit
```

## Verification Steps

1. **Test Pagination**: 
```bash
# Test page 1
curl "http://localhost:5001/api/crimes?page=1&limit=10"

# Test page 2
curl "http://localhost:5001/api/crimes?page=2&limit=10"

# Test with filters
curl "http://localhost:5001/api/crimes?page=1&limit=5&crimeType=Theft"
```

2. **Verify Indexes**: Run the SQL script and check index creation

3. **Test Connection Pool**: Monitor database connections during load test

4. **Performance Test**: Compare response times before/after

## Expected Results

- **Pagination**: All list endpoints return paginated responses
- **Performance**: Reduced memory usage and faster response times
- **Indexes**: All critical queries use indexes
- **Connection Pool**: Optimal for the workload

## Success Criteria

- [ ] Pagination utility created and integrated
- [ ] getCrimesForMap() supports pagination
- [ ] getAllCrimes() supports pagination  
- [ ] All performance indexes created
- [ ] Connection pool optimized for environment
- [ ] Response times improved by 20%+ (measured in Phase 0 vs Phase 1)

## Files Modified

```
db-project-backend/
├── config/db.js (connection pool optimization)
├── controllers/
│   ├── CrimeControllers.js (pagination)
│   └── statsController.js (optimization)
├── middleware/
│   └── queryLogger.js (new)
├── utils/
│   └── pagination.js (new)
├── routes/
│   └── crimeRoutes.js (documentation)
└── scripts/
    └── add-performance-indexes.sql (new)
```

## Frontend Integration

The frontend will need to be updated to support pagination. This will be documented in the frontend update plan, but the backend now returns:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1000,
    "totalPages": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Dependencies

- Phase 0 baseline metrics (for comparison)
- Database access for index creation
- Backend restart for connection pool changes

## Rollback Procedure

If issues arise:
1. Revert pagination changes to use LIMIT/OFFSET manually
2. Drop new indexes if they cause issues
3. Restore original connection pool settings
4. Restart backend

## Estimated Completion Time

- Pagination utility: 1 hour
- Controller updates: 2-3 hours
- Index optimization: 1 hour
- Connection pool tuning: 30 minutes
- Testing and verification: 1-2 hours
- **Total: 5-7 hours**
