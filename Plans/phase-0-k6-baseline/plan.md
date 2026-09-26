# Phase 0: k6 Baseline Performance Testing

## Objective

Establish a comprehensive performance baseline for the current CrimeLens application before implementing any system design upgrades. This baseline will serve as the "before" measurement for all subsequent improvements.

## What We'll Measure

- **Throughput**: Requests per second (RPS) the system can handle
- **Latency**: P50, P95, and P99 response times
- **Error Rates**: Percentage of failed requests
- **Concurrent Users**: Maximum sustainable concurrent users
- **Resource Utilization**: Database and API resource consumption

## Prerequisites

- k6 CLI installed (`brew install k6` on macOS, `choco install k6` on Windows)
- CrimeLens backend running on port 5001
- CrimeLens frontend accessible (for user simulation tests)
- Supabase PostgreSQL database operational
- Test data seeded (crimes, zones, crime types)

## Implementation Steps

### Step 1: Create Test Infrastructure Folder

Create `db-project-backend/tests/k6/` directory structure:

```
db-project-backend/tests/k6/
├── lib/
│   ├── endpoints.js      # API endpoint definitions
│   └── helpers.js        # Reusable test functions
├── scenarios/
│   ├── public-map.js     # Public map data queries
│   ├── statistics.js     # Statistics endpoints
│   ├── auth-login.js     # Authentication endpoints
│   ├── crime-report.js   # Crime report submission
│   └── admin-upload.js   # Admin CSV upload
└── runs/
    ├── baseline.js       # Main baseline test suite
    ├── stress.js         # Stress test
    └── spike.js          # Spike test
```

### Step 2: Create Shared Libraries

**File: `tests/k6/lib/endpoints.js`**

```javascript
// API endpoint definitions
export const ENDPOINTS = {
  // Public endpoints
  MAP_CRIMES: '/api/crimes/',
  CRIME_TYPES: '/api/crimes/types',
  ZONES: '/api/zones',
  STATS_SUMMARY: '/api/stats/summary',
  STATS_BY_TYPE: '/api/stats/crime-type-distribution',
  STATS_BY_ZONE: '/api/stats/zone-crime-count',
  STATS_TREND: '/api/stats/crime-trend',

  // Auth endpoints
  ADMIN_LOGIN: '/api/auth/login',
  CITIZEN_LOGIN: '/api/citizens/login',

  // Protected endpoints
  ALL_CRIMES: '/api/crimes/all',
  PENDING_CRIMES: '/api/crimes/pending',
  CRIME_REPORT: '/api/crimes/report',

  // Admin endpoints
  BRANCHES: '/api/admin/branches',
  AGENTS: '/api/admin/police-agents',
  UPLOAD_CRIMES: '/api/admin/upload-crimes',
};

export const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5001';
```

**File: `tests/k6/lib/helpers.js`**

```javascript
import { check } from 'k6';
import { textReport } from 'https://jslib.k6.io/k6-reporter/0.0.2/index.js';

// Custom thresholds for baseline
export const BASELINE_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.05'],
};

// Stress test thresholds (more lenient)
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  http_req_failed: ['rate<0.10'],
};

// Authentication helper
export function getAuthHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// Response checker
export function checkResponse(response, checks) {
  return check(response, checks);
}

// Random coordinate within Pakistan bounds
export function getRandomCoordinate() {
  const lat = (Math.random() * (26 - 23) + 23).toFixed(6);
  const lng = (Math.random() * (68 - 65) + 65).toFixed(6);
  return { lat, lng };
}
```

### Step 3: Create Scenario Scripts

**File: `tests/k6/scenarios/public-map.js`**

