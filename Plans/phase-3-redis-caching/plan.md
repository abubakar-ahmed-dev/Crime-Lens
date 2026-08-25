# Phase 3: Redis Caching

## Objective

Implement Redis-based caching to reduce database load and improve response times for frequently accessed, read-heavy data. This phase establishes Redis infrastructure that will be used for caching (Phase 3) and rate limiting (Phase 4).

## What We'll Implement

1. **Redis connection and client setup**
2. **Cache-aside pattern for statistics endpoints**
3. **TTL management and cache invalidation**
4. **Cache hit/miss metrics**
5. **Reference data caching** (crime types, zones)

## Redis Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Application Layer                      │
├─────────────────────────────────────────────────────────────┤
│  Cache Layer (Redis)                     │  Database (PostgreSQL) │
│  ├── Statistics summary (5min TTL)       │  └── Source of truth    │
│  ├── Crime type distribution (5min TTL)  │                        │
│  ├── Zone crime counts (5min TTL)        │                        │
│  ├── Crime trend data (10min TTL)         │                        │
│  ├── Crime types (1hour TTL)              │                        │
│  └── Zones (1hour TTL)                    │                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Install Redis Dependencies

```bash
npm install redis
```

### Step 2: Create Redis Configuration

**File: `db-project-backend/config/redis.js`**

```javascript
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis client configuration
 * Supports both local and Redis Cloud connections
 */
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const createRedisClient = () => {
  const client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection failed');
        }
        return retries * 100; // Reconnect with increasing delay
      },
    },
  });

  // Event handlers
  client.on('connect', () => {
    console.log('✅ Redis client connected');
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('reconnecting', () => {
    console.log('⚠️  Redis client reconnecting...');
  });

  return client;
};

// Create and export singleton client
export const redisClient = createRedisClient();

/**
 * Connect to Redis (call during server startup)
 */
export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connection established');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    // Don't fail server startup if Redis is unavailable
    // Cache operations will gracefully fallback to DB
    return false;
  }
};

/**
 * Disconnect from Redis (call during graceful shutdown)
 */
export const disconnectRedis = async () => {
  try {
    await redisClient.quit();
    console.log('✅ Redis connection closed');
  } catch (error) {
    console.error('❌ Redis disconnection error:', error);
  }
};

/**
 * Cache key prefixing
 */
export const CacheKeys = {
  STATS_SUMMARY: 'crimelens:stats:summary',
  STATS_BY_TYPE: 'crimelens:stats:by-type',
  STATS_BY_ZONE: 'crimelens:stats:by-zone',
  STATS_TREND: 'crimelens:stats:trend',
  CRIME_TYPES: 'crimelens:reference:crime-types',
  ZONES: 'crimelens:reference:zones',
  BRANCHES: 'crimelens:reference:branches',
  
  // Dynamic key generators
  crimeById: (id) => `crimelens:crime:${id}`,
  crimesByPage: (page, limit) => `crimelens:crimes:page:${page}:limit:${limit}`,
};

/**
 * TTL configurations (in seconds)
 */
export const CacheTTL = {
  SHORT: 300,      // 5 minutes - volatile data
  MEDIUM: 600,     // 10 minutes - semi-volatile data
  LONG: 3600,      // 1 hour - reference data
  VERY_LONG: 86400, // 24 hours - rarely changing data
};

export default {
  redisClient,
  connectRedis,
  disconnectRedis,
  CacheKeys,
  CacheTTL,
};
```

### Step 3: Create Cache Service

**File: `db-project-backend/services/cacheService.js`**

