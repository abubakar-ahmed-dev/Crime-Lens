/**
 * Rate limiter configuration (Phase 4).
 *
 * Distributed, Redis-backed rate limiting via rate-limiter-flexible.
 * State lives in Redis (shared across API instances); every limiter also
 * carries an in-memory insuranceLimiter so requests stay protected when
 * Redis is temporarily unavailable (per-instance limits as degraded mode —
 * mirrors the graceful-degradation behaviour of the Phase 3 cache).
 *
 * Keys are namespaced `crimelens:rl:<limiter>:<user:<id>|ip:<addr>>` so they
 * are identifiable and clearable alongside the Phase 3 `crimelens:*` keys.
 *
 * Environment:
 *   RATE_LIMIT_ENABLED        "false" disables all limiting (rollback switch)
 *   RATE_LIMIT_WHITELIST_IPS  comma-separated IPs that bypass rate limiting
 */

import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import { redisClient } from "./redis.js";

/**
 * Rate limit tiers (points per duration window, in seconds)
 */
export const RateLimitConfig = {
  // Strict — authentication endpoints (brute-force protection)
  AUTH: {
    points: 5,
    duration: 60,
    blockDuration: 300, // 5-minute lockout after exhausting the window
  },
  // Moderate — write operations (crime reports, media uploads, updates)
  WRITE: {
    points: 10,
    duration: 60,
    blockDuration: 180,
  },
  // Generous — authenticated read endpoints
  READ: {
    points: 100,
    duration: 60,
    blockDuration: 30,
  },
  // Very strict — sensitive operations (CSV bulk upload: heavy DB + storage work)
  SENSITIVE: {
    points: 3,
    duration: 3600,
    blockDuration: 3600,
  },
  // Public unauthenticated APIs (map, statistics, zones, reference data)
  PUBLIC: {
    points: 50,
    duration: 60,
    blockDuration: 60,
  },
};

export const isRateLimitEnabled = () => process.env.RATE_LIMIT_ENABLED !== "false";

const KEY_PREFIX_BASE = "crimelens:rl";

/**
 * Create a Redis-backed limiter with an in-memory insurance limiter of the
 * same configuration. rate-limiter-flexible automatically falls back to the
 * insurance limiter when a Redis operation fails, so limiting never becomes
 * a hard dependency (same principle as the Phase 3 cache service).
 *
 * Each limiter gets its own keyPrefix — required so concurrent limiters do
 * not interfere with each other's counters in the shared store.
 */
const createLimiter = (name, config) => {
  const options = {
    keyPrefix: `${KEY_PREFIX_BASE}:${name}`,
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
  };
  return new RateLimiterRedis({
    storeClient: redisClient,
    // Required for node-redis v4+ (we run v6): without it rate-limiter-flexible
    // cannot execute commands on the client and EVERY consume silently runs
    // on the in-memory insurance limiter (never truly distributed).
    useRedisPackage: true,
    ...options,
    insuranceLimiter: new RateLimiterMemory(options),
  });
};

/**
 * Pre-configured limiters, one per endpoint family
 */
export const limiters = {
  authLogin: createLimiter("auth", RateLimitConfig.AUTH), // admin/police login
  citizenAuth: createLimiter("citizen-auth", RateLimitConfig.AUTH), // citizen register/login/oauth
  crimeReport: createLimiter("report", RateLimitConfig.WRITE), // citizen crime report submission
  writeAction: createLimiter("write", RateLimitConfig.WRITE), // crime update/delete
  adminUpload: createLimiter("upload", RateLimitConfig.SENSITIVE), // CSV bulk upload
  mediaUpload: createLimiter("media", RateLimitConfig.WRITE), // media upload
  publicAPI: createLimiter("public", RateLimitConfig.PUBLIC), // public read APIs
};

/**
 * IP whitelist (bypasses rate limiting). Defaults to empty — localhost is
 * NOT whitelisted so local testing exercises real limits; add trusted
 * deployment/monitoring IPs via RATE_LIMIT_WHITELIST_IPS.
 */
const whitelistedIPs = new Set(
  (process.env.RATE_LIMIT_WHITELIST_IPS || "")
    .split(",")
    .map((ip) => normalizeIp(ip.trim()))
    .filter(Boolean)
);

/**
 * Normalizes IPv4-mapped IPv6 notation (::ffff:127.0.0.1) so whitelist
 * entries can use plain IPv4.
 */
function normalizeIp(ip) {
  return typeof ip === "string" ? ip.replace(/^::ffff:/i, "") : "";
}

export const isWhitelisted = (ip) => whitelistedIPs.has(normalizeIp(ip));

/**
 * Status summary for the /api/health endpoint (diagnostics only, no secrets).
 * `mode` reflects the store a consume() call would currently hit.
 */
export const getRateLimiterStatus = () => ({
  enabled: isRateLimitEnabled(),
  mode: redisClient.isOpen ? "redis" : "memory-fallback",
});

export default {
  RateLimitConfig,
  limiters,
  isWhitelisted,
  isRateLimitEnabled,
  getRateLimiterStatus,
};
