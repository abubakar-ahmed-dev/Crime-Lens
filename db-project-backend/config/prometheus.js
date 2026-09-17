/**
 * Prometheus metrics (Phase 8).
 *
 * Design rules (see Plans/phase-8-prometheus-grafana/plan.md):
 * - `/metrics` serves the register with ZERO I/O of its own. Gauges that
 *   need live state (DB pool, Redis hit rate, component health) are
 *   refreshed by a 30s unref'd interval (startMetricsUpdater), so a
 *   Prometheus scrape never hammers Supabase/Redis.
 * - Route labels use the matched route PATTERN (e.g. /api/crimes/update/:id),
 *   never raw paths — raw IDs would create unbounded label cardinality.
 * - Request bodies are never observable here; no secrets are exposed.
 * - `/metrics` itself is excluded from request logging and from the metrics
 *   middleware; rate limiters do not apply at app root level.
 */

import promClient from "prom-client";
import { redisClient } from "./redis.js";
import db from "../models/index.js";

const { sequelize } = db;

export const register = new promClient.Registry();

// Node/process defaults (event loop lag, heap, GC, handles…)
promClient.collectDefaultMetrics({ register });

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export const httpRequestDuration = new promClient.Histogram({
  name: "crimelens_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestCount = new promClient.Counter({
  name: "crimelens_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpErrors = new promClient.Counter({
  name: "crimelens_http_errors_total",
  help: "Total number of HTTP error responses (status >= 400)",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Redis / cache
// ---------------------------------------------------------------------------

export const redisOperations = new promClient.Counter({
  name: "crimelens_redis_operations_total",
  help: "Total Redis cache operations",
  labelNames: ["operation", "status"],
  registers: [register],
});

export const cacheHitRate = new promClient.Gauge({
  name: "crimelens_cache_hit_rate",
  help: "Redis keyspace hit rate (0-1) from INFO stats",
  registers: [register],
});

// ---------------------------------------------------------------------------
// Database connection pool (Sequelize 6 uses the tarn pool)
// ---------------------------------------------------------------------------

export const dbPoolConnections = new promClient.Gauge({
  name: "crimelens_db_pool_connections",
  help: "Sequelize connection pool state",
  labelNames: ["state"],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export const crimesReported = new promClient.Counter({
  name: "crimelens_crimes_reported_total",
  help: "Crime reports submitted",
  labelNames: ["status", "zone_id"],
  registers: [register],
});

export const crimesVerified = new promClient.Counter({
  name: "crimelens_crimes_verified_total",
  help: "Crime verification decisions",
  labelNames: ["decision"],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Component health
// ---------------------------------------------------------------------------

export const systemHealth = new promClient.Gauge({
  name: "crimelens_system_health",
  help: "Component health (1=healthy, 0=unhealthy)",
  labelNames: ["component"],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Refresh helpers (interval-driven; NOT run inside the scrape path)
// ---------------------------------------------------------------------------

export const updatePoolMetrics = () => {
  try {
    const pool = sequelize.connectionManager?.pool;
    if (!pool) return;
    // Verified against the running sequelize v6 Pool (phase 11): the live
    // counters are numeric getters (size/available/using/waiting) — NOT
    // arrays and NOT tarn num*() methods, so the previous `.length` reads
    // silently reported 0 for every state.
    dbPoolConnections.labels({ state: "used" }).set(pool.using ?? 0);
    dbPoolConnections.labels({ state: "available" }).set(pool.available ?? 0);
    dbPoolConnections.labels({ state: "waiting" }).set(pool.waiting ?? 0);
    dbPoolConnections.labels({ state: "max" }).set(sequelize.config?.pool?.max ?? 0);
  } catch {
    // pool internals unavailable — leave gauges at last known values
  }
};

export const updateCacheMetrics = async () => {
  try {
    if (!redisClient.isOpen) return;
    const info = await redisClient.info("stats");
    const stats = {};
    for (const line of info.split("\n")) {
      const [key, value] = line.split(":");
      if (key && value) stats[key.trim()] = value.trim();
    }
    const hits = Number(stats.keyspace_hits) || 0;
    const misses = Number(stats.keyspace_misses) || 0;
    const total = hits + misses;
    if (total > 0) cacheHitRate.set(hits / total);
  } catch {
    // Redis unavailable — gauge keeps last known value
  }
};

export const updateHealthMetrics = async () => {
  let healthy = 0;
  try {
    await sequelize.authenticate();
    healthy = 1;
  } catch {
    healthy = 0;
  }
  systemHealth.labels({ component: "database" }).set(healthy);

  let redisHealthy = 0;
  if (redisClient.isOpen) {
    try {
      await redisClient.ping();
      redisHealthy = 1;
    } catch {
      redisHealthy = 0;
    }
  }
  systemHealth.labels({ component: "redis" }).set(redisHealthy);

  // The API process serving this metric is, by definition, up
  systemHealth.labels({ component: "api" }).set(1);
};

let updaterTimer = null;

/**
 * Starts the 30s gauge refresher. Called explicitly from server.js after
 * startup — never at module import — and unref'd so it can never keep the
 * process alive during shutdown.
 */
export const startMetricsUpdater = (intervalMs = 30000) => {
  if (updaterTimer) return;
  updaterTimer = setInterval(() => {
    updatePoolMetrics();
    updateHealthMetrics().catch(() => {});
    updateCacheMetrics().catch(() => {});
  }, intervalMs);
  updaterTimer.unref();
  // First refresh immediately so dashboards are not empty for 30s
  updatePoolMetrics();
  updateHealthMetrics().catch(() => {});
  updateCacheMetrics().catch(() => {});
};

// ---------------------------------------------------------------------------
// Request middleware + endpoint
// ---------------------------------------------------------------------------

const EXCLUDED = new Set(["/metrics", "/api/health", "/health", "/ready"]);

/**
 * Route label: matched route pattern (baseUrl + route path), else "unmatched"
 * (404s, unmatched methods). NEVER raw request paths — cardinality safety.
 */
const routeLabel = (req) => {
  if (req.route?.path) {
    return `${req.baseUrl || ""}${req.route.path === "/" ? "" : req.route.path}` || "/";
  }
  return "unmatched";
};

export const metricsMiddleware = () => {
  return (req, res, next) => {
    if (EXCLUDED.has(req.path)) return next();

    const startNs = process.hrtime.bigint();

    res.on("finish", () => {
      const route = routeLabel(req);
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      const seconds = Number(process.hrtime.bigint() - startNs) / 1e9;

      httpRequestDuration.labels(labels).observe(seconds);
      httpRequestCount.labels(labels).inc();
      if (res.statusCode >= 400) {
        httpErrors.labels(labels).inc();
      }
    });

    next();
  };
};

export const metricsEndpoint = async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    req.log?.error({ err: error }, "Metrics endpoint error");
    res.status(500).end("Error generating metrics");
  }
};

export default {
  register,
  metricsMiddleware,
  metricsEndpoint,
  startMetricsUpdater,
  crimesReported,
  crimesVerified,
  redisOperations,
};
