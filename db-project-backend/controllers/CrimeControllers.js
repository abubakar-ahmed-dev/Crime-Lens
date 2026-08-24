// controllers/crimeController.js
import { Op, fn, col, literal, QueryTypes, } from "sequelize";
import sequelize from "../config/db.js";
import db from "../models/index.js";
const { Crime, CrimeSubmission, CrimeReportsSubmitter, CrimeType, Zone, CrimeMedia } = db;

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

const validateLocationInsideZone = async (zoneId, latitude, longitude, transaction) => {
  if (zoneId === undefined || zoneId === null || zoneId === "") {
    return { valid: false, message: "Zone is required" };
  }

  const zoneRows = await sequelize.query(
    `
    SELECT id
    FROM "Zone"
    WHERE id = :zoneId
      AND ST_Covers(
        boundary,
        ST_SetSRID(ST_Point(:longitude, :latitude), 4326)
      )
    LIMIT 1;
    `,
    {
      replacements: { zoneId, latitude, longitude },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  if (!zoneRows[0]) {
    return {
      valid: false,
      message:
        "Location must be inside the selected zone boundary. If you change the zone, select a location inside that zone before saving.",
    };
  }

  return { valid: true };
};

// ===================================================
// 🌍 GET CRIMES FOR MAP (GeoJSON)
// ===================================================
export const getCrimesForMap = async (req, res) => {
  try {
    const { mode, crimeType, zoneId, startDate, endDate, lat, lng, radius } = req.query;

    // Determine user role for visibility filtering
    const userRole = req.user?.role || 'citizen'; // Default to citizen if no user

    // Base SQL (JOINs first) - Now includes thumbnailUrl and mediaCount
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
        c."thumbnailUrl",
        c."mediaCount",
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

    // Fetch media for each crime and format output
    const crimesWithMedia = await Promise.all(
      crimes.map(async (c) => {
        if (!c.geom) return null;

        const loc = typeof c.geom === "string" ? JSON.parse(c.geom) : c.geom;

        // Fetch media for this crime
        let media = [];
        if (c.mediaCount > 0) {
          const mediaQuery = userRole === 'citizen'
            ? `SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                      "visibility", "evidenceMarked", "originalName", "fileSize"
               FROM "CrimeMedia"
               WHERE "CrimeId" = :crimeId AND "visibility" = 'public'
               ORDER BY id ASC;`
            : `SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                      "visibility", "evidenceMarked", "originalName", "fileSize"
               FROM "CrimeMedia"
               WHERE "CrimeId" = :crimeId
               ORDER BY id ASC;`;

          const mediaRows = await db.sequelize.query(mediaQuery, {
            replacements: { crimeId: c.id },
            type: db.sequelize.QueryTypes.SELECT,
          });
          media = mediaRows;
        }

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
          thumbnailUrl: c.thumbnailUrl,
          mediaCount: c.mediaCount || 0,
          media: media, // Include media array for popup display
        };
      })
    );

    const formatted = crimesWithMedia.filter(Boolean);
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
             c."thumbnailUrl",
             c."mediaCount",
             json_build_object('id', ct.id, 'name', ct.name) AS "CrimeType",
             c."zoneId",
             json_build_object('id', z.id, 'name', z.name) AS "Zone",
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

    // Fetch media for each pending crime
    const crimesWithMedia = await Promise.all(
      pendingCrimes.map(async (crime) => {
        const mediaRows = await sequelize.query(
          `
          SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                 "visibility", "evidenceMarked", "originalName", "fileSize"
          FROM "CrimeMedia"
          WHERE "CrimeId" = :crimeId
          ORDER BY id ASC;
          `,
          {
            replacements: { crimeId: crime.id },
            type: QueryTypes.SELECT,
          }
        );
        return {
          ...crime,
          media: mediaRows,
        };
      })
    );

    res.status(200).json({ success: true, data: crimesWithMedia });
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
    const {
      address,
      latitude,
      longitude,
      title,
      description,
      zoneId,
      crimeTypeId,
      incidentDate,
      date,
      mediaUpdates,
    } = req.body;

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

    const effectiveZoneId = zoneId || crime.zoneId;
    const effectiveCrimeTypeId = crimeTypeId || crime.crimeTypeId;
    const effectiveIncidentDate = incidentDate || date || crime.incidentDate;
    const zoneValidation = await validateLocationInsideZone(
      effectiveZoneId,
      coordinates.lat,
      coordinates.lng,
      t
    );
    if (!zoneValidation.valid) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: zoneValidation.message,
      });
    }

    const updatedCrimeRows = await sequelize.query(
      `
      UPDATE "Crime"
      SET status = 'approved',
          address = :address,
          title = :title,
          description = :description,
          "crimeTypeId" = :crimeTypeId,
          "incidentDate" = :incidentDate,
          "zoneId" = :zoneId,
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
          crimeTypeId: effectiveCrimeTypeId,
          incidentDate: effectiveIncidentDate,
          zoneId: effectiveZoneId,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          latestUpdatedBy: req.user.id,
          crimeId: crime.id,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // Handle media updates if provided (visibility changes, caption updates, etc.)
    if (mediaUpdates && Array.isArray(mediaUpdates)) {
      for (const mediaUpdate of mediaUpdates) {
        const { mediaId, visibility, caption, evidenceMarked } = mediaUpdate;
        if (mediaId && (visibility !== undefined || caption !== undefined || evidenceMarked !== undefined)) {
          await sequelize.query(
            `
            UPDATE "CrimeMedia"
            SET "visibility" = COALESCE(:visibility, "visibility"),
                "caption" = COALESCE(:caption, "caption"),
                "evidenceMarked" = COALESCE(:evidenceMarked, "evidenceMarked")
            WHERE id = :mediaId AND "CrimeId" = :crimeId;
            `,
            {
              replacements: {
                mediaId,
                crimeId: crime.id,
                visibility: visibility || null,
                caption: caption !== undefined ? caption : null,
                evidenceMarked: evidenceMarked !== undefined ? evidenceMarked : null,
              },
              type: QueryTypes.UPDATE,
              transaction: t,
            }
          );
        }
      }
    }

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
    if (t && !t.finished) await t.rollback();
    console.error("Approve Crime Error:", error);
    res.status(500).json({
      success: false,
      message: "Error approving crime report",
    });
  }
};

export const rejectCrimeReport = async (req, res) => {
  let t;
  try {
    const { submissionId } = req.params;

    
    t = await sequelize.transaction();

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

    if (crime.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Crime report already processed",
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
    if (t && !t.finished) await t.rollback();
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
      mediaData,
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

    // Handle media data if provided (from media controller integration)
    let createdMedia = [];
    if (mediaData && Array.isArray(mediaData) && mediaData.length > 0) {
      for (const media of mediaData) {
        const {
          publicId,
          originalName,
          mimeType,
          fileSize,
          fileType,
          url,
          thumbnailUrl,
          width,
          height,
          duration,
          caption,
        } = media;

        const newMediaRows = await sequelize.query(
          `
          INSERT INTO "CrimeMedia"
            ("CrimeId", "publicId", "originalName", "mimeType", "fileSize", "fileType", "url", "thumbnailUrl", width, height, duration, "uploadedBy", "visibility", "caption")
          VALUES
            (:crimeId, :publicId, :originalName, :mimeType, :fileSize, :fileType, :url, :thumbnailUrl, :width, :height, :duration, :uploadedBy, 'public', :caption)
          RETURNING *;
          `,
          {
            replacements: {
              crimeId: newCrime.id,
              publicId,
              originalName,
              mimeType,
              fileSize,
              fileType,
              url,
              thumbnailUrl,
              width,
              height,
              duration,
              uploadedBy: 'citizen',
              caption: caption || null,
            },
            type: QueryTypes.INSERT,
            transaction: t,
          }
        );
        createdMedia.push(newMediaRows[0][0]);
      }

      // Update Crime mediaCount and thumbnailUrl
      if (createdMedia.length > 0) {
        await sequelize.query(
          `
          UPDATE "Crime"
          SET "mediaCount" = :count,
              "thumbnailUrl" = :thumbnailUrl
          WHERE id = :crimeId;
          `,
          {
            replacements: {
              crimeId: newCrime.id,
              count: createdMedia.length,
              thumbnailUrl: createdMedia[0].thumbnailUrl,
            },
            type: QueryTypes.UPDATE,
            transaction: t,
          }
        );
      }
    }

    await t.commit();
    // ---------------------------
    // Response
    // ---------------------------
    res.status(201).json({
      success: true,
      message: "Crime report submitted successfully",
      data: {
        crime: { ...newCrime, mediaCount: createdMedia.length, thumbnailUrl: createdMedia.length > 0 ? createdMedia[0].thumbnailUrl : null },
        submission: newCrimeSubmission,
        media: createdMedia,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Report Crime Error:", error);
    res.status(500).json({ success: false, message: "Error adding crime" });
  }
};


export const getAllCrimes = async (req, res) => {
  try {
    // Base query with media fields added
    const crimes = await sequelize.query(
      `
      SELECT c.id AS id,
             c.title AS title,
             c.description AS description,
             c.address AS address,
             c."thumbnailUrl" AS "thumbnailUrl",
             c."mediaCount" AS "mediaCount",
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

    // Fetch full media details for each crime (police/admin see all media)
    const crimesWithMedia = await Promise.all(
      crimes.map(async (crime) => {
        const mediaRows = await sequelize.query(
          `
          SELECT id, "fileType", "url", "thumbnailUrl", "caption",
                 "visibility", "evidenceMarked", "originalName", "fileSize",
                 "uploadedBy", "uploadedAt"
          FROM "CrimeMedia"
          WHERE "CrimeId" = :crimeId
          ORDER BY id ASC;
          `,
          {
            replacements: { crimeId: crime.id },
            type: QueryTypes.SELECT,
          }
        );
        return {
          ...crime,
          media: mediaRows,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: crimesWithMedia
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
  let t;
  try {
    const { id } = req.params;
    const {
      title,
      description,
      address,
      zoneId,
      latitude,
      longitude,
      crimeTypeId,
      incidentDate,
      date,
      mediaOperations,
    } = req.body;

    t = await sequelize.transaction();

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

    const zoneValidation = await validateLocationInsideZone(
      zoneId,
      coordinates.lat,
      coordinates.lng
    );
    if (!zoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: zoneValidation.message,
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
          "crimeTypeId" = :crimeTypeId,
          "incidentDate" = :incidentDate,
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
          crimeTypeId: crimeTypeId || crime.crimeTypeId,
          incidentDate: incidentDate || date || crime.incidentDate,
          address,
          zoneId: zoneId || null,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          latestUpdatedBy: req.user.id,
          id,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // Handle media operations if provided
    if (mediaOperations) {
      const { toUpdate, toRemove } = mediaOperations;

      // Update media metadata (visibility, caption, evidenceMarked)
      if (toUpdate && Array.isArray(toUpdate)) {
        for (const mediaUpdate of toUpdate) {
          const { mediaId, visibility, caption, evidenceMarked } = mediaUpdate;
          if (mediaId && (visibility !== undefined || caption !== undefined || evidenceMarked !== undefined)) {
            await sequelize.query(
              `
              UPDATE "CrimeMedia"
              SET "visibility" = COALESCE(:visibility, "visibility"),
                  "caption" = COALESCE(:caption, "caption"),
                  "evidenceMarked" = COALESCE(:evidenceMarked, "evidenceMarked")
              WHERE id = :mediaId AND "CrimeId" = :crimeId;
              `,
              {
                replacements: {
                  mediaId,
                  crimeId: id,
                  visibility: visibility || null,
                  caption: caption !== undefined ? caption : null,
                  evidenceMarked: evidenceMarked !== undefined ? evidenceMarked : null,
                },
                type: QueryTypes.UPDATE,
                transaction: t,
              }
            );
          }
        }
      }

      // Remove media
      if (toRemove && Array.isArray(toRemove)) {
        for (const mediaId of toRemove) {
          // Get media details for Cloudinary cleanup
          const mediaRows = await sequelize.query(
            `
            SELECT "publicId", "fileType"
            FROM "CrimeMedia"
            WHERE id = :mediaId AND "CrimeId" = :crimeId
            LIMIT 1;
            `,
            {
              replacements: { mediaId, crimeId: id },
              type: QueryTypes.SELECT,
              transaction: t,
            }
          );

          if (mediaRows[0]) {
            const media = mediaRows[0];

            // Delete from database
            await sequelize.query(
              `
              DELETE FROM "CrimeMedia"
              WHERE id = :mediaId;
              `,
              {
                replacements: { mediaId },
                type: QueryTypes.DELETE,
                transaction: t,
              }
            );

            // Update Crime mediaCount (will trigger cascade update via database)
            await sequelize.query(
              `
              UPDATE "Crime"
              SET "mediaCount" = "mediaCount" - 1,
                  "thumbnailUrl" = CASE
                    WHEN "mediaCount" <= 1 THEN NULL
                    ELSE (
                      SELECT "thumbnailUrl"
                      FROM "CrimeMedia"
                      WHERE "CrimeId" = :crimeId
                      ORDER BY id ASC
                      LIMIT 1
                    )
                  END
              WHERE id = :crimeId;
              `,
              {
                replacements: { crimeId: id },
                type: QueryTypes.UPDATE,
                transaction: t,
              }
            );

            // Note: Cloudinary deletion would happen here via mediaController
            // For now, we'll rely on the dedicated media delete endpoint
          }
        }
      }

      // Re-calculate and update mediaCount and thumbnailUrl
      const mediaStats = await sequelize.query(
        `
        SELECT COUNT(*) as count,
               (SELECT "thumbnailUrl" FROM "CrimeMedia" WHERE "CrimeId" = :crimeId ORDER BY id ASC LIMIT 1) as firstThumbnail
        FROM "CrimeMedia"
        WHERE "CrimeId" = :crimeId;
        `,
        {
          replacements: { crimeId: id },
          type: QueryTypes.SELECT,
          transaction: t,
        }
      );

      if (mediaStats[0]) {
        await sequelize.query(
          `
          UPDATE "Crime"
          SET "mediaCount" = :count,
              "thumbnailUrl" = :thumbnailUrl
          WHERE id = :crimeId;
          `,
          {
            replacements: {
              crimeId: id,
              count: parseInt(mediaStats[0].count),
              thumbnailUrl: mediaStats[0].firstthumbnail,
            },
            type: QueryTypes.UPDATE,
            transaction: t,
          }
        );
      }
    }

    await t.commit();

    // ---------------------------
    // 4️⃣ Response
    // ---------------------------
    res.json({ success: true, message: "Crime updated successfully" });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    console.error("Error updating crime:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const deleteCrime = async (req, res) => {
  let t;
  try {
    const { id } = req.params;

    t = await sequelize.transaction();

    // Note: CrimeMedia has ON DELETE CASCADE, so when Crime is soft-deleted,
    // we need to explicitly handle media cleanup to avoid orphaned Cloudinary files
    // Get all media for this crime before deletion
    const mediaRows = await sequelize.query(
      `
      SELECT id, "publicId", "fileType"
      FROM "CrimeMedia"
      WHERE "CrimeId" = :crimeId;
      `,
      {
        replacements: { crimeId: id },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    // Delete all CrimeMedia records explicitly (for Cloudinary cleanup)
    if (mediaRows.length > 0) {
      await sequelize.query(
        `
        DELETE FROM "CrimeMedia"
        WHERE "CrimeId" = :crimeId;
        `,
        {
          replacements: { crimeId: id },
          type: QueryTypes.DELETE,
          transaction: t,
        }
      );

      // Note: Cloudinary file deletion should be handled via a background job
      // or the dedicated media delete endpoint for each media item
      // The publicIds are available in mediaRows for cleanup
    }

    const updatedRows = await sequelize.query(
      `
      UPDATE "Crime"
      SET status = 'deleted',
          "mediaCount" = 0,
          "thumbnailUrl" = NULL
      WHERE id = :id
        AND status <> 'deleted'
      RETURNING id, status;
      `,
      {
        replacements: { id },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    const updatedCrime = updatedRows[0][0];
    if (!updatedCrime) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Crime not found" });
    }

    await t.commit();

    res.status(200).json({
      success: true,
      message: "Crime deleted successfully",
      data: updatedCrime,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Delete Crime Error:", error);
    res.status(500).json({ success: false, message: "Error deleting crime" });
  }
};
