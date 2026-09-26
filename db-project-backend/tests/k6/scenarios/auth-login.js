import http from 'k6/http';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { check } from 'k6';

export function authLoginFlow() {
  const username = __ENV.ADMIN_USERNAME;
  const password = __ENV.ADMIN_PASSWORD;

  // Credentials come from environment (.k6.env loaded into shell) — never hardcode.
  if (!username || !password) {
    console.warn('ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping login.');
    return null;
  }

  const adminCredentials = {
    username,
    password,
    verify_role: 'admin', // Required by CrimeLens auth endpoint
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
        return body.success && body.token;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(loginResponse.body);
    return body.token; // API returns token at root, not in data object
  }

  return null;
}
