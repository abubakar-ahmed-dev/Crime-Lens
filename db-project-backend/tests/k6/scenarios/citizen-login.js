import http from 'k6/http';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { check } from 'k6';

// Citizen (Supabase) login — used to obtain a token for crime report
// submission, which requires a citizen identity rather than an admin JWT.
export function citizenLoginFlow() {
  const email = __ENV.CITIZEN_EMAIL;
  const password = __ENV.CITIZEN_PASSWORD;

  // Credentials come from environment (.k6.env loaded into shell) — never hardcode.
  if (!email || !password) {
    console.warn('CITIZEN_EMAIL/CITIZEN_PASSWORD not set — skipping citizen login.');
    return null;
  }

  const credentials = { email, password };

  const loginResponse = http.post(
    `${BASE_URL}${ENDPOINTS.CITIZEN_LOGIN}`,
    JSON.stringify(credentials),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const success = check(loginResponse, {
    'citizen login status 200': (r) => r.status === 200,
    'citizen login has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!(body.success && body.session && body.session.access_token);
      } catch {
        return false;
      }
    },
  });

  if (success) {
    const body = JSON.parse(loginResponse.body);
    return body.session.access_token;
  }

  return null;
}
