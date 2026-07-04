// backend/controllers/zoneController.js
import db from "../models/index.js";
import { QueryTypes } from "sequelize";

export const getZoneSeverity = async (req, res) => {
  try {
    const { crimeType, zoneId, startDate, endDate } = req.query;
    const conditions = [`"Crime"."status" = 'approved'`];
    const replacements = {};

    if (crimeType && crimeType !== "All") {
      conditions.push(`"CrimeType".name = :crimeType`);
      replacements.crimeType = crimeType;
    }

    if (zoneId && zoneId !== "All") {
      conditions.push(`"Zone".id = :zoneId`);
      replacements.zoneId = zoneId;
    }

    if (startDate) {
      conditions.push(`"Crime"."incidentDate" >= :startDate`);
      replacements.startDate = new Date(startDate).toISOString();
    }

    if (endDate) {
      conditions.push(`"Crime"."incidentDate" <= :endDate`);
      replacements.endDate = new Date(endDate).toISOString();
    }

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
      WHERE ${conditions.join(" AND ")}
      GROUP BY "Zone".id
      ORDER BY "Zone".id ASC;
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    res.json(
      zones.map((z) => {
        const coords = z.boundary?.coordinates?.[0] || [];

        return {
          zoneId: z.id,
          zoneName: z.name,
          totalSeverity: Number(z.totalSeverity),
          cordinates: coords.map(([lng, lat]) => [lat, lng]),
        };
      })
    );
  } catch (err) {
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
        name,
        ST_AsGeoJSON(boundary)::json AS boundary
      FROM "Zone"
      ORDER BY id ASC;
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.json(zones);
  } catch (err) {
    console.error("Error fetching zones:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkLocationInsideZone = async (req, res) => {
  try {
    const { id } = req.params;
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.json({
        success: true,
        inside: false,
        message: "Please provide a valid location.",
      });
    }

    const rows = await db.sequelize.query(
      `
      SELECT ST_Covers(
        boundary,
        ST_SetSRID(ST_Point(:longitude, :latitude), 4326)
      ) AS inside
      FROM "Zone"
      WHERE id = :id
      LIMIT 1;
      `,
      {
        replacements: { id, latitude, longitude },
        type: QueryTypes.SELECT,
      }
    );

    if (!rows[0]) {
      return res.json({
        success: true,
        inside: false,
        message: "Selected zone was not found.",
      });
    }

    res.json({ success: true, inside: Boolean(rows[0].inside) });
  } catch (err) {
    console.error("Error checking zone location:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
