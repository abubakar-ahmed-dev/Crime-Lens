# Phase 2: Health Checks

## Objective

Implement comprehensive health check endpoints to enable monitoring, orchestration, and production deployment readiness. Health checks will be designed to accommodate future Redis dependency.

## What We'll Implement

1. **`/health`** endpoint - Process health (API is running)
2. **`/ready`** endpoint - Dependency health (PostgreSQL → PostgreSQL + Redis)
3. **Health check middleware** - Request tracking and monitoring hooks
4. **Graceful shutdown** - Proper connection cleanup

## Design Philosophy

The health check system is designed to be forward-compatible:

**Phase 2 (Current):**
```
/health → API process healthy
/ready  → PostgreSQL reachable
```

**Phase 3+ (After Redis):**
```
/health → API process healthy
/ready  → PostgreSQL ✓ + Redis ✓
```

This avoids redesign when Redis is added in Phase 3.

## Implementation Steps

### Step 1: Create Health Check Controller

**File: `db-project-backend/controllers/healthController.js`**

```javascript
import db from '../models/index.js';
import { version } from '../../package.json';

/**
 * Health check response structure
 */
const buildHealthResponse = (status, details = {}) => ({
  status,
  timestamp: new Date().toISOString(),
  version,
  uptime: process.uptime(),
  environment: process.env.NODE_ENV || 'development',
  details,
});

/**
 * Process health check
 * Checks if the API process is running and responsive
 */
export const processHealth = async (req, res) => {
  try {
    // Basic process info
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const health = buildHealthResponse('healthy', {
      process: {
        uptime: Math.floor(process.uptime()),
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      },
      api: {
        responding: true,
      },
    });

    res.json(health);
  } catch (error) {
    res.status(503).json(buildHealthResponse('unhealthy', {
      error: error.message,
    }));
  }
};

/**
 * Readiness check
 * Checks if the API can serve requests (dependencies are healthy)
 * 
 * Phase 2: Only checks PostgreSQL
 * Phase 3+: Will also check Redis
 */
export const readinessCheck = async (req, res) => {
  const checks = {
    database: {
      status: 'unknown',
      message: '',
      responseTime: null,
    },
    redis: {
      status: 'not_implemented',
      message: 'Redis not yet implemented (Phase 3)',
    },
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

  // Build response
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'ready' ? 200 : 503;
  res.status(statusCode).json(response);
};

/**
 * Liveness check
 * Simple check to see if the process is alive
 * Used by Kubernetes/orchestrators to restart dead containers
 */
export const livenessCheck = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Detailed health check
 * Includes all dependency checks and system info
 */
export const detailedHealth = async (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    hostname: req.hostname,
    checks: {},
  };

  // Database check
  try {
    await db.sequelize.authenticate();
    healthInfo.checks.database = {
      status: 'up',
      message: 'Database connection successful',
    };
  } catch (error) {
    healthInfo.checks.database = {
      status: 'down',
      message: error.message,
    };
    healthInfo.status = 'unhealthy';
  }

  // Memory check (warn if >80% used)
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  healthInfo.checks.memory = {
    status: heapUsedPercent > 80 ? 'warning' : 'ok',
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
    percentUsed: Math.round(heapUsedPercent) + '%',
  };

  // Event loop lag check
  const lag = process.uptime();
  healthInfo.checks.eventLoop = {
    status: 'ok',
    lag: lag + 's',
  };

  const statusCode = healthInfo.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthInfo);
};

export default {
  processHealth,
  readinessCheck,
  livenessCheck,
  detailedHealth,
};
```

### Step 2: Create Health Check Routes

**File: `db-project-backend/routes/healthRoutes.js`**

