

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

    // Top Crime Type (approved only)
    const topCrimeType = await CrimeType.findOne({
      attributes: [
        "id",
        "name",
        [
          literal(`
            (
              SELECT COUNT(*) 
              FROM "Crime" AS c 
              WHERE c."crimeTypeId" = "CrimeType"."id"
              AND c."status" = 'approved'
            )
          `),
          "crimeCount"
        ]
      ],
      order: [
        [
          literal(`
            (
              SELECT COUNT(*) 
              FROM "Crime" AS c 
              WHERE c."crimeTypeId" = "CrimeType"."id"
              AND c."status" = 'approved'
            )
          `),
          "DESC"
        ]
      ],
      limit: 1
    });

    // Top Zone (approved only)
    const topZone = await Zone.findOne({
      attributes: [
        "id",
        "name",
        [
          literal(`
            (
              SELECT COUNT(*) 
              FROM "Crime" AS c 
              WHERE c."zoneId" = "Zone"."id"
              AND c."status" = 'approved'
            )
          `),
          "crimeCount"
        ]
      ],
      order: [
        [
          literal(`
            (
              SELECT COUNT(*) 
              FROM "Crime" AS c 
              WHERE c."zoneId" = "Zone"."id"
              AND c."status" = 'approved'
            )
          `),
          "DESC"
        ]
      ],
      limit: 1
    });

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