```javascript
import { redisClient, CacheTTL } from '../config/redis.js';

/**
 * Cache service for cache-aside pattern
 * Handles get/set/delete operations with error resilience
 */

class CacheService {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached value or null
   */
  async get(key) {
    try {
      if (!redisClient.isOpen) {
        return null;
      }

      const value = await redisClient.get(key);
      if (!value) return null;

      return JSON.parse(value);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {Object} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = CacheTTL.MEDIUM) {
    try {
      if (!redisClient.isOpen) {
        return false;
      }

      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  async delete(key) {
    try {
      if (!redisClient.isOpen) {
        return false;
      }

      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   * @param {string} pattern - Key pattern (e.g., 'crimelens:stats:*')
   */
  async deletePattern(pattern) {
    try {
      if (!redisClient.isOpen) {
        return false;
      }

      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache pattern delete error for ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async flushAll() {
    try {
      if (!redisClient.isOpen) {
        return false;
      }

      await redisClient.flushAll();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error.message);
      return false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected() {
    return redisClient.isOpen;
  }

  /**
   * Get cache metrics
   */
  async getMetrics() {
    try {
      if (!redisClient.isOpen) {
        return { connected: false };
      }

      const info = await redisClient.info('stats');
      const stats = {};
      
      // Parse Redis INFO output
      info.split('\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        connected: true,
        hits: stats.keyspace_hits || 0,
        misses: stats.keyspace_misses || 0,
        hitRate: stats.keyspace_hits && stats.keyspace_misses 
          ? (stats.keyspace_hits / (stats.keyspace_hits + stats.keyspace_misses) * 100).toFixed(2)
          : 0,
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

export default new CacheService();
```

### Step 4: Create Cache Decorator

**File: `db-project-backend/middleware/cacheDecorator.js`**

```javascript
import cacheService from '../services/cacheService.js';

/**
 * Cache decorator for controller functions
 * Implements cache-aside pattern automatically
 */

/**
 * Decorator to cache function results
 * @param {Object} options - Cache options
 * @param {string} options.keyGenerator - Function to generate cache key from request
 * @param {number} options.ttl - Cache TTL in seconds
 * @param {Function} options.condition - Optional condition function to determine if caching should be used
 */
export const withCache = (options = {}) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(req, res, next) {
      const {
        keyGenerator = (req) => req.originalUrl,
        ttl = 300, // 5 minutes default
        condition = () => true,
      } = options;

      try {
        // Check if caching should be used
        if (!cacheService.isConnected() || !condition(req)) {
          return originalMethod.call(this, req, res, next);
        }

        // Generate cache key
        const cacheKey = keyGenerator(req);
        
        // Try to get from cache
        const cachedValue = await cacheService.get(cacheKey);
        if (cachedValue !== null) {
          // Add cache header
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-Key', cacheKey);
          return res.json(cachedValue);
        }

        // Cache miss - modify res.json to intercept response
        const originalJson = res.json;
        res.json = function(data) {
          // Store in cache asynchronously
          cacheService.set(cacheKey, data, ttl).catch(err => {
            console.error('Cache set error:', err);
          });

          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Key', cacheKey);
          return originalJson.call(this, data);
        };

        return originalMethod.call(this, req, res, next);

      } catch (error) {
        // On cache error, proceed with original method
        console.error('Cache decorator error:', error);
        return originalMethod.call(this, req, res, next);
      }
    };

    return descriptor;
  };
};

/**
 * Invalidate cache decorator
 * Invalidates cache keys after successful write operation
 */
export const withCacheInvalidation = (patterns = []) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function(req, res, next) {
      const result = await originalMethod.call(this, req, res, next);

      // Invalidate cache patterns on successful write
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => {
          cacheService.deletePattern(pattern).catch(err => {
            console.error(`Cache invalidation error for ${pattern}:`, err);
          });
        });
      }

      return result;
    };

    return descriptor;
  };
};

export default { withCache, withCacheInvalidation };
```

### Step 5: Update Statistics Controller with Caching

**File: `db-project-backend/controllers/statsController.js`**