```javascript
import express from 'express';
import {
  processHealth,
  readinessCheck,
  livenessCheck,
  detailedHealth,
} from '../controllers/healthController.js';

const router = express.Router();

/**
 * Health Check Endpoints
 * 
 * GET /health - Process health check (always returns 200 if process is alive)
 * GET /ready - Readiness check (returns 503 if dependencies are down)
 * GET /healthz - Kubernetes-style liveness probe
 * GET /health/detailed - Detailed health with all checks
 */

// Standard health endpoints
router.get('/health', processHealth);
router.get('/ready', readinessCheck);
router.get('/healthz', livenessCheck);
router.get('/health/detailed', detailedHealth);

// Legacy endpoints (for compatibility)
router.get('/', processHealth);
router.get('/live', livenessCheck);

export default router;
```

### Step 3: Mount Health Routes in Server

**File: `db-project-backend/server.js`**

```javascript
// Add import
import healthRoutes from "./routes/healthRoutes.js";

// Mount health routes BEFORE other routes (for reliability)
app.use('/api', healthRoutes);

// Rest of the routes remain the same
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
// ... other routes
```

### Step 4: Add Graceful Shutdown

**File: `db-project-backend/server.js`**

```javascript
// Add at the end of server.js

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Close database connections
  try {
    await sequelize.close();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }

  // Close any other resources (Redis in Phase 3, etc.)
  
  console.log('Graceful shutdown completed');
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
```

### Step 5: Add Health Check Monitoring Hooks

**File: `db-project-backend/middleware/healthMonitor.js`**

```javascript
/**
 * Health monitoring middleware
 * Tracks request/response metrics for health monitoring
 */

class HealthMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      lastRequestTime: null,
    };
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Track request
      this.metrics.totalRequests++;
      this.metrics.lastRequestTime = new Date().toISOString();

      // Intercept response
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - startTime;
        
        // Update metrics
        if (res.statusCode >= 200 && res.statusCode < 400) {
          healthMonitor.metrics.successfulRequests++;
        } else {
          healthMonitor.metrics.failedRequests++;
          healthMonitor.metrics.lastError = {
            statusCode: res.statusCode,
            path: req.path,
            timestamp: new Date().toISOString(),
          };
        }

        // Update average response time
        const total = healthMonitor.metrics.totalRequests;
        const currentAvg = healthMonitor.metrics.averageResponseTime;
        healthMonitor.metrics.averageResponseTime = 
          ((currentAvg * (total - 1)) + duration) / total;

        return originalJson.call(this, data);
      };

      next();
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.failedRequests / this.metrics.totalRequests || 0,
      successRate: this.metrics.successfulRequests / this.metrics.totalRequests || 0,
    };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastError: null,
      lastRequestTime: null,
    };
  }
}

const healthMonitor = new HealthMonitor();

export default healthMonitor;
```

### Step 6: Add Metrics to Health Check

**File: `db-project-backend/controllers/healthController.js`**

```javascript
// Add import
import healthMonitor from '../middleware/healthMonitor.js';

// Update detailedHealth function to include metrics
export const detailedHealth = async (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    hostname: req.hostname,
    checks: {},
    metrics: healthMonitor.getMetrics(),
  };

  // ... rest of the checks remain the same
};
```

### Step 7: Add Health Check to Frontend

**File: `db-project-frontend/src/utils/apiHealth.js`**

```typescript
/**
 * API Health Monitoring
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  message?: string;
}

class APIHealthMonitor {
  private status: HealthStatus = {
    status: 'healthy',
    lastCheck: new Date(),
  };

  private checkInterval: number = 30000; // 30 seconds
  private intervalId: number | null = null;

  async checkHealth(): Promise<HealthStatus> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/health`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.status = {
          status: 'healthy',
          lastCheck: new Date(),
        };
      } else {
        this.status = {
          status: 'degraded',
          lastCheck: new Date(),
          message: `API returned ${response.status}`,
        };
      }
    } catch (error) {
      this.status = {
        status: 'down',
        lastCheck: new Date(),
        message: 'API unreachable',
      };
    }

    return this.status;
  }

  startMonitoring() {
    if (this.intervalId) return;

    // Initial check
    this.checkHealth();

    // Start periodic checks
    this.intervalId = window.setInterval(() => {
      this.checkHealth();
    }, this.checkInterval);
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getStatus(): HealthStatus {
    return this.status;
  }
}

