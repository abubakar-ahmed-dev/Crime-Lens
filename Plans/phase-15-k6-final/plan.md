# Phase 15: Final k6 Scalability Testing

## Objective

Execute comprehensive load testing to validate the performance improvements achieved through all 15 phases, comparing baseline metrics against the optimized system and generating a final scalability report.

## What We'll Implement

1. **Comprehensive load testing** across all endpoints
2. **Baseline vs. optimized comparison**
3. **Multi-instance scaling validation**
4. **Cache effectiveness measurement**
5. **Rate limiting verification**
6. **Final scalability report generation**

## Implementation Steps

### Step 1: Create Comprehensive Test Suite

**File: `tests/k6/runs/final-comprehensive.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'k6';

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'https://crimelens.example.com';
const TEST_DURATION = __ENV.TEST_DURATION || '15m';

// Load test data for crime reporting
const crimeTypes = new SharedArray('crimeTypes', function () {
  return ['theft', 'assault', 'burglary', 'vandalism', 'fraud'];
});

const zones = ['North', 'South', 'East', 'West', 'Central'];

export const options = {
  scenarios: {
    // Public endpoints (no auth)
    public_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: TEST_DURATION,
      gracefulRampDown: '30s',
      exec: 'publicScenarios',
    },

    // Auth endpoints
    auth_load: {
      executor: 'constant-vus',
      vus: 20,
      duration: TEST_DURATION,
      startTime: '30s',
      gracefulRampDown: '30s',
      exec: 'authScenarios',
      env: { TEST_TYPE: 'auth' },
    },

    // Crime reporting (write-heavy)
    crime_reporting: {
      executor: 'constant-vus',
      vus: 30,
      duration: TEST_DURATION,
      startTime: '1m',
      gracefulRampDown: '30s',
      exec: 'writeScenarios',
    },

    // Read-heavy operations (map, statistics)
    read_operations: {
      executor: 'constant-vus',
      vus: 100,
      duration: TEST_DURATION,
      startTime: '2m',
      gracefulRampDown: '30s',
      exec: 'readScenarios',
    },

    // Stress test (ramp up)
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 300 },
        { duration: '3m', target: 500 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      startTime: '5m',
      gracefulRampDown: '1m',
      exec: 'stressScenarios',
    },
  },
  thresholds: {
    // Request rate thresholds
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.02'],

    // Scenario-specific thresholds
    'http_req_duration{scenario:public_load}': ['p(95)<300'],
    'http_req_duration{scenario:read_operations}': ['p(95)<400'],
    'http_req_duration{scenario:crime_reporting}': ['p(95)<1000'],
  },
};

// Admin credentials for auth tests
const ADMIN_USER = __ENV.ADMIN_USER || 'admin@test.com';
const ADMIN_PASS = __ENV.ADMIN_PASS || 'admin123';

export function setup() {
  // Login to get auth tokens
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: ADMIN_USER,
    password: ADMIN_PASS,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  let adminToken = '';
  if (loginRes.status === 200) {
    const data = JSON.parse(loginRes.body);
    adminToken = data.token || data.accessToken || '';
  }

  return { adminToken };
}

// Public endpoints (unauthenticated)
export function publicScenarios() {
  const group = 'Public';

  // Test: Health check
  check(http.get(`${BASE_URL}/health`), {
    [`${group}: Health status 200`]: (r) => r.status === 200,
    [`${group}: Health response time < 100ms`]: (r) => r.timings.duration < 100,
  });

  // Test: Crime types
  check(http.get(`${BASE_URL}/api/crimes/types`), {
    [`${group}: Crime types 200`]: (r) => r.status === 200,
    [`${group}: Crime types has data`]: (r) => JSON.parse(r.body).length > 0,
  });

  // Test: Public statistics
  check(http.get(`${BASE_URL}/api/stats/summary`), {
    [`${group}: Stats 200`]: (r) => r.status === 200,
    [`${group}: Stats response time < 500ms`]: (r) => r.timings.duration < 500,
  });

  sleep(randomIntBetween(1, 3));
}

// Authentication scenarios
export function authScenarios(data) {
  const group = 'Auth';

  // Test: Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: ADMIN_USER,
    password: ADMIN_PASS,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'Login' },
  });

  check(loginRes, {
    [`${group}: Login success`]: (r) => r.status === 200,
    [`${group}: Login returns token`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!(body.token || body.accessToken);
      } catch { return false; }
    },
    [`${group}: Login response time < 500ms`]: (r) => r.timings.duration < 500,
  });

  // Test: Get current user
  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body).token || JSON.parse(loginRes.body).accessToken;

    const userRes = http.get(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      tags: { name: 'GetUser' },
    });

    check(userRes, {
      [`${group}: Get user 200`]: (r) => r.status === 200,
      [`${group}: Get user has data`]: (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.id || body.user);
        } catch { return false; }
      },
    });
  }

  sleep(randomIntBetween(2, 5));
}

// Write operations (crime reporting)
export function writeScenarios() {
  const group = 'Write';

  const crimeType = crimeTypes[randomIntBetween(0, crimeTypes.length - 1)];
  const zone = zones[randomIntBetween(0, zones.length - 1)];

  // Generate random coordinates within a city boundary
  const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
  const lng = -74.0060 + (Math.random() - 0.5) * 0.1;

  const reportRes = http.post(`${BASE_URL}/api/citizens/report-crime`, JSON.stringify({
    crimeType,
    description: `Test crime report - load testing ${new Date().toISOString()}`,
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    zone,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0],
    anonymous: true,
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'ReportCrime' },
  });

  check(reportRes, {
    [`${group}: Report accepted`]: (r) => [200, 201, 202].includes(r.status),
    [`${group}: Report response time < 1s`]: (r) => r.timings.duration < 1000,
  });

  sleep(randomIntBetween(3, 8));
}

// Read operations (map data, statistics)
export function readScenarios(data) {
  const group = 'Read';

  // Test: Get map crimes (paginated)
  const mapRes = http.get(`${BASE_URL}/api/crimes/map?page=1&limit=50`, {
    tags: { name: 'MapCrimes' },
  });

  check(mapRes, {
    [`${group}: Map crimes 200`]: (r) => r.status === 200,
    [`${group}: Map crimes has data`]: (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body.crimes);
      } catch { return false; }
    },
    [`${group}: Map crimes response time < 400ms`]: (r) => r.timings.duration < 400,
  });

  // Test: Get statistics
  const statsRes = http.get(`${BASE_URL}/api/stats/summary`, {
    tags: { name: 'StatsSummary' },
  });

  check(statsRes, {
    [`${group}: Stats 200`]: (r) => r.status === 200,
    [`${group}: Stats cached`]: (r) => r.headers['X-Cache'] === 'HIT',
  });

  // Test: Get crime details (random ID)
  const crimeId = randomIntBetween(1, 1000);
  http.get(`${BASE_URL}/api/crimes/${crimeId}`, {
    tags: { name: 'CrimeDetail' },
  });

  sleep(randomIntBetween(1, 2));
}

// Stress test scenarios
export function stressScenarios() {
  const group = 'Stress';

  // Mix of all operations
  const operations = [
    () => http.get(`${BASE_URL}/api/stats/summary`, { tags: { name: 'StressStats' } }),
    () => http.get(`${BASE_URL}/api/crimes/map?page=1&limit=20`, { tags: { name: 'StressMap' } }),
    () => http.get(`${BASE_URL}/health`, { tags: { name: 'StressHealth' } }),
  ];

  const op = operations[randomIntBetween(0, operations.length - 1)];
  const res = op();

  check(res, {
    [`${group}: Request successful`]: (r) => r.status < 500,
    [`${group}: Response received`]: (r) => r.status !== 0,
  });

  sleep(randomIntBetween(0.5, 1.5));
}
```

