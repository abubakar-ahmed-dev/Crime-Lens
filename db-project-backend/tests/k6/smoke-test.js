// Quick connectivity smoke test — verify all public/auth endpoints respond
// before running long baseline/stress/spike suites.
// Usage: k6 run tests/k6/smoke-test.js
//
// Reads API_BASE_URL from env. Optional login check requires ADMIN_USERNAME /
// ADMIN_PASSWORD to be set (see .k6.env.sample) and is skipped otherwise.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { ENDPOINTS, BASE_URL } from './lib/endpoints.js';
import { authLoginFlow } from './scenarios/auth-login.js';

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  // Public endpoints (no auth required)
  const r1 = http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`);
  check(r1, { 'crime types 200': (r) => r.status === 200 });

  const r2 = http.get(`${BASE_URL}${ENDPOINTS.ZONES}`);
  check(r2, { 'zones 200': (r) => r.status === 200 });

  const r3 = http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`);
  check(r3, { 'stats summary 200': (r) => r.status === 200 });

  const r4 = http.get(`${BASE_URL}${ENDPOINTS.MAP_CRIMES}?lat=24.86&lng=67.01&radius=5000&mode=radius`);
  check(r4, { 'map crimes (radius) 200': (r) => r.status === 200 });

  // Authenticated endpoint — only runs if ADMIN_USERNAME/ADMIN_PASSWORD are set
  const token = authLoginFlow();
  if (!token) {
    console.log('Login check skipped (no admin credentials provided).');
  }

  sleep(1);
}
