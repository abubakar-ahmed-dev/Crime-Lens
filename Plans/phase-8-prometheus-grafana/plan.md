# Phase 8: Prometheus + Grafana Monitoring

## Objective

Implement comprehensive application monitoring with Prometheus metrics collection and Grafana visualization for real-time insights into system performance and health.

## What We'll Implement

1. **Prometheus client** for metrics collection
2. **Custom metrics** for business operations
3. **HTTP middleware metrics** (request duration, count, error rate)
4. **Database metrics** (connection pool, query time)
5. **Redis metrics** (cache hit rate, operations)
6. **Grafana dashboards** for visualization

## Implementation Steps

### Step 1: Install Monitoring Dependencies

```bash
npm install prom-client
```

### Step 2: Create Prometheus Configuration

**File: `db-project-backend/config/prometheus.js`**

```javascript
import promClient from 'prom-client';
import { logger } from './logger.js';

/**
 * Prometheus metrics configuration
 */

// Create a Registry which registers the default metrics
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
promClient.collectDefaultMetrics({ register });

// Enable GC metrics
if (process.env.ENABLE_GC_METRICS === 'true') {
  promClient.collectDefaultMetrics({
    register,
    prefix: 'node_',
  });
}

/**
 * Custom metrics for CrimeLens
 */

// HTTP request metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'crimelens_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestCount = new promClient.Counter({
  name: 'crimelens_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpErrors = new promClient.Counter({
  name: 'crimelens_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Database metrics
export const dbQueryDuration = new promClient.Histogram({
  name: 'crimelens_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

export const dbConnections = new promClient.Gauge({
  name: 'crimelens_db_connections',
  help: 'Number of database connections',
  labelNames: ['state'], // active, idle, total
  registers: [register],
});

// Redis metrics
export const redisOperations = new promClient.Counter({
  name: 'crimelens_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const cacheHitRate = new promClient.Gauge({
  name: 'crimelens_cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
  registers: [register],
});

// Business metrics
export const crimesReported = new promClient.Counter({
  name: 'crimelens_crimes_reported_total',
  help: 'Total number of crimes reported',
  labelNames: ['status', 'zone_id'],
  registers: [register],
});

export const crimesVerified = new promClient.Counter({
  name: 'crimelens_crimes_verified_total',
  help: 'Total number of crimes verified',
  labelNames: ['decision'], // approved, rejected
  registers: [register],
});

export const activeUsers = new promClient.Gauge({
  name: 'crimelens_active_users',
  help: 'Number of active users',
  labelNames: ['role'],
  registers: [register],
});

// System metrics
export const systemHealth = new promClient.Gauge({
  name: 'crimelens_system_health',
  help: 'System health status (1=healthy, 0=unhealthy)',
  labelNames: ['component'], // database, redis, api
  registers: [register],
});

/**
 * Metrics middleware factory
 */
export const metricsMiddleware = (options = {}) => {
  const { excludePaths = ['/health', '/ready', '/metrics'] } = options;

  return (req, res, next) => {
    const start = Date.now();
    
    // Track active users
    if (req.user) {
      activeUsers.labels({ role: req.user.role }).inc();
    }

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;

      httpRequestDuration
        .labels({ method: req.method, route, status_code: res.statusCode })
        .observe(duration);

      httpRequestCount
        .labels({ method: req.method, route, status_code: res.statusCode })
        .inc();

      if (res.statusCode >= 400) {
        httpErrors
          .labels({ method: req.method, route, status_code: res.statusCode })
          .inc();
      }
    });

    next();
  };
};

/**
 * Update health metrics
 */
export const updateHealthMetrics = async (db, redisClient) => {
  // Database health
  try {
    await db.sequelize.authenticate();
    systemHealth.labels({ component: 'database' }).set(1);
  } catch {
    systemHealth.labels({ component: 'database' }).set(0);
  }

  // Redis health
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      systemHealth.labels({ component: 'redis' }).set(1);
    } catch {
      systemHealth.labels({ component: 'redis' }).set(0);
    }
  } else {
    systemHealth.labels({ component: 'redis' }).set(0);
  }

  // API health
  systemHealth.labels({ component: 'api' }).set(1);
};

/**
 * Update database connection metrics
 */
export const updateDbMetrics = async (sequelize) => {
  try {
    const pool = sequelize.connectionManager.pool;
    
    if (pool) {
      dbConnections.labels({ state: 'active' }).set(pool.active || 0);
      dbConnections.labels({ state: 'idle' }).set(pool.idle || 0);
      dbConnections.labels({ state: 'total' }).set(pool.max || 0);
    }
  } catch (error) {
    logger.error('Error updating DB metrics', { error: error.message });
  }
};

/**
 * Update cache metrics
 */
export const updateCacheMetrics = async (cacheService) => {
  try {
    const metrics = await cacheService.getMetrics();
    
    if (metrics.connected) {
      const hitRate = parseFloat(metrics.hitRate) || 0;
      cacheHitRate.labels({ cache_type: 'statistics' }).set(hitRate);
      cacheHitRate.labels({ cache_type: 'reference_data' }).set(hitRate);
    }
  } catch (error) {
    logger.error('Error updating cache metrics', { error: error.message });
  }
};

/**
 * Metrics endpoint
 */
export const metricsEndpoint = async (req, res) => {
  try {
    // Update health metrics before serving
    const db = (await import('../models/index.js')).default;
    const { redisClient } = await import('./redis.js');
    const cacheService = (await import('../services/cacheService.js')).default;

    await updateHealthMetrics(db, redisClient);
    await updateDbMetrics(db.sequelize);
    await updateCacheMetrics(cacheService);

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });
    res.status(500).end('Error generating metrics');
  }
};

export default {
  register,
  httpRequestDuration,
  httpRequestCount,
  httpErrors,
  dbQueryDuration,
  dbConnections,
  redisOperations,
  cacheHitRate,
  crimesReported,
  crimesVerified,
  activeUsers,
  systemHealth,
  metricsMiddleware,
  metricsEndpoint,
  updateHealthMetrics,
};
```

