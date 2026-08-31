/**
 * Slow-request logging middleware for development.
 * Flags any request whose response took longer than 100ms so expensive
 * endpoint/query patterns surface during local testing.
 *
 * Dev-only: a no-op pass-through in every other environment.
 * Structured request logging arrives with the Pino phase (Phase 7).
 */

const SLOW_REQUEST_THRESHOLD_MS = 100;

export function queryLoggerMiddleware(req, res, next) {
  if (process.env.NODE_ENV !== "development") {
    return next();
  }

  const startTime = Date.now();

  const originalJson = res.json;
  res.json = function (data) {
    const duration = Date.now() - startTime;

    if (duration > SLOW_REQUEST_THRESHOLD_MS) {
      console.log(`⚠️  Slow request detected:`, {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        query: req.query,
      });
    }

    return originalJson.call(this, data);
  };

  next();
}

export default queryLoggerMiddleware;