export const apiHealthMonitor = new APIHealthMonitor();
```

### Step 8: Add Health Status Component

**File: `db-project-frontend/src/components/APIHealthIndicator.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { apiHealthMonitor } from '../utils/apiHealth';

interface Props {
  showDetails?: boolean;
}

export const APIHealthIndicator: React.FC<Props> = ({ showDetails = false }) => {
  const [status, setStatus] = useState(apiHealthMonitor.getStatus());

  useEffect(() => {
    // Start monitoring on mount
    apiHealthMonitor.startMonitoring();

    // Update status when it changes
    const interval = setInterval(() => {
      setStatus(apiHealthMonitor.getStatus());
    }, 5000);

    return () => {
      apiHealthMonitor.stopMonitoring();
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    switch (status.status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span className="text-xs text-gray-600">
        API {status.status === 'healthy' ? 'OK' : status.status.toUpperCase()}
      </span>
      {showDetails && status.message && (
        <span className="text-xs text-gray-500">({status.message})</span>
      )}
    </div>
  );
};
```

## Testing

### Backend Health Checks

```bash
# Test process health
curl http://localhost:5001/api/health

# Test readiness
curl http://localhost:5001/api/ready

# Test liveness
curl http://localhost:5001/api/healthz

# Test detailed health
curl http://localhost:5001/api/health/detailed
```

### Test Database Failure

```bash
# Stop database and test readiness
# Should return 503 with database status: down
```

### Frontend Integration

```typescript
// In App.tsx or main layout
import { APIHealthIndicator } from './components/APIHealthIndicator';

function App() {
  return (
    <div>
      <header>
        <APIHealthIndicator showDetails={false} />
      </header>
      {/* ... rest of app */}
    </div>
  );
}
```

## Expected Response Format

**Healthy Response:**
```json
{
  "status": "ready",
  "timestamp": "2025-08-25T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "message": "Database connection successful",
      "responseTime": 15
    },
    "redis": {
      "status": "not_implemented",
      "message": "Redis not yet implemented (Phase 3)"
    }
  }
}
```

## Success Criteria

- [ ] `/api/health` endpoint returns 200
- [ ] `/api/ready` endpoint returns 200 when DB is up, 503 when down
- [ ] `/api/health/detailed` includes all system metrics
- [ ] Graceful shutdown closes connections properly
- [ ] Frontend health indicator displays status
- [ ] Health checks complete in <100ms

## Files Created

```
db-project-backend/
├── controllers/
│   └── healthController.js (new)
├── routes/
│   └── healthRoutes.js (new)
├── middleware/
│   └── healthMonitor.js (new)
└── server.js (modified - graceful shutdown)

db-project-frontend/
├── src/
│   ├── utils/
│   │   └── apiHealth.js (new)
│   └── components/
│       └── APIHealthIndicator.tsx (new)
```

## Integration with Future Phases

**Phase 3 (Redis):** Add Redis check to `/ready` endpoint
```javascript
checks.redis = {
  status: redisClient.isReady ? 'up' : 'down',
  message: redisClient.isReady ? 'Redis connection successful' : 'Redis connection failed',
};
```

**Phase 8 (Prometheus):** Expose health metrics for scraping
```javascript
// Add to health controller
res.setHeader('Content-Type', 'text/plain');
res.send(prometheusRegister.metrics());
```

## Dependencies

- PostgreSQL database must be accessible
- No Redis dependency yet (Phase 3)

## Rollback Procedure

If health checks cause issues:
1. Remove health route mounting from server.js
2. Comment out graceful shutdown handlers
3. Restart backend

## Estimated Completion Time

- Backend health check implementation: 1-2 hours
- Frontend health indicator: 30 minutes
- Testing and verification: 30 minutes
- **Total: 2-3 hours**
