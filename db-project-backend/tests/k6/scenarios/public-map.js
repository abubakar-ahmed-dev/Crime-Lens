import http from 'k6/http';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { group, sleep, check } from 'k6';
import { getRandomCoordinate } from '../lib/helpers.js';

export function publicMapFlow() {
  group('Public Map Data', () => {
    // Test 1: Fetch crime types
    const typesResponse = http.get(`${BASE_URL}${ENDPOINTS.CRIME_TYPES}`);
    check(typesResponse, {
      'crime types status 200': (r) => r.status === 200,
      'crime types has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch {
          return false;
        }
      },
    });

    sleep(1);

    // Test 2: Fetch zones
    const zonesResponse = http.get(`${BASE_URL}${ENDPOINTS.ZONES}`);
    check(zonesResponse, {
      'zones status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 3: Fetch crimes with radius filter (k6-compatible URL building)
    const coord = getRandomCoordinate();
    const crimesParams = `lat=${coord.lat}&lng=${coord.lng}&radius=5000&mode=radius`;

    const crimesResponse = http.get(`${BASE_URL}${ENDPOINTS.MAP_CRIMES}?${crimesParams}`);
    check(crimesResponse, {
      'crimes status 200': (r) => r.status === 200,
      'crimes response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('Statistics Queries', () => {
    // Test 4: Fetch statistics summary
    const summaryResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_SUMMARY}`);
    check(summaryResponse, {
      'summary status 200': (r) => r.status === 200,
      'summary has total zones': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.totalZones !== undefined;
        } catch {
          return false;
        }
      },
    });

    sleep(1);

    // Test 5: Fetch crime type distribution
    const typeDistResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_BY_TYPE}`);
    check(typeDistResponse, {
      'type distribution status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 6: Fetch zone crime counts
    const zoneCountsResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_BY_ZONE}`);
    check(zoneCountsResponse, {
      'zone counts status 200': (r) => r.status === 200,
    });

    sleep(1);

    // Test 7: Fetch crime trend
    const trendResponse = http.get(`${BASE_URL}${ENDPOINTS.STATS_TREND}`);
    check(trendResponse, {
      'trend status 200': (r) => r.status === 200,
    });
  });
}
