import http from 'k6/http';
import { check } from 'k6';
import { publicMapFlow } from '../scenarios/public-map.js';

export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'normalLoad',
    },
    spike: {
      executor: 'constant-vus',
      vus: 500,
      duration: '2m',
      startTime: '2m',
      gracefulStop: '30s',
      exec: 'spikeLoad',
    },
    recovery: {
      executor: 'constant-vus',
      vus: 50,
      startTime: '4m',
      duration: '3m',
      exec: 'normalLoad',
    },
  },
};

export function normalLoad() {
  publicMapFlow();
}

export function spikeLoad() {
  // Intense load during spike
  for (let i = 0; i < 5; i++) {
    publicMapFlow();
  }
}
