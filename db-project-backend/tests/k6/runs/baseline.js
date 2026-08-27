import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { check, sleep } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';
import { authLoginFlow } from '../scenarios/auth-login.js';
import { citizenLoginFlow } from '../scenarios/citizen-login.js';
import { crimeReportFlow } from '../scenarios/crime-report.js';
import { BASELINE_THRESHOLDS } from '../lib/helpers.js';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  scenarios: {
    // Scenario 1: Read-only public traffic (80% of load)
    public_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '5m', target: 50 },   // Stay at 50 users
        { duration: '2m', target: 100 },  // Ramp up to 100 users
        { duration: '5m', target: 100 },  // Stay at 100 users
        { duration: '2m', target: 0 },    // Ramp down
      ],
      gracefulStop: '30s',
      exec: 'publicTraffic',
    },

    // Scenario 2: Authentication traffic (15% of load)
    auth_traffic: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
      gracefulStop: '30s',
      exec: 'authTraffic',
    },

    // Scenario 3: Write operations (5% of load)
    write_traffic: {
      executor: 'constant-vus',
      vus: 5,
      duration: '10m',
      gracefulStop: '30s',
      exec: 'writeTraffic',
    },
  },

  thresholds: BASELINE_THRESHOLDS,
};

export function setup() {
  console.log('Setting up baseline test...');

  // Admin token (not currently used by write traffic; kept for future admin flows)
  const adminToken = authLoginFlow();
  if (!adminToken) {
    console.warn('Admin login failed in setup — auth_traffic checks will still validate logins individually.');
  }

  // Citizen token required for crime report submission
  const citizenToken = citizenLoginFlow();
  if (!citizenToken) {
    console.warn('Citizen login failed — write_traffic will skip report submissions.');
  }

  return { adminToken, citizenToken };
}

export function publicTraffic() {
  // Simulate public map and statistics queries
  publicMapFlow();
  sleep(Math.random() * 3 + 1); // 1-4 seconds between requests
}

export function authTraffic() {
  // Simulate login attempts
  authLoginFlow();
  sleep(Math.random() * 5 + 2); // 2-7 seconds between logins
}

export function writeTraffic(data) {
  // Simulate crime report submissions (citizen identity required)
  if (data.citizenToken) {
    crimeReportFlow(data.citizenToken);
    sleep(Math.random() * 10 + 5); // 5-15 seconds between reports
  } else {
    sleep(10); // No valid citizen token — stay idle rather than hammering a failing endpoint
  }
}

export function teardown(data) {
  console.log('Baseline test completed');
}
