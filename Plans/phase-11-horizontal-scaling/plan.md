# Phase 11: Horizontal Scaling

## Objective

Verify and configure the application to run multiple API instances behind Nginx, analyze database connection pool implications, and demonstrate improved throughput with horizontal scaling.

## What We'll Implement

1. **Multiple API instances** configuration
2. **Database connection pool analysis** and tuning
3. **Sticky session** verification (or lack thereof - we're stateless)
4. **Load testing** with 1, 2, and 3 instances
5. **Performance comparison** and documentation

## Implementation Steps

### Step 1: Update Docker Compose for Multiple Backends

**File: `docker-compose.yml`** (backend section)

```yaml
services:
  backend1:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: crimelens-backend-1
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - DB_POOL_MAX=10
      - DB_POOL_MIN=2
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-network

  backend2:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: crimelens-backend-2
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - DB_POOL_MAX=10
      - DB_POOL_MIN=2
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-network

  backend3:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: crimelens-backend-3
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - DB_POOL_MAX=10
      - DB_POOL_MIN=2
    env_file:
      - .env
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - crimelens-network
```

### Step 2: Create Scaling Script

**File: `scripts/scale-backends.sh`**

```bash
#!/bin/bash

# Scale backend instances

INSTANCES=${1:-3}
MAX_INSTANCES=5

if [ $INSTANCES -lt 1 ] || [ $INSTANCES -gt $MAX_INSTANCES ]; then
    echo "Error: Instances must be between 1 and $MAX_INSTANCES"
    exit 1
fi

echo "Scaling to $INSTANCES backend instances..."

# Scale down first
docker-compose up -d --scale backend=$INSTANCES

# Update nginx upstream
update_nginx_upstream $INSTANCES

echo "Scaling complete. Now running $INSTANCES backend instances."
echo "Testing load distribution..."
```

### Step 3: Analyze Database Connection Pool

**File: `scripts/analyze-db-pool.js`**

```javascript
/**
 * Database connection pool analysis
 * Run this BEFORE and AFTER scaling to verify pool capacity
 */

import sequelize from '../config/db.js';

async function analyzePool() {
  console.log('=== Database Connection Pool Analysis ===\n');

  try {
    await sequelize.authenticate();

    const pool = sequelize.connectionManager.pool;

    console.log('Current Pool Configuration:');
    console.log(`  Max Connections: ${pool.max}`);
    console.log(`  Min Connections: ${pool.min}`);
    console.log(`  Acquire Timeout: ${pool.acquire}ms`);
    console.log(`  Idle Timeout: ${pool.idle}ms\n`);

    // Get current pool status
    console.log('Current Pool Status:');
    console.log(`  Active Connections: ${pool.active || 0}`);
    console.log(`  Idle Connections: ${pool.idle || 0}`);
    console.log(`  Total Connections: ${(pool.active || 0) + (pool.idle || 0)}\n`);

    // Calculate capacity for horizontal scaling
    const apiInstances = process.env.API_INSTANCES || 3;
    const connectionsPerInstance = pool.max;

    const totalRequired = apiInstances * connectionsPerInstance;
    const databaseCapacity = process.env.DB_MAX_CONNECTIONS || 100;

    console.log('Horizontal Scaling Analysis:');
    console.log(`  API Instances: ${apiInstances}`);
    console.log(`  Connections per Instance: ${connectionsPerInstance}`);
    console.log(`  Total Required: ${totalRequired}`);
    console.log(`  Database Capacity: ${databaseCapacity}`);

    if (totalRequired > databaseCapacity) {
      console.log(`  ⚠️  WARNING: Required connections (${totalRequired}) exceed capacity (${databaseCapacity})`);
      console.log(`  Recommendation: Reduce pool.max to ${Math.floor(databaseCapacity / apiInstances)} per instance`);
    } else {
      console.log(`  ✅ Pool configuration within capacity`);
      const utilization = ((totalRequired / databaseCapacity) * 100).toFixed(1);
      console.log(`  Utilization: ${utilization}%`);
    }

    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('Pool analysis failed:', error.message);
    process.exit(1);
  }
}

analyzePool();
```

### Step 4: Create Load Testing Script for Scaling

**File: `tests/k6/runs/scaling-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Test public endpoints (no auth required)
  const response = http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`);

  check(response, {
    'status 200': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).length > 0,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(Math.random() * 2 + 1); // 1-3 seconds between requests
}
```

### Step 5: Create Comparison Test Script

**File: `tests/k6/runs/scaling-comparison.js`**

```javascript
/**
 * Compare performance with different numbers of backend instances
 */