```javascript
// Add imports
import { CacheKeys, CacheTTL } from '../config/redis.js';
import cacheService from '../services/cacheService.js';
import { withCache, withCacheInvalidation } from '../middleware/cacheDecorator.js';

// Add @withCache decorators to each endpoint

// Apply cache decorator to getStatsSummary
export const getStatsSummary = withCache({
  keyGenerator: () => CacheKeys.STATS_SUMMARY,
  ttl: CacheTTL.SHORT, // 5 minutes
  condition: (req) => req.method === 'GET', // Only cache GET requests
})(async function(req, res) {
  try {
    const { Crime, CrimeType, Zone } = db;

    // ... existing implementation
    
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
});

// Apply cache decorator to getCrimesByType
export const getCrimesByType = withCache({
  keyGenerator: (req) => {
    const { start, end } = req.query;
    return `${CacheKeys.STATS_BY_TYPE}:${start || 'all'}:${end || 'all'}`;
  },
  ttl: CacheTTL.SHORT,
})(async function(req, res) {
  try {
    const { start, end } = req.query;
    
    // ... existing implementation
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Pie chart failed" });
  }
});

// Apply cache decorator to getCrimesByZone
export const getCrimesByZone = withCache({
  keyGenerator: (req) => {
    const { start, end } = req.query;
    return `${CacheKeys.STATS_BY_ZONE}:${start || 'all'}:${end || 'all'}`;
  },
  ttl: CacheTTL.SHORT,
})(async function(req, res) {
  try {
    const { start, end } = req.query;
    
    // ... existing implementation
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bar chart failed" });
  }
});

// Apply cache decorator to getCrimeTrend
export const getCrimeTrend = withCache({
  keyGenerator: (req) => {
    const { crimeTypeId, start, end } = req.query;
    return `${CacheKeys.STATS_TREND}:${crimeTypeId || 'all'}:${start || 'all'}:${end || 'all'}`;
  },
  ttl: CacheTTL.MEDIUM, // 10 minutes for trend data
})(async function(req, res) {
  try {
    const { crimeTypeId, start, end } = req.query;
    
    // ... existing implementation
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Line chart failed" });
  }
});
```

### Step 6: Add Cache Invalidation to Write Operations

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
import { withCacheInvalidation } from '../middleware/cacheDecorator.js';

// Add cache invalidation to write operations
export const approveCrimeReport = withCacheInvalidation([
  'crimelens:stats:*',     // Invalidate all statistics
  'crimelens:crimes:*',    // Invalidate crime caches
])(async function(req, res) {
  // ... existing implementation
});

export const rejectCrimeReport = withCacheInvalidation([
  'crimelens:stats:*',
  'crimelens:crimes:*',
])(async function(req, res) {
  // ... existing implementation
});

export const reportCrime = withCacheInvalidation([
  'crimelens:stats:*',
])(async function(req, res) {
  // ... existing implementation
});

export const updateCrime = withCacheInvalidation([
  'crimelens:stats:*',
  'crimelens:crimes:*',
])(async function(req, res) {
  // ... existing implementation
});

export const deleteCrime = withCacheInvalidation([
  'crimelens:stats:*',
  'crimelens:crimes:*',
])(async function(req, res) {
  // ... existing implementation
});
```

### Step 7: Add Reference Data Caching

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
import cacheService from '../services/cacheService.js';
import { CacheKeys, CacheTTL } from '../config/redis.js';

// Add caching to getAllCrimeTypes
export const getAllCrimeTypes = async (req, res) => {
  try {
    const cacheKey = CacheKeys.CRIME_TYPES;
    
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Cache miss - query database
    const crimeTypes = await sequelize.query(
      `
      SELECT id, name
      FROM "CrimeType"
      ORDER BY name ASC;
      `,
      { type: QueryTypes.SELECT }
    );

    // Cache result
    await cacheService.set(cacheKey, crimeTypes, CacheTTL.LONG);
    res.setHeader('X-Cache', 'MISS');
    res.json(crimeTypes);
  } catch (err) {
    console.error("Error fetching crime types:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
```

### Step 8: Update Health Check for Redis

**File: `db-project-backend/controllers/healthController.js`**

