/**
 * Standardized API Response Utilities
 *
 * Provides consistent response format across all endpoints.
 * All responses follow this structure:
 * - Success: { success: true, data: any, message?: string }
 * - Error: { success: false, error: string, code?: string }
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {any} options.data - Response data
 * @param {string} options.message - Optional message
 * @param {number} options.statusCode - HTTP status code (default: 200)
 * @param {boolean} options.wrapData - Whether to wrap data in 'data' property (default: false for backward compatibility)
 */
export function success(res, { data, message, statusCode = 200, wrapData = false } = {}) {
  const response = {
    success: true,
  };

  if (data !== undefined) {
    if (wrapData) {
      response.data = data;
    } else {
      // Spread data properties to root level for backward compatibility
      Object.assign(response, data);
    }
  }

  if (message) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {Object} options - Error options
 * @param {string} options.message - Error message
 * @param {number} options.statusCode - HTTP status code (default: 400)
 * @param {string} options.code - Error code for client handling
 */
export function error(res, { message, statusCode = 400, code } = {}) {
  const response = {
    success: false,
    error: message,
  };

  if (code) {
    response.code = code;
  }

  return res.status(statusCode).json(response);
}

/**
 * Common error responses with predefined status codes
 */
export const errors = {
  badRequest: (res, message) => error(res, { message, statusCode: 400, code: 'BAD_REQUEST' }),
  unauthorized: (res, message = 'Unauthorized') => error(res, { message, statusCode: 401, code: 'UNAUTHORIZED' }),
  forbidden: (res, message = 'Forbidden') => error(res, { message, statusCode: 403, code: 'FORBIDDEN' }),
  notFound: (res, message = 'Resource not found') => error(res, { message, statusCode: 404, code: 'NOT_FOUND' }),
  conflict: (res, message) => error(res, { message, statusCode: 409, code: 'CONFLICT' }),
  tooManyRequests: (res, message = 'Too many requests') => error(res, { message, statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' }),
  serverError: (res, message = 'Internal server error') => error(res, { message, statusCode: 500, code: 'SERVER_ERROR' }),
};

/**
 * Validation error response
 * @param {Object} res - Express response object
 * @param {string|string[]} fields - Field name(s) that failed validation
 * @param {string} message - Custom error message
 */
export function validationError(res, fields, message = null) {
  const fieldArray = Array.isArray(fields) ? fields : [fields];
  const errorMsg = message || `Validation failed for: ${fieldArray.join(', ')}`;
  return error(res, { message: errorMsg, statusCode: 400, code: 'VALIDATION_ERROR' });
}

/**
 * Async handler wrapper that catches errors and sends consistent error responses
 * @param {Function} fn - Async route handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Unhandled async error:', err);
      return errors.serverError(res, 'An unexpected error occurred');
    });
  };
}

export default { success, error, errors, validationError, asyncHandler };
