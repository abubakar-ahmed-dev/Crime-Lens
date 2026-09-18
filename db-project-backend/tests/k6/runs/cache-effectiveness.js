// Cache-effectiveness measurement (Phase 16).
//
//   API_BASE_URL=http://localhost:18000 k6 run cache-effectiveness.js
//
// Single lane over the two cached endpoints the app actually exposes
// (stats summary + crime types, Redis cache-aside, 5-min TTL). Hit/miss is
// read from the X-Cache response header the backend sets.
//
// Run with the app rate limiter disabled like the other measurement runs.

import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { check, sleep } from 'k6';
import { ENDPOINTS } from '../lib/endpoints.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:18000';

export const cacheHits = new Rate('cache_hits');
export const cacheMisses = new Rate('cache_misses');

export const options = {
  scenarios: {
    cache_probe: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
    },
  },
  thresholds: {
    // 5-min TTL >> 2-min run: after the first warmup miss the window should
    // be essentially all hits. 0.9 leaves headroom for the warmup + TTL edge.
    cache_hits: ['rate>0.9'],
    http_req_failed: ['rate<0.01'],
  },
};

function probe(url, tags) {
  const res = http.get(url, { tags });
  check(res, {
    [`${tags.name} 200`]: (r) => r.status === 200,
  });
  const header = (res.headers['X-Cache'] || res.headers['x-cache'] || '').toUpperCase();
  if (header === 'HIT') cacheHits.add(1);
  else if (header === 'MISS') cacheMisses.add(1);
}

export default function () {
  probe(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`, { name: 'stats-summary' });
  probe(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`, { name: 'crime-types' });
  sleep(0.5);
}
