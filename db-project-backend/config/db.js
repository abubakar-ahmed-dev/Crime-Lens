import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Connection pool is env-driven. Defaults apply to ANY environment (including
// when NODE_ENV is unset, e.g. local `npm start`): max 10 / min 0.
// Phase 0 baseline identified pool max 5 as the global throughput ceiling.
// Override per environment with DB_POOL_MAX / DB_POOL_MIN (see .env-sample).
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  min: parseInt(process.env.DB_POOL_MIN || "0", 10),
  acquire: 30000,
  idle: 10000,
  evict: 5000,
};

const isDevelopment = process.env.NODE_ENV === "development";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  benchmark: isDevelopment,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  pool: poolConfig,
});

export default sequelize;