### Step 3: Add Metrics Route

**File: `db-project-backend/server.js`**

```javascript
import { metricsEndpoint, metricsMiddleware } from './config/prometheus.js';

// Add metrics endpoint (before other routes)
app.get('/metrics', metricsEndpoint);

// Add metrics middleware to track all requests
app.use(metricsMiddleware({ excludePaths: ['/health', '/ready', '/metrics'] }));
```

### Step 4: Add Business Metrics to Controllers

**File: `db-project-backend/controllers/CrimeControllers.js`**

```javascript
import { crimesReported, crimesVerified } from '../config/prometheus.js';

export const reportCrime = async (req, res) => {
  try {
    // ... existing implementation

    await t.commit();

    // Track metric
    crimesReported.labels({ 
      status: 'submitted', 
      zone_id: zone || 'unknown' 
    }).inc();

    res.status(201).json({
      success: true,
      message: "Crime report submitted successfully",
      data: {
        crime: { ...newCrime },
        submission: newCrimeSubmission,
        media: createdMedia,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    
    crimesReported.labels({ status: 'failed', zone_id: 'unknown' }).inc();
    
    console.error("Report Crime Error:", error);
    res.status(500).json({ success: false, message: "Error adding crime" });
  }
};

export const approveCrimeReport = async (req, res) => {
  try {
    // ... existing implementation

    await t.commit();

    // Track metric
    crimesVerified.labels({ decision: 'approved' }).inc();

    res.status(200).json({
      success: true,
      message: "Crime report approved and verified",
      data: {
        submissionId: submissionId,
        crimeId: updatedCrime.id,
        status: updatedCrime.status,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    
    crimesVerified.labels({ decision: 'failed' }).inc();
    
    console.error("Approve Crime Error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving crime report",
    });
  }
};

export const rejectCrimeReport = async (req, res) => {
  try {
    // ... existing implementation

    await t.commit();

    // Track metric
    crimesVerified.labels({ decision: 'rejected' }).inc();

    res.status(200).json({
      success: true,
      message: "Crime report rejected",
      data: { crimeId: updatedCrime.id, status: updatedCrime.status },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    
    crimesVerified.labels({ decision: 'failed' }).inc();
    
    console.error("Reject Crime Error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting crime report",
    });
  }
};
```

