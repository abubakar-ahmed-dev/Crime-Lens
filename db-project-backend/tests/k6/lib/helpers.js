import { check } from 'k6';

// Custom thresholds for baseline
export const BASELINE_THRESHOLDS = {
  'http_req_duration': ['p(95)<500', 'p(99)<1000'],
  'http_req_failed': ['rate<0.05'],
};

// Stress test thresholds (more lenient)
export const STRESS_THRESHOLDS = {
  'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
  'http_req_failed': ['rate<0.10'],
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