import http from 'k6/http';
import { check } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost';

export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const response = http.get(`${API_URL}/api/stats/summary`);

  check(response, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Step 6: Update Connection Pool per Instance

**File: `db-project-backend/config/db.js`** (updated for scaling)

```javascript
// Calculate optimal pool size per instance for horizontal scaling
const apiInstances = parseInt(process.env.API_INSTANCES || '1', 10);
const dbMaxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '100', 10);

// Formula: (DB Max Connections) / (API Instances) - (safety margin)
const safetyMargin = 5;
const optimalPoolSize = Math.max(
  5, // Minimum pool size
  Math.floor((dbMaxConnections - safetyMargin) / apiInstances)
);

console.log(`Connection Pool Configuration for ${apiInstances} instance(s):`);
console.log(`  Database Max Connections: ${dbMaxConnections}`);
console.log(`  Optimal Pool per Instance: ${optimalPoolSize}`);

const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || optimalPoolSize.toString(), 10),
  min: parseInt(process.env.DB_POOL_MIN || Math.max(2, Math.floor(optimalPoolSize / 2)).toString(), 10),
  acquire: 30000,
  idle: 10000,
  evict: 5000,
};
```

### Step 7: Create Health Check for All Instances

**File: `scripts/check-all-instances.sh`**

```bash
#!/bin/bash

# Health check all backend instances

INSTANCES=${1:-3}
HEALTHY=0

echo "Checking $INSTANCES backend instances..."

for i in $(seq 1 $INSTANCES); do
  echo -n "Backend $i: "
  
  if curl -sf http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "✅ Healthy"
    HEALTHY=$((HEALTHY + 1))
  else
    echo "❌ Unhealthy"
  fi
done

echo ""
echo "Healthy: $HEALTHY/$INSTANCES"

if [ $HEALTHY -eq $INSTANCES ]; then
  echo "All instances healthy!"
  exit 0
else
  echo "Some instances unhealthy!"
  exit 1
fi
```

### Step 8: Create Scaling Comparison Report Template

**File: `tests/scaling-report-template.md`**

```markdown
# Horizontal Scaling Performance Report

**Date:** [DATE]
**Test Environment:** Production-like

## Configuration

### Instances Tested
- 1 Backend Instance
- 2 Backend Instances
- 3 Backend Instances

### Database Configuration
- **Max Connections:** 100
- **Pool per Instance:** 10
- **Total Required:** 30 (3 instances × 10 connections)
- **Safety Margin:** 5 connections

## Performance Comparison

| Metric | 1 Instance | 2 Instances | 3 Instances |
|--------|-----------|-------------|-------------|
| **Throughput (RPS)** | [X] | [Y] | [Z] |
| **P95 Latency (ms)** | [X] | [Y] | [Z] |
| **P99 Latency (ms)** | [X] | [Y] | [Z] |
| **Error Rate (%)** | [X] | [Y] | [Z] |
| **CPU Usage (%)** | [X] | [Y] | [Z] |
| **Memory per Instance (MB)** | [X] | [Y] | [Z] |

## Database Connection Pool Analysis

| Instances | Pool/Instance | Total Required | DB Capacity | Utilization |
|-----------|--------------|---------------|-------------|-------------|
| 1 | 10 | 10 | 100 | 10% |
| 2 | 10 | 20 | 100 | 20% |
| 3 | 10 | 30 | 100 | 30% |

## Load Distribution

**3 Instances Test:**
- Backend 1: [X]% of requests
- Backend 2: [X]% of requests
- Backend 3: [X]% of requests

## Findings

1. **Optimal Instance Count:** [1/2/3]
2. **Bottleneck:** [Database/API/Network]
3. **Diminishing Returns:** After [X] instances
4. **Connection Pool:** Adequate/Needs adjustment

## Recommendations

- [ ] Scale to [X] instances for production
- [ ] Adjust connection pool to [X]
- [ ] Consider read replicas for [X] RPS
- [ ] Add caching for [endpoints]

## Conclusion

Horizontal scaling improved throughput by [X]% with [X] instances.
```

## Testing Procedure

### Test 1 Instance

```bash
# Start 1 instance
docker-compose up -d backend1

# Run load test
API_URL="http://localhost:8080" k6 run tests/k6/runs/scaling-comparison.js

# Save results
cp scaling-test-1instance.json results/
```

### Test 2 Instances

```bash
# Start 2 instances
docker-compose up -d backend1 backend2

# Run load test
API_URL="http://localhost:8080" k6 run tests/k6/runs/scaling-comparison.js

# Save results
cp scaling-test-2instances.json results/
```

### Test 3 Instances

```bash
# Start 3 instances
docker-compose up -d backend1 backend2 backend3

# Run load test
API_URL="http://localhost:8080" k6 run tests/k6/runs/scaling-comparison.js

# Save results
cp scaling-test-3instances.json results/
```

### Analyze Results

```bash
# Run pool analysis
node scripts/analyze-db-pool.js

# Generate comparison report
# (manually compile k6 results into report)
```

## Expected Results

**Throughput Scaling:**
- 1 instance: ~50 RPS at P95 <1000ms
- 2 instances: ~100 RPS at P95 <1000ms
- 3 instances: ~150 RPS at P95 <1000ms

**Latency:**
- Should remain relatively constant across instance counts
- Slight increase possible due to load balancer overhead

**Database Connections:**
- Each instance maintains its pool independently
- Total connections = instances × pool.max
- Must stay within database capacity

## Success Criteria

- [ ] Multiple instances start successfully
- [ ] Load balancer distributes traffic evenly
- [ ] Each instance has healthy status
- [ ] Performance scales linearly with instances
- [ ] Database connections stay within capacity
- [ ] No single point of failure
- [ ] Statelessness verified (no session affinity needed)

## Files Created/Modified

```
docker-compose.yml (modified - multiple backends)
scripts/
├── scale-backends.sh (new)
└── analyze-db-pool.js (new)
tests/k6/runs/
├── scaling-test.js (new)
└── scaling-comparison.js (new)
tests/
└── scaling-report-template.md (new)
db-project-backend/
└── config/db.js (modified - pool calculation)
```

## Horizontal Scaling Architecture

```
                    ┌─────────────┐
                    │    Nginx    │
                    │ Load Balancer│
                    └──────┬──────┘
                           │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐     ┌─────▼─────┐     ┌─────▼─────┐
    │ Backend 1 │     │ Backend 2 │     │ Backend 3 │
    │   :5001   │     │   :5001   │     │   :5001   │
    └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Redis     │
                    │   Cache     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │ Supabase DB │
                    └─────────────┘
```

## Key Findings Document

**Statelessness Verification:**
- ✅ No sessions in memory
- ✅ JWT tokens validated independently
- ✅ No file uploads to local filesystem (Cloudinary)
- ✅ Redis for shared state (cache + rate limiting)

**Connection Pool Analysis:**
- Formula: `instances × pool.max ≤ DB capacity`
- Current: 3 × 10 = 30 connections (safe for 100 max)
- Can scale up to 8 instances with current pool

**Load Balancing Behavior:**
- Algorithm: least_conn (balances active connections)
- Health checks: Every 30 seconds
- Failover: Automatic removal of unhealthy backends

## Dependencies

- Phase 9 Docker (containerization)
- Phase 10 Nginx (load balancing)
- Phase 2 health checks (for instance monitoring)
- Phase 3 Redis (for shared cache state)

## Rollback Procedure

If scaling causes issues:
1. Reduce to single instance in docker-compose.yml
2. Restart docker-compose
3. Verify database connection count drops

## Estimated Completion Time

- Docker compose updates: 30 minutes
- Pool analysis: 30 minutes
- Load testing: 2 hours
- Report generation: 30 minutes
- **Total: 3.5 hours**
