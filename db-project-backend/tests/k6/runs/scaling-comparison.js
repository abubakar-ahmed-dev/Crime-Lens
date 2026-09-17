// Horizontal-scaling comparison scenario (Phase 11).
//
// Run once per replica count against the edge:
//   API_BASE_URL=http://localhost:18000 k6 run scaling-comparison.js --tag run=1instance
//
// Mixed public read profile: uncached radial map reads (PostGIS, DB-bound —
// randomized coordinates also dodge the Redis cache), cached stats
// (hit-dominated after warmup — noted in the report), and tiny constant
// endpoints. Auth flows are out of scope — no test credentials (see the
// phase-11 plan). Mirrors the request shapes of scenarios/public-map.js.

import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { check, sleep } from 'k6';
import { BASE_URL, ENDPOINTS } from '../lib/endpoints.js';
import { getRandomCoordinate } from '../lib/helpers.js';

const errorRate = new Rate('scaling_errors');
const apiLatency = new Trend('scaling_api_latency');

export const options = {
  scenarios: {
    // Shorter than the phase-0 baseline: the goal is a controlled
    // 1-vs-2-vs-3 comparison, not a soak.
    scaling_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulStop: '15s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

function checkResponse(name, res) {
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  errorRate.add(res.status !== 200);
  apiLatency.add(res.timings.duration);
}

export default function () {
  // DB-bound radial map read (PostGIS + randomized coords => cache misses)
  const coord = getRandomCoordinate();
  const crimes = http.get(
    `${BASE_URL}${ENDPOINTS.MAP_CRIMES}?lat=${coord.lat}&lng=${coord.lng}&radius=5000&mode=radius`,
    { tags: { name: 'radius-crimes' } }
  );
  checkResponse('radius-crimes', crimes);

  // Redis-cached stats (hit-dominated after warmup — noted in the report)
  checkResponse('stats-summary', http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`, { tags: { name: 'stats-summary' } }));

  // Tiny constant responses
  checkResponse('crime-types', http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`, { tags: { name: 'crime-types' } }));

  sleep(1);
}
