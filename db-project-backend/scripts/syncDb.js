import db from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

const { sequelize } = db;

const syncDatabase = async (force = false) => {
  try {
    console.log("🔄 Syncing database with Sequelize...");

    await sequelize.sync({
      force, // Drop existing tables if true
      alter: false // Don't alter existing tables
    });

    console.log("✅ Database sync completed!");
    console.log("\n📊 Tables created:");
    const tables = await sequelize.getQueryInterface().showAllTables();
    tables.forEach(table => console.log(`  - ${table}`));

    process.exit(0);
  } catch (error) {
    console.error("❌ Error syncing database:", error.message);
    process.exit(1);
  }
};

// Check command line args
const args = process.argv.slice(2);
const forceReset = args.includes("--force") || args.includes("-f");

console.log(forceReset ? "⚠️  FORCE MODE: All existing tables will be dropped!" : "📋 Safe mode: Existing tables will be kept");

syncDatabase(forceReset);