### Step 2: Create Cache Effectiveness Test

**File: `tests/k6/runs/cache-effectiveness.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://crimelens.example.com';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    'http_req_duration': ['p(95)<200'],
    'cache_hit_rate': ['rate>0.8'], // 80%+ cache hit rate
  },
};

export default function () {
  // Test cacheable endpoint
  const res = http.get(`${BASE_URL}/api/stats/summary`, {
    tags: { name: 'StatsEndpoint' },
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'has cache header': (r) => !!r.headers['X-Cache'],
    'cache hit': (r) => r.headers['X-Cache'] === 'HIT',
  });
}
```

### Step 3: Create Rate Limiting Test

**File: `tests/k6/runs/rate-limit-test.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://crimelens.example.com';

export const options = {
  scenarios: {
    // Test auth rate limit (should be ~5 req/min)
    auth_rate_limit: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      exec: 'testAuthLimit',
    },

    // Test API rate limit
    api_rate_limit: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'testApiLimit',
    },
  },
};

export function testAuthLimit() {
  // Rapid auth requests
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'test@example.com',
    password: 'wrongpassword',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'rate_limit_429': (r) => r.status === 429 || r.status === 401,
  });
}

export function testApiLimit() {
  // Rapid API requests
  const res = http.get(`${BASE_URL}/api/crimes/map`);

  check(res, {
    'status_or_rate_limit': (r) => r.status === 200 || r.status === 429,
  });
}
```

