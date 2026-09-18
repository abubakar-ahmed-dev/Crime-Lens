// Final comprehensive scalability scenario (Phase 16).
//
// The roadmap's closing measurement run against the full production shape:
// nginx edge -> API pool -> Redis -> Supabase. Reuses the phase-0 lib.
//
//   API_BASE_URL=http://localhost:18000 k6 run final-comprehensive.js
//
// Mixed public read profile (mirrors scenarios/public-map.js + the phase-11
// comparison run): randomized radial map reads (PostGIS, DB-bound, cache
// misses by construction), cached stats reads, and tiny constant endpoints.
// Auth/write flows are exercised by rate-limit-final.js, not here — this run
// characterizes the public read path under the closed model.
//
// NOTE: run with the app rate limiter disabled (override compose file) — a
// single-IP closed-model run would otherwise be dominated by 429s, which is
// rate-limit verification (rate-limit-final.js), not capacity measurement.

import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { check, sleep } from 'k6';
import { ENDPOINTS } from '../lib/endpoints.js';
import { getRandomCoordinate } from '../lib/helpers.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:18000';

const errorRate = new Rate('final_errors');
const apiLatency = new Trend('final_api_latency');

export const options = {
  scenarios: {
    comprehensive_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '6m', target: 100 },
        { duration: '2m', target: 0 },
      ],
      gracefulStop: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

function record(name, res) {
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  apiLatency.add(res.timings.duration);
}

export default function () {
  // 1. Radial map read — randomized coordinates mean a PostGIS radius query
  //    on every request (cache-miss DB path).
  const { lat, lng } = getRandomCoordinate();
  const radius = res =>
    http.get(
      `${BASE_URL}${ENDPOINTS.MAP_CRIMES}?mode=radius&lat=${lat}&lng=${lng}&radius=${Math.floor(Math.random() * 3000) + 1000}`,
      { tags: { name: 'radius-crimes' } }
    );
  record('radius-crimes', radius());

  // 2. Cached stats reads.
  record('stats-summary',
    http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`, { tags: { name: 'stats-summary' } }));
  record('stats-trend',
    http.get(`${BASE_URL}${ENDPOINTS.STATS_TREND}`, { tags: { name: 'stats-trend' } }));

  // 3. Tiny constant endpoints (types + zones).
  record('crime-types',
    http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`, { tags: { name: 'crime-types' } }));
  record('zones',
    http.get(`${BASE_URL}${ENDPOINTS.ZONES}`, { tags: { name: 'zones' } }));

  // 4. Basic (non-radius) map read — the mode the frontend map uses.
  record('basic-crimes',
    http.get(`${BASE_URL}${ENDPOINTS.MAP_CRIMES}?mode=basic`, { tags: { name: 'basic-crimes' } }));

  sleep(1);
}
