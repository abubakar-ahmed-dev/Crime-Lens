import { QueryTypes } from "sequelize";
import sequelize from "../../config/db.js";
import bcrypt from "bcryptjs";

const parseRequiredCoordinates = (latitude, longitude) => {
  if (
    latitude === undefined ||
    latitude === null ||
    latitude === "" ||
    longitude === undefined ||
    longitude === null ||
    longitude === ""
  ) {
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

export const getBranches = async (req, res) => {
  try {
    const branches = await sequelize.query(
      `
      SELECT b.id,
             b.name,
             b.address,
             b."contactNumber",
             b."zoneId",
             z.name AS "zoneName",
             b."branchHeadUserId",
             head.username AS "branchHeadUsername",
             ST_AsGeoJSON(b.location)::json AS location,
             CASE WHEN b.location IS NOT NULL THEN ST_Y(b.location) END AS latitude,
             CASE WHEN b.location IS NOT NULL THEN ST_X(b.location) END AS longitude,
             COUNT(DISTINCT ar."userId")::int AS "agentCount"
      FROM "PoliceBranch" b
      JOIN "Zone" z ON z.id = b."zoneId"
      LEFT JOIN "User" head ON head.id = b."branchHeadUserId"
      LEFT JOIN "PoliceAgentRequest" ar
        ON ar."branchId" = b.id
       AND ar.status = 'approved'
       AND ar."userId" IS NOT NULL
      GROUP BY b.id, z.name, head.username
      ORDER BY b.id ASC;
      `,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json({ success: true, data: branches });
  } catch (error) {
    console.error("Get Branches Error:", error);
    res.status(500).json({ success: false, message: "Error fetching branches" });
  }
};

export const getApprovedPoliceAgents = async (req, res) => {
  try {
    const agents = await sequelize.query(
      `
      SELECT u.id AS "userId",
             u.username,
             ar.id AS "agentRequestId",
             ar."branchId",
             b.name AS "branchName",
             b."branchHeadUserId" = u.id AS "isBranchHead"
      FROM "PoliceAgentRequest" ar
      JOIN "User" u ON u.id = ar."userId"
      JOIN "PoliceBranch" b ON b.id = ar."branchId"
      WHERE ar.status = 'approved'
        AND u."roleId" = 2
      ORDER BY b.id ASC, u.username ASC;
      `,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json({ success: true, data: agents });
  } catch (error) {
    console.error("Get Police Agents Error:", error);
    res.status(500).json({ success: false, message: "Error fetching police agents" });
  }
};

export const createBranch = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { name, zoneId, address, contactNumber, latitude, longitude } = req.body;

    if (!name || !zoneId || !address || !contactNumber) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Missing required branch fields" });
    }

    const coordinates = parseRequiredCoordinates(latitude, longitude);
    if (!coordinates.valid) {
      await t.rollback();
      return res.status(400).json({ success: false, message: coordinates.message });
    }

    const zoneRows = await sequelize.query(
      `SELECT id FROM "Zone" WHERE id = :zoneId LIMIT 1;`,
      {
        replacements: { zoneId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (!zoneRows[0]) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Zone not found" });
    }

    const existingBranchRows = await sequelize.query(
      `SELECT id FROM "PoliceBranch" WHERE "zoneId" = :zoneId LIMIT 1;`,
      {
        replacements: { zoneId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (existingBranchRows[0]) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "A branch already exists for this zone" });
    }

    const insertedRows = await sequelize.query(
      `
      INSERT INTO "PoliceBranch"
        ("branchHeadUserId", "zoneId", name, address, "contactNumber", location)
      VALUES
        (NULL, :zoneId, :name, :address, :contactNumber, ST_SetSRID(ST_Point(:longitude, :latitude), 4326))
      RETURNING id, name, address, "contactNumber", "zoneId", "branchHeadUserId",
                ST_AsGeoJSON(location)::json AS location,
                ST_Y(location) AS latitude,
                ST_X(location) AS longitude;
      `,
      {
        replacements: {
          zoneId,
          name: name.trim(),
          address: address.trim(),
          contactNumber: contactNumber.trim(),
          latitude: coordinates.lat,
          longitude: coordinates.lng,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Police branch created successfully",
      data: insertedRows[0][0],
    });
  } catch (error) {
    await t.rollback();
    console.error("Create Branch Error:", error);
    res.status(500).json({ success: false, message: "Error creating branch" });
  }
};

export const createPoliceAgent = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { username, password, branchId } = req.body;

    if (!username || !password || !branchId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Username, password, and branch are required" });
    }

    if (password.length < 6) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const branchRows = await sequelize.query(
      `SELECT id FROM "PoliceBranch" WHERE id = :branchId LIMIT 1;`,
      {
        replacements: { branchId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (!branchRows[0]) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const existingUserRows = await sequelize.query(
      `SELECT id FROM "User" WHERE username = :username LIMIT 1;`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (existingUserRows[0]) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Username already exists" });
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(password, 10);

    const userRows = await sequelize.query(
      `
      INSERT INTO "User" (username, "passwordHash", "roleId", "createdAt", "updatedAt")
      VALUES (:username, :passwordHash, 2, :createdAt, :updatedAt)
      RETURNING id, username, "roleId", "createdAt";
      `,
      {
        replacements: {
          username: username.trim(),
          passwordHash,
          createdAt: now,
          updatedAt: now,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    const user = userRows[0][0];

    const agentRequestRows = await sequelize.query(
      `
      INSERT INTO "PoliceAgentRequest"
        ("policeAgentRequestsTempId", "userId", "branchId", status, "createdAt")
      VALUES
        (NULL, :userId, :branchId, 'approved', :createdAt)
      RETURNING id, "userId", "branchId", status, "createdAt";
      `,
      {
        replacements: {
          userId: user.id,
          branchId,
          createdAt: now,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Police agent created successfully",
      data: {
        user,
        agentRequest: agentRequestRows[0][0],
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Create Police Agent Error:", error);
    res.status(500).json({ success: false, message: "Error creating police agent" });
  }
};

export const assignBranchHead = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { branchId } = req.params;
    const { userId } = req.body;

    const branchRows = await sequelize.query(
      `SELECT id FROM "PoliceBranch" WHERE id = :branchId LIMIT 1 FOR UPDATE;`,
      {
        replacements: { branchId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (!branchRows[0]) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    if (userId === null || userId === undefined || userId === "") {
      const clearedRows = await sequelize.query(
        `
        UPDATE "PoliceBranch"
        SET "branchHeadUserId" = NULL
        WHERE id = :branchId
        RETURNING id, "branchHeadUserId";
        `,
        {
          replacements: { branchId },
          type: QueryTypes.UPDATE,
          transaction: t,
        }
      );

      await t.commit();
      return res.status(200).json({
        success: true,
        message: "Branch head cleared",
        data: clearedRows[0][0],
      });
    }

    const agentRows = await sequelize.query(
      `
      SELECT u.id, u.username
      FROM "User" u
      JOIN "PoliceAgentRequest" ar ON ar."userId" = u.id
      WHERE u.id = :userId
        AND u."roleId" = 2
        AND ar.status = 'approved'
        AND ar."branchId" = :branchId
      LIMIT 1;
      `,
      {
        replacements: { branchId, userId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const agent = agentRows[0];
    if (!agent) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Selected user must be an approved police agent assigned to this branch",
      });
    }

    const updatedRows = await sequelize.query(
      `
      UPDATE "PoliceBranch"
      SET "branchHeadUserId" = :userId
      WHERE id = :branchId
      RETURNING id, "branchHeadUserId";
      `,
      {
        replacements: { branchId, userId },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    await t.commit();

    res.status(200).json({
      success: true,
      message: "Branch head assigned successfully",
      data: {
        ...updatedRows[0][0],
        branchHeadUsername: agent.username,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Assign Branch Head Error:", error);
    res.status(500).json({ success: false, message: "Error assigning branch head" });
  }
};
