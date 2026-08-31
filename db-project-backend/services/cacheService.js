/**
 * Cache service for the cache-aside pattern (Phase 3).
 *
 * All operations are error-resilient by contract: a Redis failure can
 * never propagate into the request path. Callers get `null` on a miss,
 * `false` on a failed write, and the database remains the source of truth.
 */

import { redisClient, CacheTTL } from "../config/redis.js";

class CacheService {
  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached value or null
   */
  async get(key) {
    try {
      if (!redisClient.isOpen) return null;

      const value = await redisClient.get(key);
      if (!value) return null;

      return JSON.parse(value);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param {string} key - Cache key
   * @param {Object} value - JSON-serializable value
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} true if stored
   */
  async set(key, value, ttl = CacheTTL.MEDIUM) {
    try {
      if (!redisClient.isOpen) return false;

      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete a single key
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} true if the command ran
   */
  async delete(key) {
    try {
      if (!redisClient.isOpen) return false;

      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete all keys matching a glob pattern (e.g. 'crimelens:stats:*').
   * Uses SCAN in batches instead of KEYS to avoid blocking Redis.
   * scanIterator yields single keys under RESP3 but whole batches under
   * RESP2, so both shapes are normalized here.
   * @param {string} pattern - Key pattern
   * @returns {Promise<boolean>} true if any keys were deleted
   */
  async deletePattern(pattern) {
    try {
      if (!redisClient.isOpen) return false;

      let deleted = 0;
      for await (const yielded of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const batch = Array.isArray(yielded) ? yielded : [yielded];
        if (batch.length === 0) continue;
        await redisClient.del(batch);
        deleted += batch.length;
      }
      return deleted > 0;
    } catch (error) {
      console.error(`Cache pattern delete error for ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Check whether the Redis client currently has an open connection
   * @returns {boolean}
   */
  isConnected() {
    return redisClient.isOpen === true;
  }

  /**
   * Redis hit/miss metrics from the server's INFO stats section.
   * @returns {Promise<Object>} { connected, hits, misses, hitRate } shape
   */
  async getMetrics() {
    try {
      if (!redisClient.isOpen) {
        return { connected: false };
      }

      const info = await redisClient.info("stats");
      const stats = {};
      info.split("\n").forEach((line) => {
        const [key, value] = line.split(":");
        if (key && value) stats[key.trim()] = value.trim();
      });

      const hits = Number(stats.keyspace_hits) || 0;
      const misses = Number(stats.keyspace_misses) || 0;
      const total = hits + misses;

      return {
        connected: true,
        hits,
        misses,
        hitRate: total > 0 ? Number(((hits / total) * 100).toFixed(2)) : 0,
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

export default new CacheService();
