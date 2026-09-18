// Stress-ceiling locator (Phase 16).
//
//   API_BASE_URL=http://localhost:18000 k6 run stress-ceiling.js
//
// OPEN model (constant-arrival-rate) — unlike the closed-model runs, this
// measures actual capacity instead of the workload the VUs happen to
// produce. Staged ramp 50 -> 100 -> 150 -> 200 -> 250 req/s, 90 s per stage,
// over the same mixed public profile as final-comprehensive.js. The report
// records where latency/errors degrade, not a hope.
//
// Run with the app rate limiter disabled: a single-IP open-model run at
// 200+ req/s would be a 429 generator, not a capacity probe.

import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { check, sleep } from 'k6';
import { ENDPOINTS } from '../lib/endpoints.js';
import { getRandomCoordinate } from '../lib/helpers.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:18000';

const errorRate = new Rate('stress_errors');

export const options = {
  scenarios: {
    arrival_ramp: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 600,
      stages: [
        { duration: '90s', target: 50 },
        { duration: '90s', target: 100 },
        { duration: '90s', target: 150 },
        { duration: '90s', target: 200 },
        { duration: '90s', target: 250 },
      ],
      gracefulStop: '15s',
    },
  },
  // Observation run: lenient gates only — the interesting output is WHERE
  // latency/errors break, recorded in the report.
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    stress_errors: ['rate<0.2'],
  },
};

const payloadFor = () => {
  const roll = Math.random();
  if (roll < 0.4) {
    // DB-bound radial read (cache-miss PostGIS path).
    const { lat, lng } = getRandomCoordinate();
    return http.get(
      `${BASE_URL}${ENDPOINTS.MAP_CRIMES}?mode=radius&lat=${lat}&lng=${lng}&radius=${Math.floor(Math.random() * 3000) + 1000}`,
      { tags: { name: 'radius-crimes' } }
    );
  }
  if (roll < 0.6) {
    return http.get(`${BASE_URL}${ENDPOINTS.MAP_CRIMES}?mode=basic`, { tags: { name: 'basic-crimes' } });
  }
  if (roll < 0.8) {
    return http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`, { tags: { name: 'stats-summary' } });
  }
  return http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`, { tags: { name: 'crime-types' } });
};

export default function () {
  const res = payloadFor();
  check(res, { 'status ok': (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  sleep(0.1);
}