```javascript
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { group, sleep } from 'k6';
import { getRandomCoordinate } from '../lib/helpers.js';

export function publicMapFlow() {
  group('Public Map Data', () => {
    // Test 1: Fetch crime types
    const typesResponse = http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`);
    check(typesResponse, {
      'crime types status 200': (r) => r.status === 200,
      'crime types has data': (r) => JSON.parse(r.body).length > 0,
    });

    sleep(1);

    // Test 2: Fetch zones
    const zonesResponse = http.get(`${BASE_URL}${ENDPOINTS.ZONES}`);
    check(zonesResponse, {
      'zones status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 3: Fetch crimes with radius filter
    const coord = getRandomCoordinate();
    const crimesParams = new URLSearchParams({
      lat: coord.lat,
      lng: coord.lng,
      radius: '5000',
      mode: 'radius',
    });

    const crimesResponse = http.get(`${BASE_URL}${ENDPOINTS.MAP_CRIMES}?${crimesParams}`);
    check(crimesResponse, {
      'crimes status 200': (r) => r.status === 200,
      'crimes response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('Statistics Queries', () => {
    // Test 4: Fetch statistics summary
    const summaryResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`);
    check(summaryResponse, {
      'summary status 200': (r) => r.status === 200,
      'summary has total zones': (r) => {
        const body = JSON.parse(r.body);
        return body.totalZones !== undefined;
      },
    });

    sleep(1);

    // Test 5: Fetch crime type distribution
    const typeDistResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_BY_TYPE}`);
    check(typeDistResponse, {
      'type distribution status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 6: Fetch zone crime counts
    const zoneCountsResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_BY_ZONE}`);
    check(zoneCountsResponse, {
      'zone counts status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 7: Fetch crime trend
    const trendResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_TREND}`);
    check(trendResponse, {
      'trend status 200': (r) => r.status === 200,
    });
  });
}
```

**File: `tests/k6/scenarios/auth-login.js`**

```javascript
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { check } from 'k6';

export function authLoginFlow() {
  const adminCredentials = {
    username: __ENV.ADMIN_USERNAME || 'admin',
    password: __ENV.ADMIN_PASSWORD || 'admin123',
  };

  const loginResponse = http.post(
    `${BASE_URL}${ENDPOINTS.ADMIN_LOGIN}`,
    JSON.stringify(adminCredentials),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(loginResponse, {
    'login status 200': (r) => r.status === 200,
    'login has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data.token;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(loginResponse.body);
    return body.data.token; // Return token for subsequent requests
  }

  return null;
}
```

**File: `tests/k6/scenarios/crime-report.js`**

```javascript
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { check, group } from 'k6';
import { getRandomCoordinate } from '../lib/helpers.js';

export function crimeReportFlow(authToken) {
  group('Crime Report Submission', () => {
    const reportData = {
      zone: 1,
      crimeTypeId: 1,
      date: new Date().toISOString().split('T')[0],
      address: 'Test Address',
      description: 'Test crime report for load testing',
      title: 'Load Test Crime',
      latitude: getRandomCoordinate().lat,
      longitude: getRandomCoordinate().lng,
    };

    const reportResponse = http.post(
      `${BASE_URL}${ENDPOINTS.CRIME_REPORT}`,
      JSON.stringify(reportData),
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    check(reportResponse, {
      'report status 201': (r) => r.status === 201,
      'report success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
    });
  });
}
```

### Step 4: Create Main Baseline Test

**File: `tests/k6/runs/baseline.js`**

```javascript
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { check, sleep } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';
import { authLoginFlow } from '../scenarios/auth-login.js';
import { crimeReportFlow } from '../scenarios/crime-report.js';
import { BASELINE_THRESHOLDS } from '../lib/helpers.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const dbQueryTime = new Trend('db_query_time');

export const options = {
  scenarios: {
    // Scenario 1: Read-only public traffic (80% of load)
    public_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'publicTraffic',
    },

    // Scenario 2: Authentication traffic (15% of load)
    auth_traffic: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      gracefulRampDown: '30s',
      exec: 'authTraffic',
    },

    // Scenario 3: Write operations (5% of load)
    write_traffic: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      gracefulRampDown: '30s',
      exec: 'writeTraffic',
    },
  },

  thresholds: BASELINE_THRESHOLDS,
};

