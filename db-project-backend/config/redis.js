/**
 * Redis client configuration (Phase 3).
 *
 * Redis is shared infrastructure and must never be a hard dependency:
 * if it is unavailable the API degrades gracefully to direct database
 * queries (see services/cacheService.js).
 *
 * REDIS_URL examples:
 *   redis://localhost:6379                              (local dev)
 *   rediss://<username>:<password>@<host>:<port>        (Redis Cloud / TLS)
 */

import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const createRedisClient = () => {
  const client = redis.createClient({
    url: redisUrl,
    // RESP2 for compatibility with older Redis servers (< 6.0) that lack
    // the HELLO command used to negotiate RESP3
    RESP: 2,
    socket: {
      // Retry indefinitely with capped backoff. A strategy that gives up
      // (returns an Error) permanently disables the client until restart —
      // a temporary Redis outage would silently kill caching (and, in a
      // later phase, rate limiting) for the lifetime of the process.
      reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
    },
  });

  client.on("connect", () => {
    console.log("✅ Redis client connected");
  });

  client.on("error", (err) => {
    // Logged, never thrown — cache consumers treat Redis as best-effort.
    // Connection failures arrive as AggregateError with an empty message,
    // so include the code for diagnosability.
    console.error("Redis Client Error:", err.code || err.message || err);
  });

  client.on("reconnecting", () => {
    console.log("⚠️  Redis client reconnecting...");
  });

  return client;
};

// Create and export singleton client
export const redisClient = createRedisClient();

/**
 * Connect to Redis (called during server startup).
 * Never fails startup — a missing Redis means no caching, not no API.
 */
export const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("✅ Redis connection established");
    return true;
  } catch (error) {
    console.error("❌ Redis connection failed (continuing without cache):", error.message);
    return false;
  }
};

/**
 * Disconnect from Redis (called during graceful shutdown)
 */
export const disconnectRedis = async () => {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.quit();
    console.log("✅ Redis connection closed");
  } catch (error) {
    console.error("❌ Redis disconnection error:", error.message);
  }
};

/**
 * Cache key registry. All keys share the `crimelens:` namespace so
 * pattern invalidation can target exactly this application's data.
 * Crime-data keys (current or future, e.g. `crimelens:crimes:id:42`)
 * must live under `crimelens:crimes:` so PATTERN_CRIMES invalidates them.
 */
export const CacheKeys = {
  STATS_SUMMARY: "crimelens:stats:summary",
  STATS_BY_TYPE: "crimelens:stats:by-type",
  STATS_BY_ZONE: "crimelens:stats:by-zone",
  STATS_TREND: "crimelens:stats:trend",
  CRIME_TYPES: "crimelens:reference:crime-types",
  ZONES: "crimelens:reference:zones",

  // Patterns used for invalidation on write operations
  PATTERN_STATS: "crimelens:stats:*",
  PATTERN_CRIMES: "crimelens:crimes:*",
};

/**
 * TTL configurations (in seconds)
 */
export const CacheTTL = {
  SHORT: 300, // 5 minutes  — statistics (approved-crime aggregates)
  MEDIUM: 600, // 10 minutes — trend data
  LONG: 3600, // 1 hour     — reference data (crime types, zones)
};

export default {
  redisClient,
  connectRedis,
  disconnectRedis,
  CacheKeys,
  CacheTTL,
};
