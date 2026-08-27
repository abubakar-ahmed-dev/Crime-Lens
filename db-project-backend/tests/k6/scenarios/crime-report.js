import http from 'k6/http';
import { ENDPOINTS, BASE_URL } from '../lib/endpoints.js';
import { check, group } from 'k6';
import { getRandomCoordinate } from '../lib/helpers.js';

// Crime report submission requires a CITIZEN (Supabase) token,
// not an admin JWT — the endpoint is POST /api/user/report-crime.
export function crimeReportFlow(citizenToken) {
  group('Crime Report Submission', () => {
    const coord = getRandomCoordinate();
    const reportData = {
      zone: 1,
      crimeTypeId: 1,
      date: new Date().toISOString().split('T')[0],
      address: 'Test Address',
      description: 'Test crime report for load testing',
      title: 'Load Test Crime',
      latitude: parseFloat(coord.lat),
      longitude: parseFloat(coord.lng),
    };

    const reportResponse = http.post(
      `${BASE_URL}${ENDPOINTS.CRIME_REPORT}`,
      JSON.stringify(reportData),
      {
        headers: {
          'Authorization': `Bearer ${citizenToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    check(reportResponse, {
      'report status 201': (r) => r.status === 201,
      'report success': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
    });
  });
}
