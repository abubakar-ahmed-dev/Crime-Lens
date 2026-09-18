// Rate-limit tier verification (Phase 16) — the app rate limiter MUST be
// ENABLED for this run (config/rateLimiter.js, Redis-backed):
//
//   AUTH   5/min per IP, 5-min lockout   -> /api/auth/login (bogus logins)
//   WRITE 10/min per IP                  -> /api/user/report-crime with a
//                                           valid citizen token but invalid
//                                           payloads: authorizeCitizen
//                                           passes, the limiter consumes,
//                                           schema validation 400s — no
//                                           records created, tier verified
//   PUBLIC 50/min per IP, shared bucket across all publicAPI routes
//                                         -> burst of tiny public reads
//
// Lane order matters: the citizen token is fetched in setup() BEFORE the
// AUTH lane locks the auth limiter, and the AUTH lane runs last because its
// 5-minute lockout would poison any later authenticated request from this
// IP.
//
//   API_BASE_URL=http://localhost:18000 \
//   K6_CITIZEN_EMAIL=... K6_CITIZEN_PASSWORD=... k6 run rate-limit-final.js
//
// Without citizen credentials the WRITE lane skips itself (recorded, honest
// gap — same pattern as phases 4-14).

import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';
import { check, sleep } from 'k6';
import { ENDPOINTS } from '../lib/endpoints.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:18000';

const public429 = new Counter('public_429s');
const write429 = new Counter('write_429s');
const auth429 = new Counter('auth_429s');
const laneFailure = new Rate('lane_failures');

export const options = {
  scenarios: {
    // WRITE first (needs a fresh limiter window; runs immediately).
    write_lane: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 11,
      startTime: '5s',
      exec: 'writeLane',
    },
    // PUBLIC next, in its own minute window.
    public_lane: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 51,
      startTime: '40s',
      exec: 'publicLane',
    },
    // AUTH last: 401s consume the bucket, 6th -> 429, then 5-min lockout.
    auth_lane: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 6,
      startTime: '75s',
      exec: 'authLane',
    },
  },
  thresholds: {
    // Exactly one 429 closes each tier: the (N+1)th request of a N/min tier.
    public_429s: ['count==1'],
    write_429s: ['count==1'],
    auth_429s: ['count==1'],
    lane_failures: ['rate==0'],
  },
};

export function setup() {
  if (!__ENV.K6_CITIZEN_EMAIL || !__ENV.K6_CITIZEN_PASSWORD) {
    console.warn('K6_CITIZEN_EMAIL/K6_CITIZEN_PASSWORD not set — WRITE lane will be SKIPPED (documented gap).');
    return { citizenToken: null, skipped: true };
  }
  const loginRes = http.post(
    `${BASE_URL}${ENDPOINTS.CITIZEN_LOGIN}`,
    JSON.stringify({
      email: __ENV.K6_CITIZEN_EMAIL,
      password: __ENV.K6_CITIZEN_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'citizen-login-setup' } }
  );
  check(loginRes, { 'citizen login 200': (r) => r.status === 200 });
  const body = loginRes.json();
  const token = body?.session?.access_token || null;
  if (!token) {
    console.warn('Citizen login returned no session token — WRITE lane will be SKIPPED.');
    return { citizenToken: null, skipped: true };
  }
  return { citizenToken: token, skipped: false };
}

// WRITE tier: valid token, deliberately invalid payload -> 400 consumes the
// bucket, 11th request hits the 10/min ceiling -> 429.
export function writeLane(data) {
  if (data.skipped) {
    console.warn('WRITE lane skipped (no citizen credentials).');
    sleep(30);
    return;
  }
  const res = http.post(
    `${BASE_URL}${ENDPOINTS.CRIME_REPORT}`,
    JSON.stringify({ deliberately: 'invalid-payload' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.citizenToken}`,
      },
      tags: { name: 'write-tier-probe' },
    }
  );
  const is429 = res.status === 429;
  if (is429) write429.add(1);
  // 400 (validation) or 429 (tier ceiling) are both expected; anything else
  // (500, 404, 403) means the lane measured the wrong thing.
  const ok = res.status === 400 || is429;
  check(res, { 'write probe 400|429': () => ok });
  laneFailure.add(!ok);
  sleep(1);
}

// PUBLIC tier: 51 tiny reads through the shared per-IP publicAPI bucket.
export function publicLane() {
  const res = http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`, {
    tags: { name: 'public-tier-probe' },
  });
  if (res.status === 429) public429.add(1);
  const ok = res.status === 200 || res.status === 429;
  check(res, { 'public probe 200|429': () => ok });
  laneFailure.add(!ok);
}

// AUTH tier: bogus logins -> 401 consumes; 6th -> 429 (5/min + lockout).
export function authLane() {
  const res = http.post(
    `${BASE_URL}${ENDPOINTS.ADMIN_LOGIN}`,
    JSON.stringify({
      username: `rl-probe-${__ITER}@invalid.test`,
      password: 'wrong-password',
      verify_role: 'admin',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth-tier-probe' },
    }
  );
  if (res.status === 429) auth429.add(1);
  // 401 (bad password) and 404 (unknown username, authControllers.login)
  // both mean the request reached the controller and consumed the bucket.
  const ok = res.status === 401 || res.status === 404 || res.status === 429;
  check(res, { 'auth probe 401|404|429': () => ok });
  laneFailure.add(!ok);
  sleep(1);
}