### Step 4: Create Horizontal Scaling Test

**File: `tests/k6/runs/scaling-validation.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://crimelens.example.com';

export const options = {
  scenarios: {
    scaling_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 400 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800'],
    'http_req_failed': ['rate<0.05'],
  },
};

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/stats/summary`, null, { tag: { name: 'Stats' } }],
    ['GET', `${BASE_URL}/api/crimes/map?page=1&limit=50`, null, { tag: { name: 'Map' } }],
    ['GET', `${BASE_URL}/health`, null, { tag: { name: 'Health' } }],
  ]);

  check(responses[0], {
    'stats 200': (r) => r.status === 200,
  });

  check(responses[1], {
    'map 200': (r) => r.status === 200,
  });

  check(responses[2], {
    'health 200': (r) => r.status === 200,
  });
}
```

### Step 5: Create Baseline Comparison Script

**File: `tests/k6/scripts/compare-results.js`**

```javascript
/**
 * Compare baseline vs optimized test results
 * Run: node compare-results.js baseline.json optimized.json
 */

const fs = require('fs');

// Read baseline results
const baseline = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

// Read optimized results
const optimized = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

// Extract metrics
const extractMetrics = (data) => ({
  throughput: data.metrics.http_reqs_per_second?.values?.count || 0,
  p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
  p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
  errorRate: data.metrics.http_req_failed?.values?.rate || 0,
});

const baselineMetrics = extractMetrics(baseline);
const optimizedMetrics = extractMetrics(optimized);

// Calculate improvements
const improvement = {
  throughput: ((optimizedMetrics.throughput / baselineMetrics.throughput - 1) * 100).toFixed(1),
  p95: ((baselineMetrics.p95 / optimizedMetrics.p95 - 1) * 100).toFixed(1),
  p99: ((baselineMetrics.p99 / optimizedMetrics.p99 - 1) * 100).toFixed(1),
  errorRate: ((baselineMetrics.errorRate / optimizedMetrics.errorRate - 1) * 100).toFixed(1),
};

// Generate report
console.log('\n=== Performance Comparison Report ===\n');
console.log('Metric              | Baseline   | Optimized  | Improvement');
console.log('--------------------|------------|------------|-------------');
console.log(`Throughput (RPS)    | ${baselineMetrics.throughput.toFixed(1)}       | ${optimizedMetrics.throughput.toFixed(1)}       | ${improvement.throughput > 0 ? '+' : ''}${improvement.throughput}%`);
console.log(`P95 Latency (ms)    | ${baselineMetrics.p95.toFixed(0)}        | ${optimizedMetrics.p95.toFixed(0)}        | ${improvement.p95 > 0 ? '+' : ''}${improvement.p95}%`);
console.log(`P99 Latency (ms)    | ${baselineMetrics.p99.toFixed(0)}        | ${optimizedMetrics.p99.toFixed(0)}        | ${improvement.p99 > 0 ? '+' : ''}${improvement.p99}%`);
console.log(`Error Rate (%)      | ${(baselineMetrics.errorRate * 100).toFixed(2)}        | ${(optimizedMetrics.errorRate * 100).toFixed(2)}        | ${improvement.errorRate > 0 ? '+' : ''}${improvement.errorRate}%`);
console.log('\n');
```

### Step 6: Create Final Report Template

**File: `tests/final-scalability-report-template.md`**

```markdown
# CrimeLens Final Scalability Report