export function setup() {
  // Setup: Create test authentication token
  console.log('Setting up baseline test...');
  const token = authLoginFlow();
  return { authToken: token };
}

export function publicTraffic() {
  // Simulate public map and statistics queries
  publicMapFlow();
  sleep(Math.random() * 3 + 1); // 1-4 seconds between requests
}

export function authTraffic() {
  // Simulate login attempts
  authLoginFlow();
  sleep(Math.random() * 5 + 2); // 2-7 seconds between logins
}

export function writeTraffic(data) {
  // Simulate crime report submissions
  if (data.authToken) {
    crimeReportFlow(data.authToken);
    sleep(Math.random() * 10 + 5); // 5-15 seconds between reports
  }
}

export function teardown(data) {
  console.log('Baseline test completed');
  console.log(`Total errors: ${errorRate.count}`);
}
```

### Step 5: Create Stress Test

**File: `tests/k6/runs/stress.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';
import { STRESS_THRESHOLDS } from '../lib/helpers.js';

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },  // Sustained load
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: STRESS_THRESHOLDS,
};

export default function () {
  publicMapFlow();
}
```

### Step 6: Create Spike Test

**File: `tests/k6/runs/spike.js`**

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';

export const options = {
  scenarios: {
    spike_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'normalLoad',
    },
    spike: {
      executor: 'per-vu-iterations',
      vus: 500,
      iterations: 10,
      startTime: '2m',
      gracefulRampDown: '30s',
      exec: 'spikeLoad',
    },
    recovery: {
      executor: 'constant-vus',
      vus: 50,
      startTime: '4m',
      duration: '3m',
      exec: 'normalLoad',
    },
  },
};

export function normalLoad() {
  publicMapFlow();
}

export function spikeLoad() {
  // Intense load during spike
  for (let i = ; i < 5; i++) {
    publicMapFlow();
  }
}
```

### Step 7: Create HTML Report Generator

**File: `tests/k6/lib/reporter.js`**

```javascript
import { textReport } from 'https://jslib.k6.io/k6-reporter/0.0.2/index.js';

export function handleSummary(data) {
  console.log('Generating baseline report...');

  return {
    'stdout': textReport(data, { indent: ' ', enableThresholdsColors: true }),
    'baseline-summary.json': JSON.stringify(data),
  };
}
```

### Step 8: Add Test Data Seeder

**File: `tests/k6/seed-data.js`**

```javascript
// Helper to seed test data if needed
// Run with: k6 run tests/k6/seed-data.js

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/endpoints.js';

export const options = {
  vus: 1,
  iterations: 1,
};

export function setup() {
  const crimesToCreate = [
    { zone: 1, crimeTypeId: 1, title: 'Theft - Area A', lat: 24.5, lng: 67.0 },
    { zone: 1, crimeTypeId: 2, title: 'Assault - Area B', lat: 24.6, lng: 67.1 },
    { zone: 2, crimeTypeId: 1, title: 'Theft - Area C', lat: 25.0, lng: 67.5 },
    // Add more test data as needed
  ];

  const createdCrimes = [];

  for (const crime of crimesToCreate) {
    const response = http.post(
      `${BASE_URL}/api/crimes/report`,
      JSON.stringify(crime),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (check(response, { 'status 201': (r) => r.status === 201 })) {
      createdCrimes.push(crime);
    }
  }

  console.log(`Created ${createdCrimes.length} test crimes`);
  return createdCrimes;
}
```

## Environment Variables

Create `.k6.env` file:

```bash
# API Configuration
API_BASE_URL=http://localhost:5001

# Test Credentials (create test user in DB)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
CITIZEN_EMAIL=test@example.com
CITIZEN_PASSWORD=test123
```

## Execution Steps

### 1. Prepare Environment

```bash
# Start backend
cd db-project-backend
npm start

# Verify API is running
curl http://localhost:5001/api/crimes/types
```

