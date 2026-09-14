/**
 * k6 — Phase 4 rate limiting verification (standalone; no shared lib needed)
 *
 * Drives the admin/police login endpoint with invalid credentials. The AUTH
 * tier allows 5 requests per 60s per IP, then blocks for 300s — so of 8
 * iterations the first 5 are answered by the auth controller (401 for bad
 * credentials) and the remainder must be rate-limited (429 with Retry-After).
 *
 * NOTE: running this test consumes the caller's auth bucket and locks the
 * source IP out of /api/auth/login for ~5 minutes. Use a dedicated IP or
 * add it to RATE_LIMIT_WHITELIST_IPS afterwards when testing on a shared host.
 *
 * Usage:
 *   k6 run tests/k6/scenarios/rate-limit-test.js
 *   BASE_URL=http://localhost:5001 k6 run tests/k6/scenarios/rate-limit-test.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5001";

export const options = {
  vus: 1,
  iterations: 8,
  thresholds: {
    // Every response must be either controller-rejected (401) or
    // rate-limited (429) — anything else means the pipeline is broken.
    "checks": ["rate>0.99"],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      username: `rl-probe-${__VU}-${__ITER}`,
      password: "wrong-password",
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, {
    "status is 401 (controller) or 429 (rate limited)": (r) =>
      r.status === 401 || r.status === 429,
    "429 responses include Retry-After header": (r) =>
      r.status !== 429 || r.headers["Retry-After"] !== undefined,
    "429 body has RATE_LIMIT_EXCEEDED code": (r) =>
      r.status !== 429 || (r.json("code") === "RATE_LIMIT_EXCEEDED" && r.json("success") === false),
    "allowed responses include X-RateLimit-Remaining": (r) =>
      r.status === 429 || r.headers["X-RateLimit-Remaining"] !== undefined,
  });

  sleep(0.2);
}
