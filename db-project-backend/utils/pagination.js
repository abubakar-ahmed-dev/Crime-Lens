/**
 * Pagination utility for consistent pagination across endpoints.
 *
 * Pagination is OPT-IN: list endpoints return their legacy (unpaginated)
 * response unless the client supplies a `page` or `limit` query parameter.
 * See Plans/phase-1-postgresql-optimization/plan.md for the contract.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = parseInt(process.env.DEFAULT_PAGE_SIZE || "50", 10);
export const MAX_LIMIT = parseInt(process.env.MAX_PAGE_SIZE || "200", 10);

/**
 * Parse and validate pagination parameters
 * @param {Object} query - Express request query object
 * @returns {Object} { page, limit, offset }
 */
export function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT)
  );

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build pagination metadata for response
 * @param {number|string} page - Current page (1-based)
 * @param {number|string} limit - Items per page
 * @param {number|string} total - Total items (may be a string from pg COUNT)
 * @returns {Object} { pagination: {...} }
 */
export function buildPaginationMeta(page, limit, total) {
  // pg returns COUNT(*) as a string; normalize once here
  const totalNum = parseInt(total, 10) || 0;
  const pageInt = parseInt(page, 10) || DEFAULT_PAGE;
  const limitInt = parseInt(limit, 10) || DEFAULT_LIMIT;
  const totalPages = Math.ceil(totalNum / limitInt);

  return {
    pagination: {
      page: pageInt,
      limit: limitInt,
      total: totalNum,
      totalPages,
      hasNextPage: pageInt < totalPages,
      hasPrevPage: pageInt > 1,
    },
  };
}

/**
 * Build paginated response envelope
 * @param {Array} data - Paginated data
 * @param {Object} meta - Metadata from buildPaginationMeta
 * @returns {Object} { success, data, pagination }
 */
export function buildPaginatedResponse(data, meta) {
  return {
    success: true,
    data,
    ...meta,
  };
}
