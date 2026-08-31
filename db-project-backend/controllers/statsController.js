

import { Op, fn, col, literal, QueryTypes } from "sequelize";
import db from "../models/index.js";

export const getStatsSummary = async (req, res) => {
  try {
    const { Crime, CrimeType, Zone } = db;

    // Total zones
    const totalZones = await Zone.count();

    // Total approved crimes in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalCrimes = await Crime.count({
      where: {
        status: "approved",
        reportedAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    // Top crime type / zone via single GROUP BY joins instead of per-row
    // correlated subqueries (worst endpoint in Phase 0 baseline).
    // crimeCount stays a pg COUNT (string) to match the previous response shape.
    const topCrimeTypeRows = await db.sequelize.query(
      `
      SELECT ct.id, ct.name, COUNT(c.id) AS "crimeCount"
      FROM "CrimeType" ct
      LEFT JOIN "Crime" c
        ON c."crimeTypeId" = ct.id AND c.status = 'approved'
      GROUP BY ct.id, ct.name
      ORDER BY "crimeCount" DESC
      LIMIT 1;
      `,
      { type: QueryTypes.SELECT }
    );

    const topZoneRows = await db.sequelize.query(
      `
      SELECT z.id, z.name, COUNT(c.id) AS "crimeCount"
      FROM "Zone" z
      LEFT JOIN "Crime" c
        ON c."zoneId" = z.id AND c.status = 'approved'
      GROUP BY z.id, z.name
      ORDER BY "crimeCount" DESC
      LIMIT 1;
      `,
      { type: QueryTypes.SELECT }
    );

    const topCrimeType = topCrimeTypeRows[0] || null;
    const topZone = topZoneRows[0] || null;

    res.json({
      totalZones,
      totalCrimes,
      topCrimeType,
      topZone
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load summary" });
  }
};


// -----------------------------
// 📌 PIE CHART — Crimes by Type
// -----------------------------

export const getCrimesByType = async (req, res) => {
  try {
    const { start, end } = req.query;

    let whereClause = `WHERE c.status = 'approved'`;
    const replacements = {};

    if (start && end) {
      whereClause += ` AND c."reportedAt" BETWEEN :start AND :end`;
      replacements.start = start;
      replacements.end = end;
    }

    const query = `
      SELECT
        c."crimeTypeId",
        ct.name AS "crimeTypeName",
        COUNT(c.id) AS count
      FROM "Crime" c
      JOIN "CrimeType" ct 
        ON ct.id = c."crimeTypeId"
      ${whereClause}
      GROUP BY c."crimeTypeId", ct.id;
    `;

    const rawRows = await db.sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // 🔥 Convert raw SQL into the SAME structure as before
    const rows = rawRows.map(row => ({
      crimeTypeId: row.crimeTypeId,
      count: row.count,
      CrimeType: {
        name: row.crimeTypeName
      }
    }));

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Pie chart failed" });
  }
};


// -----------------------------
// 📌 BAR CHART — Crimes by Zone
// -----------------------------
export const getCrimesByZone = async (req, res) => {
  try {
    const { start, end } = req.query;

    let whereClause = `WHERE c.status = 'approved'`;
    const replacements = {};

    if (start && end) {
      whereClause += ` AND c."reportedAt" BETWEEN :start AND :end`;
      replacements.start = start;
      replacements.end = end;
    }

    const query = `
      SELECT
        c."zoneId",
        z.name AS "zoneName",
        COUNT(c.id) AS count
      FROM "Crime" c
      JOIN "Zone" z
        ON z.id = c."zoneId"
      ${whereClause}
      GROUP BY c."zoneId", z.id;
    `;

    const rawRows = await db.sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements
    });

    // 🔥 Reshape output to match old Sequelize ORM format
    const rows = rawRows.map(row => ({
      zoneId: row.zoneId,
      count: row.count,
      Zone: {
        name: row.zoneName
      }
    }));

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bar chart failed" });
  }
};

// -----------------------------
// 📌 LINE CHART — Monthly Trend
// -----------------------------
export const getCrimeTrend = async (req, res) => {
  try {
    const { crimeTypeId, start, end } = req.query;

    // -------------------
    // Build dynamic WHERE
    // -------------------
    let whereClause = `WHERE c.status = 'approved'`;
    const replacements = {};

    //const { Crime } = db;``
    /*const whereClause = {
      status: "approved"
    };*/

    // crimeTypeId filter
    if (crimeTypeId && !isNaN(Number(crimeTypeId))) {
      whereClause += ` AND c."crimeTypeId" = :crimeTypeId`;
      replacements.crimeTypeId = Number(crimeTypeId);
    }

    // date filter
    if (start && end) {
      whereClause += ` AND c."reportedAt" BETWEEN :start AND :end`;
      replacements.start = start;
      replacements.end = end;
    }

    // -------------------
    // Raw SQL Query
    // -------------------
    const query = `
      SELECT
        DATE_TRUNC('month', c."reportedAt") AS "month",   -- 🔥 use quotes to preserve exact key name
        COUNT(c.id) AS count
      FROM "Crime" c
      ${whereClause}
      GROUP BY DATE_TRUNC('month', c."reportedAt")
      ORDER BY DATE_TRUNC('month', c."reportedAt") ASC;
    `;

    const rows = await db.sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements
    });

    // No reshaping required since output matches original format
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Line chart failed" });
  }
};
