// backend/controllers/zoneController.js
import db from "../models/index.js";
import { Op , QueryTypes } from "sequelize";

export const getZoneSeverity = async (req, res) => {
  try {
    const { crimeType, zoneId, startDate, endDate } = req.query;

    const crimeWhere = {};

    if (crimeType && crimeType !== "All") {
      crimeWhere["$CrimeType.name$"] = crimeType;
    }

    if (zoneId && zoneId !== "All") {
      crimeWhere.zoneId = zoneId;
    }

    if (startDate || endDate) {
      crimeWhere.incidentDate = {};
      if (startDate) crimeWhere.incidentDate[Op.gte] = new Date(startDate);
      if (endDate) crimeWhere.incidentDate[Op.lte] = new Date(endDate);
    }

    // Build Filters
    const filterCrimeType =
      crimeType && crimeType !== "All"
        ? `AND "CrimeType".name = '${crimeType}'`
        : "";

    const filterZone =
      zoneId && zoneId !== "All"
        ? `AND "Zone".id = ${zoneId}`
        : "";

    const filterStart = startDate
      ? `AND "Crime"."incidentDate" >= '${startDate}'`
      : "";

    const filterEnd = endDate
      ? `AND "Crime"."incidentDate" <= '${endDate}'`
      : "";

    // ▼ THE IMPORTANT NEW FILTER: approved crimes only ▼
    const filterApproved = `AND "Crime"."status" = 'approved'`;

    // SQL Query
    const zones = await db.sequelize.query(
      `
      SELECT 
        "Zone".id,
        "Zone".name,
        ST_AsGeoJSON("Zone".boundary)::json AS boundary,
        COALESCE(SUM("CrimeType".severity), 0) AS "totalSeverity"
      FROM "Zone"
      LEFT JOIN "Crime" 
        ON "Crime"."zoneId" = "Zone".id
      LEFT JOIN "CrimeType" 
        ON "CrimeType".id = "Crime"."crimeTypeId"
      WHERE 1=1
        ${filterApproved}
        ${filterCrimeType}
        ${filterZone}
        ${filterStart}
        ${filterEnd}
      GROUP BY "Zone".id
      ORDER BY "Zone".id ASC;
    `,
      { type: db.sequelize.QueryTypes.SELECT }
    );
    res.json(
      zones.map((z) => {
        const coords = z.boundary?.coordinates?.[0] || []; // GeoJSON polygon outer ring

        return {
          zoneId: z.id,
          zoneName: z.name,
          totalSeverity: Number(z.totalSeverity),

          // Convert GeoJSON -> Leaflet
          cordinates: coords.map(([lng, lat]) => [lat, lng])
        };
      })
    );
  } catch (err) {
    console.log("\n zoneController catch error ");
    console.error("Error fetching zone severity:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};



export const getAllZones = async (req, res) => {
  try {
    const zones = await db.sequelize.query(
      `
      SELECT 
        id,
        name
      FROM "Zone"
      ORDER BY id ASC;
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    // zones is already an array of objects like: [{ id: 1, name: "Zone A" }, ...]
    res.json(zones);
  } catch (err) {
    console.error("Error fetching zones:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
