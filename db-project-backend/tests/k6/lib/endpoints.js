// API endpoint definitions for k6 tests
export const ENDPOINTS = {
  // Public endpoints
  MAP_CRIMES: '/api/crimes/',
  CRIME_TYPES: '/api/crimes/types',
  ZONES: '/api/zones',
  STATS_SUMMARY: '/api/stats/summary',
  STATS_BY_TYPE: '/api/stats/crime-type-distribution',
  STATS_BY_ZONE: '/api/stats/zone-crime-count',
  STATS_TREND: '/api/stats/crime-trend',

  // Auth endpoints
  ADMIN_LOGIN: '/api/auth/login',
  CITIZEN_LOGIN: '/api/citizens/login',

  // Protected endpoints (note: report/pending live under /api/user, not /api/crimes)
  ALL_CRIMES: '/api/crimes/all',
  PENDING_CRIMES: '/api/user/pending',
  CRIME_REPORT: '/api/user/report-crime',

  // Admin endpoints
  BRANCHES: '/api/admin/branches',
  AGENTS: '/api/admin/police-agents',
  UPLOAD_CRIMES: '/api/admin/upload-crimes',
};

export const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5001';
