/**
 * Database connection-pool analysis for horizontal scaling (Phase 11).
 *
 * Run from the repo root:
 *   node scripts/analyze-db-pool.js [instanceCount]
 *
 * Uses the backend's own Sequelize config. Note: the pool object does not
 * expose `pool.max`/`pool.active` — the cap lives at
 * `sequelize.config.pool.max`, and live counters are the numeric getters
 * size/available/using/waiting (verified against the running sequelize v6
 * legacy Pool; tarn-style num*() methods do not exist here).
 */

import { fileURLToPath } from "url";

// Load the backend's .env (models/index.js reads it via dotenv from cwd)
process.chdir(fileURLToPath(new URL("../db-project-backend", import.meta.url)));

const instances = parseInt(process.argv[2] || "1", 10);
if (!Number.isInteger(instances) || instances < 1 || instances > 10) {
  console.error("Usage: node scripts/analyze-db-pool.js [instanceCount 1-10]");
  process.exit(1);
}

const { default: db } = await import("../db-project-backend/models/index.js");
const sequelize = db.sequelize;

const config = sequelize.config?.pool || {};
const poolMax = parseInt(config.max, 10) || 10;

console.log("=== Database connection-pool analysis ===\n");
console.log("Per-instance pool (sequelize.config.pool):");
console.log(`  max: ${poolMax}`);
console.log(`  min: ${config.min ?? "(default 0)"}`);

try {
  // Measure the real capacity of the database this deployment talks to.
  // (QueryTypes.SELECT normalizes the return to a plain rows array —
  // sequelize's default shape differs between SELECT and utility
  // statements.)
  const capacityRows = await sequelize.query("SHOW max_connections;", {
    type: sequelize.QueryTypes?.SELECT ?? 0,
  });
  const maxConnections = parseInt(capacityRows[0].max_connections, 10);

  // Currently established connections (all sources, at this moment).
  const usedRows = await sequelize.query(
    "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database();",
    { type: sequelize.QueryTypes?.SELECT ?? 0 }
  );
  const currentConnections = usedRows[0].count;

  // Live view of THIS process's pool. Empirically (sequelize v6 legacy Pool):
  // size/available/using/waiting are numeric getters; tarn-style num*()
  // methods do not exist.
  const pool = sequelize.connectionManager.pool;
  const live = pool
    ? {
        total: pool.size,
        used: pool.using,
        free: pool.available,
        pending: pool.waiting,
      }
    : null;

  console.log("\nDatabase (measured live):");
  console.log(`  max_connections: ${maxConnections}`);
  console.log(`  currently established (all clients): ${currentConnections}`);
  if (live) {
    console.log(
      `  this process pool: total=${live.total} used=${live.used} free=${live.free} pending=${live.pending}`
    );
  }

  const required = instances * poolMax;
  const headroom = maxConnections - currentConnections;

  console.log("\nHorizontal-scaling budget:");
  console.log(`  API instances: ${instances}`);
  console.log(`  worst-case total: ${instances} x ${poolMax} = ${required}`);
  console.log(`  headroom now: ${headroom} of ${maxConnections}`);

  if (required > headroom) {
    const suggested = Math.max(1, Math.floor(headroom / instances));
    console.log("\n  WARNING: worst-case pool budget exceeds current headroom.");
    console.log(`  Suggestion: DB_POOL_MAX=${suggested} per instance for ${instances} instance(s),`);
    console.log("  or use Supabase pooler mode / raise the database limit.");
  } else {
    const utilization = ((required / maxConnections) * 100).toFixed(1);
    console.log(`  OK: worst-case budget is ${utilization}% of max_connections.`);
  }

  await sequelize.close();
} catch (error) {
  console.error("\nAnalysis failed:", error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
}