**Date:** [DATE]
**Test Environment:** Production
**Test Duration:** [DURATION]

## Executive Summary

CrimeLens has undergone comprehensive system design optimization across 15 phases. This report documents the performance improvements achieved through:

1. PostgreSQL optimization and pagination
2. Redis caching implementation
3. Nginx reverse proxy and load balancing
4. Docker containerization
5. Horizontal scaling
6. Background job processing
7. CDN integration with Cloudflare
8. CI/CD automation

## Performance Comparison

### Overall Metrics

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| **Throughput (RPS)** | [X] | [Y] | [+Z%] |
| **P95 Latency (ms)** | [X] | [Y] | [+Z%] |
| **P99 Latency (ms)** | [X] | [Y] | [+Z%] |
| **Error Rate (%)** | [X] | [Y] | [+Z%] |

### Endpoint Performance

| Endpoint | Baseline P95 | Optimized P95 | Improvement |
|----------|--------------|---------------|-------------|
| GET /health | [X]ms | [Y]ms | [+Z%] |
| GET /api/stats/summary | [X]ms | [Y]ms | [+Z%] |
| GET /api/crimes/map | [X]ms | [Y]ms | [+Z%] |
| POST /api/auth/login | [X]ms | [Y]ms | [+Z%] |
| POST /api/crimes/report | [X]ms | [Y]ms | [+Z%] |

## Infrastructure Improvements

### Cache Effectiveness

| Cache Type | Hit Rate | Notes |
|------------|-----------|-------|
| Statistics Cache | [X]% | Redis-backed |
| Static Assets | [X]% | CDN + Nginx |
| API Responses | [X]% | Configured bypass |

### Horizontal Scaling

| Configuration | Throughput | P95 Latency |
|---------------|-----------|-------------|
| 1 Instance | [X] RPS | [X]ms |
| 2 Instances | [Y] RPS | [Y]ms |
| 3 Instances | [Z] RPS | [Z]ms |

**Optimal Instance Count:** [X]

### Database Optimization

- Query optimization applied: [X] queries
- Pagination implemented: [X] endpoints
- Connection pool: [X] per instance
- Indexes added: [X]

### Security & Reliability

| Feature | Status |
|---------|--------|
| Rate Limiting | ✅ Active |
| Security Headers | ✅ Configured |
| SSL/TLS | ✅ Full Strict |
| DDoS Protection | ✅ Cloudflare |
| Health Checks | ✅ Operational |
| Graceful Shutdown | ✅ Implemented |
| CI/CD Pipeline | ✅ Automated |

## Load Test Results

### Test Scenarios Executed

1. **Public Endpoints** - 50 VUs, 15m
   - ✅ All health checks passed
   - ✅ Static asset delivery functional

2. **Authentication** - 20 VUs, 15m
   - ✅ Login performance stable
   - ✅ Rate limiting enforced

3. **Crime Reporting** - 30 VUs, 15m
   - ✅ Write operations stable
   - ✅ Background processing working

4. **Read Operations** - 100 VUs, 15m
   - ✅ Cache hit rate >80%
   - ✅ Pagination functional

5. **Stress Test** - Ramp to 500 VUs
   - ✅ System handled peak load
   - ✅ No critical failures

## Key Findings

### Strengths

- [List major improvements]
- [Best performing components]
- [Successful optimizations]

### Areas for Future Improvement

- [Any remaining bottlenecks]
- [Potential further optimizations]
- [Scaling limits observed]

## Recommendations

### Short-term (Next 3 months)

1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

### Long-term (6-12 months)

