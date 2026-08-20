import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./models/index.js";
import { validateEnv } from "./config/envValidation.js";

import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import zonesRoutes from "./routes/zoneRoutes.js";
import crimeRoutes from "./routes/crimeRoutes.js";
import citizenAuthRoutes from "./routes/citizenAuthRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";

dotenv.config();

// Validate environment variables before starting the server
validateEnv();

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/crimes", crimeRoutes);
app.use("/api/citizens", citizenAuthRoutes);
app.use("/api/media", mediaRoutes);

const { sequelize } = db;
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established with Supabase.");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error.message);
    process.exit(1);
  }
};

startServer();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
  process.exit(1);
});
