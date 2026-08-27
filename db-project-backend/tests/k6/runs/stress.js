import http from 'k6/http';
import { check } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';
import { STRESS_THRESHOLDS } from '../lib/helpers.js';

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 500 },
        { duration: '5m', target: 500 },  // Sustained load
        { duration: '2m', target: 0 },   // Ramp down
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: STRESS_THRESHOLDS,
};

export default function () {
  publicMapFlow();
}