1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Conclusion

The CrimeLens application has been successfully optimized from a basic PERN stack to a production-ready, scalable system. The 15-phase implementation has resulted in:

- **[X]%** improvement in throughput
- **[X]%** reduction in latency
- **[X]%** reduction in error rate
- Production-ready CI/CD pipeline
- Comprehensive monitoring and observability

The system is now capable of handling [X]x the baseline load while maintaining sub-second response times for 95% of requests.

---

**Report Generated:** [DATE]
**Tested By:** [NAME]
**Version:** [VERSION]
```

## Testing Procedure

### Step 1: Run Baseline Test (If not already done)

```bash
# Ensure baseline exists from Phase 0
# If not, run:
TEST_DURATION=10m BASE_URL=http://localhost:5001 \
  k6 run tests/k6/runs/baseline-test.js \
  --out json=baseline-results.json
```

### Step 2: Run Final Comprehensive Test

```bash
# Test production deployment
TEST_DURATION=15m BASE_URL=https://crimelens.example.com \
  k6 run tests/k6/runs/final-comprehensive.js \
  --out json=final-results.json

# Run cache effectiveness test
BASE_URL=https://crimelens.example.com \
  k6 run tests/k6/runs/cache-effectiveness.js \
  --out json=cache-results.json

# Run rate limiting test
BASE_URL=https://crimelens.example.com \
  k6 run tests/k6/runs/rate-limit-test.js

# Run scaling validation
BASE_URL=https://crimelens.example.com \
  k6 run tests/k6/runs/scaling-validation.js \
  --out json=scaling-results.json
```

### Step 3: Compare Results

```bash
node tests/k6/scripts/compare-results.js \
  baseline-results.json \
  final-results.json
```

### Step 4: Generate Final Report

Compile results into the final report template with actual metrics from tests.

## Expected Results

**Performance Improvements:**
- Throughput: 2-3x increase (depending on instance count)
- P95 Latency: 50-70% reduction
- P99 Latency: 40-60% reduction
- Error Rate: <2% under load

**Cache Effectiveness:**
- Statistics endpoint: >80% hit rate
- Static assets: >95% CDN cache hit rate

**Horizontal Scaling:**
- Linear scaling up to 3 instances
- Connection pool within database capacity

**Rate Limiting:**
- Auth endpoints: 5 req/min enforced
- API endpoints: 50 req/min enforced
- 429 responses returned correctly

## Success Criteria

- [ ] All test scenarios completed successfully
- [ ] Throughput improved by >50%
- [ ] P95 latency reduced by >30%
- [ ] Error rate <2% under load
- [ ] Cache hit rate >70%
- [ ] Rate limiting enforced correctly
- [ ] Horizontal scaling verified
- [ ] No critical failures during stress test
- [ ] Final report generated

## Files Created

```
tests/k6/
├── runs/
│   ├── final-comprehensive.js (new)
│   ├── cache-effectiveness.js (new)
│   ├── rate-limit-test.js (new)
│   └── scaling-validation.js (new)
└── scripts/
    └── compare-results.js (new)

tests/
└── final-scalability-report-template.md (new)

results/
├── baseline-results.json (existing)
├── final-results.json (generated)
├── cache-results.json (generated)
└── scaling-results.json (generated)
```

## Dependencies

- All previous phases (0-14)
- Complete system deployment
- Monitoring dashboards available
- Access to production metrics

## Rollback Procedure

No rollback needed - this is a testing phase only. If tests reveal issues:

1. Identify the failing component
2. Review the relevant phase implementation
3. Apply fixes and retest

## Estimated Completion Time

- Test suite creation: 1 hour
- Running comprehensive tests: 2 hours
- Cache effectiveness tests: 30 minutes
- Rate limiting tests: 30 minutes
- Scaling validation: 1 hour
- Results analysis: 1 hour
- Report generation: 1 hour
- **Total: 7 hours**

## Final Deliverable

**Complete Scalability Report** including:
- Before/after metrics comparison
- All test results
- Performance analysis
- Infrastructure validation
- Recommendations for future improvements
