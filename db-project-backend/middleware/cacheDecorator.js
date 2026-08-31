/**
 * Cache decorators (Phase 3).
 *
 * Note: the plan sketched these as legacy ES decorators; since the backend
 * has no decorator support, they are implemented as higher-order functions
 * with the same call syntax used in the plan: `withCache(options)(handler)`.
 *
 * withCache implements cache-aside for GET endpoints:
 *   HIT  -> respond immediately from cache
 *   MISS -> run handler; its res.json() payload is stored asynchronously
 *
 * withCacheInvalidation removes keys matching the given patterns after a
 * write handler completes with a 2xx status.
 */

import cacheService from "../services/cacheService.js";

/**
 * Wrap a GET controller with cache-aside behavior
 * @param {Object} options
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 * @param {number} [options.ttl] - TTL in seconds
 * @param {(req: import('express').Request) => boolean} [options.condition]
 */
export const withCache = (options = {}) => {
  const {
    keyGenerator = (req) => req.originalUrl,
    ttl = 300,
    condition = () => true,
  } = options;

  return (handler) =>
    async (req, res, next) => {
      try {
        if (!cacheService.isConnected() || !condition(req)) {
          return handler(req, res, next);
        }

        const cacheKey = keyGenerator(req);

        const cachedValue = await cacheService.get(cacheKey);
        if (cachedValue !== null) {
          res.setHeader("X-Cache", "HIT");
          return res.json(cachedValue);
        }

        // Cache miss: capture the handler's res.json payload and store it.
        // Only successful responses are cached — errors must never be.
        // Cache writes are fire-and-forget so response latency is unaffected.
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          if (res.statusCode < 400) {
            cacheService.set(cacheKey, data, ttl).catch((err) => {
              console.error("Cache set error:", err.message);
            });
          }
          res.setHeader("X-Cache", "MISS");
          return originalJson(data);
        };

        return handler(req, res, next);
      } catch (error) {
        // Any decorator failure must not break the endpoint
        console.error("Cache decorator error:", error.message);
        return handler(req, res, next);
      }
    };
};

/**
 * Wrap a write controller with pattern-based cache invalidation.
 * Invalidation runs after the handler completes with a 2xx status and is
 * awaited so a request racing right behind the write can never observe a
 * stale cached value. Failures are swallowed — a failed invalidation must
 * never fail the write itself.
 * @param {string[]} patterns - Key patterns to delete (e.g. 'crimelens:stats:*')
 */
export const withCacheInvalidation = (patterns = []) => {
  return (handler) =>
    async (req, res, next) => {
      const result = await handler(req, res, next);

      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          try {
            await cacheService.deletePattern(pattern);
          } catch (err) {
            console.error(`Cache invalidation error for ${pattern}:`, err.message);
          }
        }
      }

      return result;
    };
};

export default { withCache, withCacheInvalidation };