### Step 5: Create Grafana Dashboards

**File: `db-project-backend/config/grafana/dashboards/crimelens-dashboard.json`**

```json
{
  "dashboard": {
    "title": "CrimeLens API Dashboard",
    "tags": ["crimelens", "api"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(crimelens_http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(crimelens_http_request_duration_seconds_bucket[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(crimelens_http_errors_total[5m]) / rate(crimelens_http_requests_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Query Duration",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(crimelens_db_query_duration_seconds_bucket[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "crimelens_db_connections"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "crimelens_cache_hit_rate"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "Crimes Reported (Hourly)",
        "targets": [
          {
            "expr": "rate(crimelens_crimes_reported_total[1h])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "System Health",
        "targets": [
          {
            "expr": "crimelens_system_health"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

### Step 6: Create Prometheus Configuration

**File: `prometheus.yml`** (for local development)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'crimelens-api'
    static_configs:
      - targets: ['localhost:5001']
    metrics_path: '/metrics'
```

### Step 7: Add Health Check Metrics Integration

**File: `db-project-backend/controllers/healthController.js`**

```javascript
import { systemHealth } from '../config/prometheus.js';

export const detailedHealth = async (req, res) => {
  // ... existing health checks

  // Add metrics endpoint reference
  healthInfo._links = {
    metrics: '/metrics',
    health: '/health/detailed',
    ready: '/ready',
  };

  // ... rest of implementation
};
```

## Testing

### Test Metrics Endpoint

```bash
# Scrape metrics
curl http://localhost:5001/metrics

# Should return Prometheus format metrics
# crimelens_http_requests_total{method="GET",route="/api/crimes/types",status_code="200"} 123
```

### Test with Prometheus

```bash
# Start Prometheus locally
docker run -p 9090:9090 \
  -v ~/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Access at http://localhost:9090
```

### Test with Grafana

```bash
# Start Grafana locally
docker run -p 3000:3000 grafana/grafana

# Add Prometheus as data source
# Import dashboard from config
```

## Expected Metrics

**HTTP Metrics:**
- Request rate (RPS)
- Response times (p50, p95, p99)
- Error rate (%)
- Request count by status code

**Database Metrics:**
- Query duration
- Connection pool usage
- Active/idle connections

**Cache Metrics:**
- Hit rate percentage
- Operations count

**Business Metrics:**
- Crimes reported per hour
- Verification decisions (approved/rejected)
- Active users by role

## Success Criteria

- [ ] Metrics endpoint accessible
- [ ] Prometheus format valid
- [ ] Default metrics collected
- [ ] Custom HTTP metrics working
- [ ] Database metrics collected
- [ ] Redis metrics collected
- [ ] Business metrics tracked
- [ ] Grafana dashboard imported
- [ ] Health check metrics included

## Files Created

```
db-project-backend/
├── config/
│   ├── prometheus.js (new)
│   └── grafana/
│       └── dashboards/
│           └── crimelens-dashboard.json (new)
├── controllers/
│   ├── CrimeControllers.js (modified - metrics)
│   └── healthController.js (modified)
└── server.js (modified - metrics endpoint)

prometheus.yml (new - for local development)
```

## Monitoring Dashboard

The Grafana dashboard includes:
1. **API Performance** - Request rate, latency, error rate
2. **Database Health** - Connection pool, query time
3. **Cache Performance** - Hit rate, operations
4. **Business Metrics** - Crimes reported, verification rate
5. **System Health** - Component status

## Dependencies

- Phase 2 health checks (metrics for health status)
- Phase 3 Redis (cache metrics)
- Phase 7 Pino (log metrics integration)

## Rollback Procedure

If monitoring causes performance issues:
1. Remove metrics middleware from server.js
2. Comment out metric tracking in controllers
3. Restart backend

## Estimated Completion Time

- Prometheus setup: 1.5 hours
- Custom metrics: 2 hours
- Controller integration: 1 hour
- Grafana dashboard: 1.5 hours
- Testing: 30 minutes
- **Total: 6.5 hours**