```javascript
import { redisClient } from '../config/redis.js';

export const readinessCheck = async (req, res) => {
  const checks = {
    database: { status: 'unknown', message: '', responseTime: null },
    redis: { status: 'unknown', message: '', responseTime: null },
  };

  let overallStatus = 'ready';

  // Check PostgreSQL
  const dbStartTime = Date.now();
  try {
    await db.sequelize.authenticate();
    checks.database = {
      status: 'up',
      message: 'Database connection successful',
      responseTime: Date.now() - dbStartTime,
    };
  } catch (error) {
    checks.database = {
      status: 'down',
      message: error.message,
      responseTime: Date.now() - dbStartTime,
    };
    overallStatus = 'not_ready';
  }

  // Check Redis
  const redisStartTime = Date.now();
  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      checks.redis = {
        status: 'up',
        message: 'Redis connection successful',
        responseTime: Date.now() - redisStartTime,
      };
    } else {
      checks.redis = {
        status: 'down',
        message: 'Redis client not connected',
        responseTime: Date.now() - redisStartTime,
      };
      overallStatus = 'not_ready';
    }
  } catch (error) {
    checks.redis = {
      status: 'down',
      message: error.message,
      responseTime: Date.now() - redisStartTime,
    };
    overallStatus = 'not_ready';
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = overallStatus === 'ready' ? 200 : 503;
  res.status(statusCode).json(response);
};
```

### Step 9: Update Server Startup

**File: `db-project-backend/server.js`**

```javascript
import { connectRedis, disconnectRedis } from './config/redis.js';

const startServer = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log("✅ Database connection established with Supabase");

    // Connect to Redis (don't fail if unavailable)
    await connectRedis();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Unable to start server:", error.message);
    process.exit(1);
  }
};

// Update graceful shutdown to include Redis
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    await sequelize.close();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }

  try {
    await disconnectRedis();
    console.log('Redis connection closed');
  } catch (error) {
    console.error('Error closing Redis:', error);
  }

  console.log('Graceful shutdown completed');
  process.exit(0);
};
```

### Step 10: Add Environment Variables

**File: `db-project-backend/.env-sample`**

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
# For Redis Cloud:
# REDIS_URL=rediss://<username>:<password>@<host>:<port>
```

## Testing

### Cache Functionality

```bash
# Test caching - first request (MISS)
curl -I http://localhost:5001/api/stats/summary

# Test caching - subsequent requests (HIT)
curl -I http://localhost:5001/api/stats/summary

# Test cache invalidation after write
curl -X POST http://localhost:5001/api/crimes/report \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Test cache miss after invalidation
curl -I http://localhost:5001/api/stats/summary
```

### Cache Metrics

```bash
# Check Redis stats
redis-cli
> INFO stats
> KEYS crimelens:*
```

## Expected Cache Hit Rates

- **Statistics endpoints**: 80-90% hit rate (infrequently changing data)
- **Reference data**: 95%+ hit rate (rarely changing)
- **Overall system**: 70-80% hit rate

## Success Criteria

- [ ] Redis client connects successfully
- [ ] Statistics endpoints are cached with 5-minute TTL
- [ ] Reference data cached with 1-hour TTL
- [ ] Cache invalidation works after write operations
- [ ] X-Cache headers show HIT/MISS correctly
- [ ] Health check includes Redis status
- [ ] System functions when Redis is down (graceful degradation)
- [ ] Cache hit rate >70% measured

## Files Created/Modified

```
db-project-backend/
├── config/
│   └── redis.js (new)
├── services/
│   └── cacheService.js (new)
├── middleware/
│   └── cacheDecorator.js (new)
├── controllers/
│   ├── statsController.js (modified - add caching)
│   ├── CrimeControllers.js (modified - add cache invalidation)
│   └── healthController.js (modified - add Redis check)
└── server.js (modified - Redis startup/shutdown)
```

## Performance Impact

Expected improvements:
- **Statistics endpoints**: 80-90% reduction in database queries
- **Reference data endpoints**: 95%+ reduction in database queries
- **Overall API response time**: 40-60% faster for cached endpoints

## Dependencies

- Redis server (local or Redis Cloud)
- Phase 2 health checks (for monitoring Redis)
- Phase 1 PostgreSQL optimization (optimal DB queries before caching)

## Rollback Procedure

If Redis causes issues:
1. Set `REDIS_URL` to invalid value to disable
2. System will gracefully fallback to DB queries
3. Remove cache decorators if needed
4. Restart backend

## Estimated Completion Time

- Redis setup and configuration: 1 hour
- Cache service implementation: 2 hours
- Statistics endpoint caching: 1 hour
- Cache invalidation: 1 hour
- Testing and optimization: 1 hour
- **Total: 6 hours**
