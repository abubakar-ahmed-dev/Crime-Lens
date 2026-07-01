// controllers/crimeController.js
import { Op, fn, col, literal, QueryTypes, } from "sequelize";
import sequelize from "../config/db.js";
import db from "../models/index.js";
const { Crime, CrimeSubmission, CrimeReportsSubmitter, CrimeType, Zone } = db;

const parseRequiredCoordinates = (latitude, longitude) => {
  if (latitude === undefined || latitude === null || latitude === "" || longitude === undefined || longitude === null || longitude === "") {
    return { valid: false, message: "Latitude and longitude are required" };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, message: "Latitude and longitude must be valid numbers" };
  }

  if (lat < 23 || lat > 26 || lng < 65 || lng > 68) {
    return { valid: false, message: "Latitude must be between 23 and 26 and longitude must be between 65 and 68" };
  }

  return { valid: true, lat, lng };
};

// ===================================================
// 🌍 GET CRIMES FOR MAP (GeoJSON)
// ===================================================
export const getCrimesForMap = async (req, res) => {
  try {
    const { mode, crimeType, zoneId, startDate, endDate, lat, lng, radius } = req.query;

    // Base SQL (JOINs first)
    let sql = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.address,
        c."zoneId",
        z.name AS "zoneName",
        c."crimeTypeId",
        ct.name AS "crimeTypeName",
        c.status,
        c."incidentDate",
        ST_AsGeoJSON(c.location)::json AS geom
      FROM "Crime" c
      JOIN "CrimeType" ct ON c."crimeTypeId" = ct.id
      LEFT JOIN "Zone" z ON c."zoneId" = z.id
      WHERE c.status = 'approved'
    `;

    const conditions = [];
    const replacements = {};

    // Filter: crime type
    if (crimeType && crimeType !== "All") {
      conditions.push(`ct.name ILIKE :crimeType`);
      replacements.crimeType = crimeType;
    }

    // Filter: zone
    if (zoneId && zoneId !== "All") {
      conditions.push(`c."zoneId" = :zoneId`);
      replacements.zoneId = zoneId;
    }

    // Date filters
    if (startDate) {
      conditions.push(`c."incidentDate" >= :startDate`);
      replacements.startDate = new Date(startDate).toISOString();
    }
    if (endDate) {
      conditions.push(`c."incidentDate" <= :endDate`);
      replacements.endDate = new Date(endDate).toISOString();
    }

    // Radius mode
    if (mode === "radius" && lat && lng && radius) {
      conditions.push(`
        ST_DWithin(
          c.location::geography,
          ST_SetSRID(ST_Point(:lng, :lat), 4326),
          :radius
        )
      `);
      replacements.lat = parseFloat(lat);
      replacements.lng = parseFloat(lng);
      replacements.radius = parseFloat(radius);
    }

    // Append additional conditions
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    sql += ";";

    // Execute the query
    const crimes = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements,
    });

    // Format output
    const formatted = crimes
      .map((c) => {
        if (!c.geom) return null;
        const loc = typeof c.geom === "string" ? JSON.parse(c.geom) : c.geom;
        return {
          id: c.id,
          crimeTypeId: c.crimeTypeId,
          crimeTypeName: c.crimeTypeName,
          incidentDate: c.incidentDate,
          status: c.status,
          latitude: loc.coordinates[1],
          longitude: loc.coordinates[0],
          title: c.title,
          description: c.description,
          address: c.address,
          zoneId: c.zoneId,
          zoneName: c.zoneName,
        };
      })
      .filter(Boolean);

    return res.json(formatted);

  } catch (err) {
    console.error("Map Crime Error:", err);
    res.status(500).json([]);
  }
};

export const getAllCrimeTypes = async (req, res) => {
  try {
    const crimeTypes = await sequelize.query(
      `
      SELECT id, name
      FROM "CrimeType"
      ORDER BY name ASC;
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.json(crimeTypes);
  } catch (err) {
    console.error("Error fetching crime types:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getPendingSubmissions = async (req, res) => {
  try {
    const pendingCrimes = await sequelize.query(
      `
      SELECT c.id,
             c.title,
             c.description,
             c.address,
             c."crimeTypeId",
             json_build_object('id', ct.id, 'name', ct.name) AS "CrimeType",
             c."zoneId",
             json_build_object('id', z.id) AS "Zone",
             c.status,
             c."reportedAt",
             c."incidentDate",
             ST_AsGeoJSON(c.location)::json AS location,
             CASE WHEN c.location IS NOT NULL THEN ST_Y(c.location) END AS latitude,
             CASE WHEN c.location IS NOT NULL THEN ST_X(c.location) END AS longitude,
             cs_latest.id AS "submissionId",
             crs."submitterCnic",
             cs_latest."submittedAt",
             crs."fullName",
             crs.contact
      FROM "Crime" c
      LEFT JOIN "CrimeType" ct ON ct.id = c."crimeTypeId"
      LEFT JOIN "Zone" z ON z.id = c."zoneId"
      LEFT JOIN LATERAL (
        SELECT cs.id,
               cs."submitterId",
               cs."submittedAt",
               cs."CrimeId"
        FROM "CrimeSubmission" cs
        WHERE cs."CrimeId" = c.id
        ORDER BY cs."submittedAt" DESC
        LIMIT 1
      ) cs_latest ON true
      LEFT JOIN "CrimeReportsSubmitter" crs ON crs.id = cs_latest."submitterId"
      WHERE c.status = 'pending'
      ORDER BY c."reportedAt" DESC;
      `,
      { type: QueryTypes.SELECT }
    );


    res.status(200).json({ success: true, data: pendingCrimes });
  } catch (error) {
    console.error("Fetch Pending Crimes Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching pending submissions",
    });
  }
};


export const approveCrimeReport = async (req, res) => {
  let t;
  try {
    const { submissionId } = req.params;
    const { address, latitude, longitude, title, description } = req.body;

    // ---------------------------
    // 1️⃣ Fetch CrimeSubmission record
    // ---------------------------

    t = await sequelize.transaction();


    const submissionRows = await sequelize.query(
      `
      SELECT id, "CrimeId"
      FROM "CrimeSubmission"
      WHERE id = :submissionId
      LIMIT 1;
      `,
      {
        replacements: { submissionId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const submission = submissionRows[0];
    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Crime submission not found",
      });
    }

    // ---------------------------
    // 2️⃣ Fetch corresponding Crime record
    // ---------------------------
    const crimeRows = await sequelize.query(
      `
      SELECT *
      FROM "Crime"
      WHERE id = :crimeId
      LIMIT 1;
      `,
      {
        replacements: { crimeId: submission.CrimeId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const crime = crimeRows[0];
    if (!crime) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Associated crime record not found",
      });
    }

    if (crime.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Crime report already processed",
      });
    }

    // ---------------------------
    // 3️⃣ Prepare updated data
    // ---------------------------
    const coordinates = parseRequiredCoordinates(latitude, longitude);
    if (!coordinates.valid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: coordinates.message,
      });
    }

    const updatedCrimeRows = await sequelize.query(
      `
      UPDATE "Crime"
      SET status = 'approved',
          address = :address,
          title = :title,
          description = :description,
          location = ST_SetSRID(ST_Point(:longitude, :latitude), 4326),
          "latestUpdatedBy" = :latestUpdatedBy
      WHERE id = :crimeId
      RETURNING id, status, "latestUpdatedBy";
      `,
      {
        replacements: {
          address: address || crime.address,
          title: title || crime.title,
          description: description || crime.description,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          latestUpdatedBy: req.user.id,
          crimeId: crime.id,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    const updatedCrime = updatedCrimeRows[0][0];
    await t.commit();
    // ---------------------------
    // 4️⃣ Response
    // ---------------------------
    res.status(200).json({
      success: true,
      message: "Crime report approved and verified",
      data: {
        submissionId: submissionId,
        crimeId: updatedCrime.id,
        status: updatedCrime.status,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("Approve Crime Error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving crime report",
    });
  }
};

export const rejectCrimeReport = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body;

    
  const t = await sequelize.transaction();

    // ---------------------------
    // 1️⃣ Fetch CrimeSubmission record
    // ---------------------------
    const submissionRows = await sequelize.query(
      `
      SELECT id, "CrimeId"
      FROM "CrimeSubmission"
      WHERE id = :submissionId
      LIMIT 1;
      `,
      {
        replacements: { submissionId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const submission = submissionRows[0];
    if (!submission) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Crime submission not found",
      });
    }

    // ---------------------------
    // 2️⃣ Fetch corresponding Crime record
    // ---------------------------
    const crimeRows = await sequelize.query(
      `
      SELECT id, status
      FROM "Crime"
      WHERE id = :crimeId
      LIMIT 1;
      `,
      {
        replacements: { crimeId: submission.CrimeId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const crime = crimeRows[0];
    if (!crime) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Associated crime record not found",
      });
    }

    // ---------------------------
    // 3️⃣ Update Crime status to rejected
    // ---------------------------
    const updatedCrimeRows = await sequelize.query(
      `
      UPDATE "Crime"
      SET status = 'rejected'
      WHERE id = :crimeId
      RETURNING id, status;
      `,
      {
        replacements: { crimeId: crime.id },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    const updatedCrime = updatedCrimeRows[0][0];
    await t.commit();
    // ---------------------------
    // 4️⃣ Response
    // ---------------------------
    res.status(200).json({
      success: true,
      message: "Crime report rejected",
      data: { crimeId: updatedCrime.id, status: updatedCrime.status },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("Reject Crime Error:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting crime report",
    });
  }
};



export const reportCrime = async (req, res) => {
  let t;
  try {
    const {
      zone,
      crimeTypeId,
      date,
      address,
      description,
      title,
      latitude,
      longitude,
    } = req.body;

    if (!req.user?.email) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!date || !crimeTypeId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const coordinates = parseRequiredCoordinates(latitude, longitude);
    if (!coordinates.valid) {
      return res.status(400).json({ success: false, message: coordinates.message });
    }

    const submitter = await CrimeReportsSubmitter.findOne({
      where: { email: req.user.email },
    });

    if (!submitter) {
      return res.status(404).json({
        success: false,
        message: "Citizen profile not found",
      });
    }

    if (!submitter.isProfileComplete) {
      return res.status(403).json({
        success: false,
        message: "Please complete your profile before submitting a report",
      });
    }

    const submitterId = submitter.id;

    t = await sequelize.transaction();

    // ---------------------------
    // Insert Crime record
    // ---------------------------
    const newCrimeRows = await sequelize.query(
      `
      INSERT INTO "Crime"
        (title, description, "crimeTypeId", "incidentDate", "reportedAt", status, location, address, "zoneId")
      VALUES
        (:title, :description, :crimeTypeId, :incidentDate, :reportedAt, 'pending', ST_SetSRID(ST_Point(:longitude, :latitude), 4326), :address, :zoneId)
      RETURNING *
      `,
      {
        replacements: {
          title: title || "Untitled Crime",
          description: description || null,
          crimeTypeId,
          incidentDate: date,
          reportedAt: new Date(),
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          address: address || null,
          zoneId: zone || null,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    const newCrime = newCrimeRows[0][0]; // RETURNING * gives array of inserted row(s)

    // ---------------------------
    // Insert CrimeSubmission metadata
    // ---------------------------
    const newCrimeSubmissionRows = await sequelize.query(
      `
      INSERT INTO "CrimeSubmission" ("submitterId", "submittedAt", "CrimeId")
      VALUES (:submitterId, :submittedAt, :crimeId)
      RETURNING *
      `,
      {
        replacements: {
          submitterId,
          submittedAt: new Date(),
          crimeId: newCrime.id,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    const newCrimeSubmission = newCrimeSubmissionRows[0][0];
    await t.commit();
    // ---------------------------
    // Response
    // ---------------------------
    res.status(201).json({
      success: true,
      message: "Crime report submitted successfully",
      data: {
        crime: newCrime,
        submission: newCrimeSubmission,
      },
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("Report Crime Error:", error);
    res.status(500).json({ success: false, message: "Error adding crime" });
  }
};


export const getAllCrimes = async (req, res) => {
  try {
    const crimes = await sequelize.query(
      `
      SELECT c.id AS id,
             z.name AS "zoneName",
             pb.id AS "registeredBranchId",
             crs."submitterCnic" AS "submitterCnic",
             ct.name AS "crimeTypeName",
             c."incidentDate" AS "incidentDate",
             c.status AS status,
             ST_AsGeoJSON(c.location)::json AS location,
             CASE WHEN c.location IS NOT NULL THEN ST_Y(c.location) END AS latitude,
             CASE WHEN c.location IS NOT NULL THEN ST_X(c.location) END AS longitude
      FROM "Crime" c
      LEFT JOIN "Zone" z ON z.id = c."zoneId"
      LEFT JOIN LATERAL (
        SELECT pb_inner.id
        FROM "PoliceBranch" pb_inner
        WHERE pb_inner."zoneId" = c."zoneId"
        ORDER BY pb_inner.id ASC
        LIMIT 1
      ) pb ON true
      LEFT JOIN "CrimeType" ct ON ct.id = c."crimeTypeId"
      LEFT JOIN LATERAL (
        SELECT cs."submitterId"
        FROM "CrimeSubmission" cs
        WHERE cs."CrimeId" = c.id
        ORDER BY cs."submittedAt" DESC
        LIMIT 1
      ) cs_latest ON true
      LEFT JOIN "CrimeReportsSubmitter" crs ON crs.id = cs_latest."submitterId"
      WHERE c.status = 'approved'
      ORDER BY c."incidentDate" DESC, c.id DESC;
      `,
      { type: QueryTypes.SELECT }
    );

    return res.status(200).json({
      success: true,
      data: crimes
    });

  } catch (error) {
    console.error("❌ Error fetching crimes from view:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching crime records"
    });
  }
};



// --------------------------------------------------
// GET SINGLE CRIME BY ID
// --------------------------------------------------
// export const getCrimeById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const crime = await Crime.findOne({
//       where: {
//         id,
//         status: "approved"   // ✅ Only approved crimes
//       },
//       attributes: [
//         "id",
//         "title",
//         "description",
//         "crimeTypeId",
//         "incidentDate",
//         "status",
//         "address",
//         "zoneId",
//         "location"
//       ]
//     });

//     if (!crime) {
//       return res.status(404).json({ success: false, message: "Crime not found" });
//     }

//     res.json({ success: true, data: crime });
//   } catch (err) {
//     console.error("Error fetching crime:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

export const getCrimeById = async (req, res) => {
  try {
    const { id } = req.params;

    const crimeRows = await sequelize.query(
      `
      SELECT id,
             title,
             description,
             "crimeTypeId",
             "incidentDate",
             status,
             address,
             "zoneId",
             ST_AsGeoJSON(location)::json AS location,
             CASE WHEN location IS NOT NULL THEN ST_Y(location) END AS latitude,
             CASE WHEN location IS NOT NULL THEN ST_X(location) END AS longitude
      FROM "Crime"
      WHERE id = :id AND status = 'approved'
      LIMIT 1;
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    const crime = crimeRows[0];
    if (!crime) {
      return res.status(404).json({ success: false, message: "Crime not found" });
    }

    res.json({ success: true, data: crime });
  } catch (err) {
    console.error("Error fetching crime:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const updateCrime = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, address, zoneId, latitude, longitude } = req.body;

    // ---------------------------
    // 1️⃣ Fetch the existing crime
    // ---------------------------
    const crimeRows = await sequelize.query(
      `
      SELECT *
      FROM "Crime"
      WHERE id = :id
      LIMIT 1;
      `,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    const crime = crimeRows[0];
    if (!crime) {
      return res.status(404).json({ success: false, message: "Crime not found" });
    }

    // ---------------------------
    // 2️⃣ Build SQL for location
    // ---------------------------
    const coordinates = parseRequiredCoordinates(latitude, longitude);
    if (!coordinates.valid) {
      return res.status(400).json({
        success: false,
        message: coordinates.message,
      });
    }

    // ---------------------------
    // 3️⃣ Update the crime
    // ---------------------------
    await sequelize.query(
      `
      UPDATE "Crime"
      SET title = :title,
          description = :description,
          address = :address,
          "zoneId" = :zoneId,
          location = ST_SetSRID(ST_Point(:longitude, :latitude), 4326),
          "latestUpdatedBy" = :latestUpdatedBy
      WHERE id = :id;
      `,
      {
        replacements: {
          title,
          description,
          address,
          zoneId: zoneId || null,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          latestUpdatedBy: req.user.id,
          id,
        },
        type: QueryTypes.UPDATE,
      }
    );

    // ---------------------------
    // 4️⃣ Response
    // ---------------------------
    res.json({ success: true, message: "Crime updated successfully" });
  } catch (err) {
    console.error("Error updating crime:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const deleteCrime = async (req, res) => {
  try {
    const { id } = req.params;

    const crime = await Crime.findByPk(id);
    if (!crime) {
      return res.status(404).json({ success: false, message: "Crime not found" });
    }

    await crime.destroy();

    res.status(200).json({ success: true, message: "Crime deleted successfully" });
  } catch (error) {
    console.error("Delete Crime Error:", error);
    res.status(500).json({ success: false, message: "Error deleting crime" });
  }
};