### 2. Run Baseline Test

```bash
# Load environment variables
export $(cat .k6.env | xargs)

# Run baseline test
k6 run --out json=baseline-results.json db-project-backend/tests/k6/runs/baseline.js
```

### 3. Run Stress Test

```bash
k6 run db-project-backend/tests/k6/runs/stress.js
```

### 4. Run Spike Test

```bash
k6 run db-project-backend/tests/k6/runs/spike.js
```

## Expected Output Format

The baseline test will generate:

1. **Console Output** - Real-time metrics
2. **JSON Results** - Detailed performance data
3. **HTML Report** - Visual summary (if using k6-reporter)

### Key Metrics to Record:

```json
{
  "metrics": {
    "http_req_duration": {
      "p(95)": 450,
      "p(99)": 890
    },
    "http_req_failed": {
      "rate": 0.02
    },
    "vus": {
      "value": 100,
      "max": 100
    }
  }
}
```

## Baseline Report Template

Create this report after running the tests:

```markdown
# CrimeLens Performance Baseline Report

## Test Configuration
- Date: [DATE]
- Backend Version: [COMMIT_HASH]
- Database: Supabase PostgreSQL
- Test Environment: [DEV/STAGING]

## Baseline Metrics

### Throughput
- Maximum sustainable RPS: [VALUE]
- Breakpoint RPS: [VALUE]

### Latency (Baseline)
- P50: [X]ms
- P95: [Y]ms
- P99: [Z]ms

### Error Rates
- Normal load (100 VUs): [X]%
- High load (300 VUs): [Y]%
- Stress load (500 VUs): [Z]%

### Resource Utilization
- DB CPU during baseline: [X]%
- DB memory during baseline: [Y]MB
- API CPU during baseline: [Z]%

### Endpoint Performance
| Endpoint | P95 (ms) | P99 (ms) | Error Rate |
|----------|-----------|----------|------------|
| /api/crimes/ | [X] | [Y] | [Z]% |
| /api/stats/* | [X] | [Y] | [Z]% |
| /api/auth/login | [X] | [Y] | [Z]% |

## Issues Identified
- [List any bottlenecks or errors discovered]

## Next Steps
- Proceed to Phase 1: PostgreSQL Optimization
```

## Verification Steps

1. **Test Infrastructure**: Run `k6 version` to verify installation
2. **API Connectivity**: Verify all endpoints return 200 status
3. **Test Data**: Ensure database has test data (zones, crime types, sample crimes)
4. **Baseline Execution**: Complete baseline test and generate report
5. **Report Storage**: Save baseline report to `Plans/phase-0-k6-baseline/baseline-report.md`

## Files to Create

```
db-project-backend/tests/k6/
├── lib/
│   ├── endpoints.js
│   ├── helpers.js
│   └── reporter.js
├── scenarios/
│   ├── public-map.js
│   ├── auth-login.js
│   └── crime-report.js
├── runs/
│   ├── baseline.js
│   ├── stress.js
│   └── spike.js
└── seed-data.js

.k6.env (environment configuration)
```

## Success Criteria

- [ ] k6 test infrastructure created
- [ ] All scenarios execute without errors
- [ ] Baseline metrics recorded in report
- [ ] Stress test identifies breaking point
- [ ] Spike test shows recovery behavior
- [ ] Report saved for Phase 15 comparison

## Dependencies

- CrimeLens backend running locally
- Test data seeded in database
- Valid authentication credentials
- Network connectivity to Supabase

## Rollback Procedure

If tests fail:
1. Verify backend is running correctly
2. Check database connectivity
3. Verify test credentials are valid
4. Review k6 error logs
5. Re-run with fewer VUs if resources are insufficient

## Estimated Completion Time

- Test infrastructure setup: 1-2 hours
- Test script development: 2-3 hours
- Baseline execution and analysis: 1 hour
- **Total: 4-6 hours**
