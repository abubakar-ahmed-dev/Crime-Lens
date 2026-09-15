/**
 * Rate limiting middleware (Phase 4).
 *
 * Wraps the pre-configured Redis-backed limiters from config/rateLimiter.js
 * into Express middleware. On every request it:
 *   1. Skips entirely when RATE_LIMIT_ENABLED=false (rollback switch)
 *   2. Bypasses whitelisted IPs (headers still advertise "unlimited")
 *   3. Consumes one point for the caller (authenticated user id, else IP)
 *   4. Adds X-RateLimit-* headers and continues
 *   5. Answers 429 + Retry-After when the bucket is exhausted
 *
 * Fail-open: if a store operation throws anything that is not a normal
 * "points exhausted" rejection (e.g. both Redis and the in-memory insurance
 * limiter failed), the request continues and the error is logged — rate
 * limiting is protective infrastructure and must never take the API down.
 */

import { RateLimiterRes } from "rate-limiter-flexible";
import {
  limiters,
  isWhitelisted,
  isRateLimitEnabled,
} from "../config/rateLimiter.js";

const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please try again later.";

/**
 * Caller identity for the rate limit key.
 * Priority: authenticated user id (JWT or Supabase) > client IP.
 * Middleware ordering: limiters placed after auth middleware on protected
 * routes get per-user buckets; unauthenticated routes use per-IP buckets.
 */
const getClientKey = (req) => {
  if (req.user?.id) return `user:${req.user.id}`;
  // ::ffff: prefixes are normalized for consistent keys/whitelisting
  const ip = (req.ip || "").replace(/^::ffff:/i, "");
  return `ip:${ip}`;
};

/**
 * Standard informational headers. `resetMs` is the time until the current
 * window/block expires.
 */
const setRateLimitHeaders = (res, { limit, remaining, resetMs, blocked = false }) => {
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", new Date(Date.now() + resetMs).toISOString());
  if (blocked) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(resetMs / 1000))));
  }
};

/**
 * Rate limiting middleware factory
 * @param {string} limiterType - key of the pre-configured limiter to apply
 * @returns {Function} Express middleware
 */
export const applyRateLimit = (limiterType) => {
  const limiter = limiters[limiterType];

  return async (req, res, next) => {
    // Rollback switch: env-configured kill switch for all rate limiting
    if (!isRateLimitEnabled() || !limiter) return next();

    if (isWhitelisted(req.ip)) {
      setRateLimitHeaders(res, { limit: limiter.points, remaining: "unlimited", resetMs: 0 });
      return next();
    }

    try {
      const rateRes = await limiter.consume(getClientKey(req));

      setRateLimitHeaders(res, {
        limit: limiter.points,
        remaining: rateRes.remainingPoints,
        resetMs: rateRes.msBeforeNext,
      });
      return next();
    } catch (rejection) {
      if (!(rejection instanceof RateLimiterRes)) {
        // Store failure beyond the insurance limiter — fail open, keep serving
        req.log.error(
          { err: rejection, limiterType },
          "Rate limiter store error — failing open"
        );
        return next();
      }

      setRateLimitHeaders(res, {
        limit: limiter.points,
        remaining: 0,
        resetMs: rejection.msBeforeNext,
        blocked: true,
      });

      const retryAfter = Math.max(1, Math.ceil(rejection.msBeforeNext / 1000));
      return res.status(429).json({
        success: false,
        error: TOO_MANY_REQUESTS_MESSAGE,
        message: TOO_MANY_REQUESTS_MESSAGE,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
      });
    }
  };
};

export default { applyRateLimit };
