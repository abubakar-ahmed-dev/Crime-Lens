// controllers/agentController.js
// import { v4 as uuidv4 } from "uuid";
import { QueryTypes, Op, fn, col, literal } from "sequelize";
import sequelize from "../config/db.js";
import db from "../models/index.js";
import bcrypt from "bcryptjs";
const { Crime, User, Criminal , CrimeSubmission, PoliceAgentRequestsTemp, CrimeReportsSubmitter, PoliceAgentRequest, CrimeType, Zone, PoliceBranch } = db;

// ===================================================
// ➕ CREATE AGENT REQUEST
// ===================================================

export const agentRequest = async (req, res) => {

  let t;
  try {
    const { branchId, username, password } = req.body;

    // Validate required fields
    if (!branchId || !username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    t = await sequelize.transaction();

    // 1️⃣ Validate branch exists (PoliceBranch)
    // Assuming table name = "PoliceBranch" and PK = "id"  ⚠ verify
    const branch = await sequelize.query(
      `
      SELECT * FROM "PoliceBranch" WHERE id = :branchId
      `,
      {
        replacements: { branchId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (branch.length === 0) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    // 2️⃣ Check if username already exists (User table)
    const existingUser = await sequelize.query(
      `
      SELECT * FROM "User" WHERE username = :username
      `,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    if (existingUser.length > 0) {
      await t.rollback();
      return res
        .status(409)
        .json({ success: false, message: "Username already exists" });
    }

    // 3️⃣ Insert into PoliceAgentRequestsTemp
    // Table name = "PoliceAgentRequestsTemp"  ⚠ verify
    const requestTempResult = await sequelize.query(
      `
      INSERT INTO "PoliceAgentRequestsTemp" (username, password, "createdAt")
      VALUES (:username, :password, :createdAt)
      RETURNING id;
      `,
      {
        replacements: {
          username,
          password,
          createdAt: new Date(),
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    // The returned INSERT format is: [ [ { id: X } ], metadata ]
    const requestTempId = requestTempResult[0][0].id;

    // 4️⃣ Insert into PoliceAgentRequest
    // Table name = "PoliceAgentRequest"  ⚠ verify
    const agentRequestResult = await sequelize.query(
      `
      INSERT INTO "PoliceAgentRequest" 
      ("policeAgentRequestsTempId", "userId", "branchId", status, "createdAt")
      VALUES (:tempId, NULL, :branchId, 'pending', :createdAt)
      RETURNING id, status, "branchId";
      `,
      {
        replacements: {
          tempId: requestTempId,
          branchId,
          createdAt: new Date(),
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    const requestData = agentRequestResult[0][0];
    await t.commit();

    // 5️⃣ Send same structure back to frontend (DO NOT CHANGE ANY FIELDS)
    res.status(201).json({
      success: true,
      message:
        "Agent request submitted successfully. Awaiting verification.",
      data: {
        requestId: requestData.id,
        tempId: requestTempId,
        status: requestData.status,
        branchId: requestData.branchId,
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Agent Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error submitting agent request" });
  }
};


// ===================================================
// ✅ VERIFY & APPROVE AGENT REQUEST (Admin Only)
// ===================================================

export const verifyAgentRequest = async (req, res) => {

  const t = await sequelize.transaction();

  try {
    const { requestId } = req.params;
    const { roleId, username, branchId } = req.body; // roleId for the new agent

    // ---------------------------
    // 1️⃣ Fetch pending agent request + temp data
    // ---------------------------
    const agentRequestRows = await sequelize.query(
      `
      SELECT ar.id AS "agentRequestId",
             ar."userId",
             ar."branchId",
             ar.status,
             t.id AS "tempId",
             t.username,
             t.password
      FROM "PoliceAgentRequest" ar
      JOIN "PoliceAgentRequestsTemp" t
        ON t.id = ar."policeAgentRequestsTempId"
      WHERE ar.id = :requestId
      LIMIT 1;
      `,
      {
        replacements: { requestId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const agentRequest = agentRequestRows[0];

    if (!agentRequest) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    if (agentRequest.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Request has already been processed",
      });
    }

    // ---------------------------
    // 2️⃣ Create new user in User table
    // ---------------------------
    const now = new Date();
    const finalUsername = username || agentRequest.username;
    const finalBranchId = branchId || agentRequest.branchId;

    const branchRows = await sequelize.query(
      `SELECT id FROM "PoliceBranch" WHERE id = :branchId LIMIT 1;`,
      {
        replacements: { branchId: finalBranchId },
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
        replacements: { username: finalUsername },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );
    if (existingUserRows[0]) {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Username already exists" });
    }

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(agentRequest.password, 10);

    const newUserResult = await sequelize.query(
      `
      INSERT INTO "User" (username, "passwordHash", "roleId", "createdAt", "updatedAt")
      VALUES (:username, :passwordHash, :roleId, :createdAt, :updatedAt)
      RETURNING id, username, "roleId";  -- ⚠ returning fields used in response
      `,
      {
        replacements: {
          username: finalUsername,
          passwordHash: hashedPassword, // Hashed password
          roleId: roleId || 2,
          createdAt: now,
          updatedAt: now,
        },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );

    const newUser = newUserResult[0][0];

    // ---------------------------
    // 3️⃣ Update PoliceAgentRequest to link new user and change status
    // ---------------------------
    await sequelize.query(
      `
      UPDATE "PoliceAgentRequest"
      SET "userId" = :userId,
          "branchId" = :branchId,
          status = 'approved'
      WHERE id = :requestId
      `,
      {
        replacements: {
          userId: newUser.id,
          branchId: finalBranchId,
          verifiedAt: now,
          requestId,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // ---------------------------
    // 4️⃣ Delete temp entry
    // ---------------------------
    await sequelize.query(
      `
      DELETE FROM "PoliceAgentRequestsTemp"
      WHERE id = :tempId
      `,
      {
        replacements: { tempId: agentRequest.tempId },
        type: QueryTypes.DELETE,
        transaction: t,
      }
    );
    await t.commit();
    // ---------------------------
    // 5️⃣ Send response (frontend format unchanged)
    // ---------------------------
    res.status(200).json({
      success: true,
      message: "Agent request approved and user created successfully",
      data: {
        userId: newUser.id,
        username: newUser.username,
        branchId: finalBranchId,
        status: "approved",
      },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Verify Agent Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error verifying agent request" });
  }
};

// ===================================================
// ❌ REJECT AGENT REQUEST (Admin Only)
// ===================================================

export const rejectAgentRequest = async (req, res) => {
  
  const t = await sequelize.transaction();

  try {
    const { requestId } = req.params;

    // ---------------------------
    // 1️⃣ Fetch agent request + temp entry
    // ---------------------------
    const agentRequestRows = await sequelize.query(
      `
      SELECT ar.id AS "agentRequestId",
             ar.status,
             t.id AS "tempId"
      FROM "PoliceAgentRequest" ar
      JOIN "PoliceAgentRequestsTemp" t
        ON t.id = ar."policeAgentRequestsTempId"
      WHERE ar.id = :requestId
      LIMIT 1;
      `,
      {
        replacements: { requestId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );
    const agentRequest = agentRequestRows[0];

    if (!agentRequest) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    if (agentRequest.status !== "pending") {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Request has already been processed",
      });
    }

    // ---------------------------
    // 2️⃣ Update status
    // ---------------------------
    await sequelize.query(
      `
      UPDATE "PoliceAgentRequest"
      SET status = 'rejected'
      WHERE id = :requestId
      `,
      {
        replacements: {
          requestId,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // ---------------------------
    // 3️⃣ Delete temp entry
    // ---------------------------
    await sequelize.query(
      `
      DELETE FROM "PoliceAgentRequestsTemp"
      WHERE id = :tempId
      `,
      {
        replacements: { tempId: agentRequest.tempId },
        type: QueryTypes.DELETE,
        transaction: t,
      }
    );

    await t.commit();

    // ---------------------------
    // 4️⃣ Response (frontend format unchanged)
    // ---------------------------
    res.status(200).json({
      success: true,
      message: "Agent request rejected",
      data: { requestId: agentRequest.agentRequestId, status: "rejected" },
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Reject Agent Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error rejecting agent request" });
  }
};


// ===================================================
// 🔹 GET ALL PENDING REQUESTS
// ===================================================
export const getPendingRequests = async (req, res) => {
  try {
    const pendingRequests = await sequelize.query(
      `
      SELECT 
        ar.id AS "agentRequestId",
        ar.status,
        ar."userId",
        ar."branchId",

        t.id AS "tempId",
        t.username AS "tempUsername",
        t."createdAt" AS "tempCreatedAt",

        b.id AS "branchId",
        b.name AS "branchName",
        b."contactNumber" AS "branchContactNumber",
        z.name AS "zoneName"
      FROM "PoliceAgentRequest" ar
      JOIN "PoliceAgentRequestsTemp" t
        ON t.id = ar."policeAgentRequestsTempId"
      JOIN "PoliceBranch" b
        ON b.id = ar."branchId"
      LEFT JOIN "Zone" z
        ON z.id = b."zoneId"
      WHERE ar.status = 'pending'
      ORDER BY ar.id ASC;
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Reshape to mimic Sequelize include format
    const formattedRequests = pendingRequests.map(r => ({
      id: r.agentRequestId,
      status: r.status,
      userId: r.userId,
      branchId: r.branchId,

      PoliceAgentRequestsTemp: {
        id: r.tempId,
        username: r.tempUsername,
        createdAt: r.tempCreatedAt,
      },
      PoliceBranch: {
        id: r.branchId,
        name: r.branchName,
        contactNumber: r.branchContactNumber,
        zoneName: r.zoneName,
      },
    }));

    res.status(200).json({ success: true, data: formattedRequests });
  } catch (error) {
    console.error("Fetch Requests Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching requests" });
  }
};

// ===================================================
// 🔹 GET REQUEST BY ID
// ===================================================
export const getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;

    const requestRows = await sequelize.query(
      `
      SELECT 
        ar.id AS "agentRequestId",
        ar.status,
        ar."userId",
        ar."branchId",

        t.id AS "tempId",
        t.username AS "tempUsername",
        t."createdAt" AS "tempCreatedAt",

        b.id AS "branchId",
        b.name AS "branchName",
        b."contactNumber" AS "branchContactNumber",
        z.name AS "zoneName"
      FROM "PoliceAgentRequest" ar
      JOIN "PoliceAgentRequestsTemp" t
        ON t.id = ar."policeAgentRequestsTempId"
      JOIN "PoliceBranch" b
        ON b.id = ar."branchId"
      LEFT JOIN "Zone" z
        ON z.id = b."zoneId"
      WHERE ar.id = :requestId
      LIMIT 1;
      `,
      {
        replacements: { requestId },
        type: QueryTypes.SELECT,
      }
    );

    const r = requestRows[0];

    if (!r) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    // Reshape like Sequelize include
    const formattedRequest = {
      id: r.agentRequestId,
      status: r.status,
      userId: r.userId,
      branchId: r.branchId,
      PoliceAgentRequestsTemp: {
        id: r.tempId,
        username: r.tempUsername,
        createdAt: r.tempCreatedAt,
      },
      PoliceBranch: {
        id: r.branchId,
        name: r.branchName,
        contactNumber: r.branchContactNumber,
        zoneName: r.zoneName,
      },
    };

    res.status(200).json({ success: true, data: formattedRequest });
  } catch (error) {
    console.error("Fetch Request Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching request" });
  }
};


export const getAllAgents = async (req, res) => {
  try {
    const agents = await sequelize.query(
      `
      SELECT 
        par.id AS "agentId",
        u.username AS "username",
        z.name AS "zoneName",
        par."branchId" AS "branchId",
        pb."contactNumber" AS "branchContact",
        par."createdAt" AS "createdAt"
      FROM "PoliceAgentRequest" par
      LEFT JOIN "User" u ON u.id = par."userId"
      LEFT JOIN "PoliceBranch" pb ON pb.id = par."branchId"
      LEFT JOIN "Zone" z ON z.id = pb."zoneId"
      WHERE par.status = 'approved'
      ORDER BY par.id ASC;
      `,
      { type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (err) {
    console.error("Error fetching agents from view:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const updateAgent = async (req, res) => {
  const agentId = req.params.id;
  const { username, branchId } = req.body;

  const t = await sequelize.transaction();

  try {
    // ---------------------------
    // 1️⃣ Fetch agent
    // ---------------------------
    const agentRows = await sequelize.query(
      `
      SELECT id, "userId", "branchId"
      FROM "PoliceAgentRequest"
      WHERE id = :agentId
      LIMIT 1
      FOR UPDATE;
      `,
      {
        replacements: { agentId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const agent = agentRows[0];

    if (!agent) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Agent not found" });
    }

    if (branchId !== undefined && branchId !== null && branchId !== "") {
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
    }

    // ---------------------------
    // 2️⃣ Update branchId in PoliceAgentRequest
    // ---------------------------
    await sequelize.query(
      `
      UPDATE "PoliceAgentRequest"
      SET "branchId" = :branchId
      WHERE id = :agentId
      `,
      {
        replacements: {
          branchId: branchId ?? agent.branchId,
          agentId,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // ---------------------------
    // 3️⃣ Fetch user
    // ---------------------------
    const userRows = await sequelize.query(
      `
      SELECT id, username
      FROM "User"
      WHERE id = :userId
      LIMIT 1
      FOR UPDATE;
      `,
      {
        replacements: { userId: agent.userId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const user = userRows[0];

    if (!user) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ---------------------------
    // 4️⃣ Update username in User
    // ---------------------------
    const updatedUsername = username ?? user.username;

    if (updatedUsername !== user.username) {
      const existingUserRows = await sequelize.query(
        `SELECT id FROM "User" WHERE username = :username AND id <> :userId LIMIT 1;`,
        {
          replacements: { username: updatedUsername, userId: user.id },
          type: QueryTypes.SELECT,
          transaction: t,
        }
      );
      if (existingUserRows[0]) {
        await t.rollback();
        return res.status(409).json({ success: false, message: "Username already exists" });
      }
    }

    await sequelize.query(
      `
      UPDATE "User"
      SET username = :username
      WHERE id = :userId
      `,
      {
        replacements: {
          username: updatedUsername,
          userId: user.id,
        },
        type: QueryTypes.UPDATE,
        transaction: t,
      }
    );

    // ---------------------------
    // 5️⃣ Commit transaction
    // ---------------------------
    await t.commit();

    return res.json({ success: true, message: "Agent updated successfully" });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("Error updating agent:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const deleteAgent = async (req, res) => {
  const agentId = req.params.id;
  const t = await sequelize.transaction();

  try {
    // ---------------------------
    // 1️⃣ Fetch agent
    // ---------------------------
    const agentRows = await sequelize.query(
      `
      SELECT id, "userId"
      FROM "PoliceAgentRequest"
      WHERE id = :agentId
      LIMIT 1;
      `,
      {
        replacements: { agentId },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );

    const agent = agentRows[0];

    if (!agent) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Agent not found" });
    }

    const userId = agent.userId;

    // ---------------------------
    // 2️⃣ Delete agent record
    // ---------------------------
    await sequelize.query(
      `
      DELETE FROM "PoliceAgentRequest"
      WHERE id = :agentId
      `,
      {
        replacements: { agentId },
        type: QueryTypes.DELETE,
        transaction: t,
      }
    );

    // ---------------------------
    // 3️⃣ Delete associated user if exists
    // ---------------------------
    if (userId) {
      await sequelize.query(
        `
        DELETE FROM "User"
        WHERE id = :userId
        `,
        {
          replacements: { userId },
          type: QueryTypes.DELETE,
          transaction: t,
        }
      );
    }

    await t.commit();

    // ---------------------------
    // 4️⃣ Response
    // ---------------------------
    return res.json({
      success: true,
      message: "Agent and associated user deleted successfully",
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("Error deleting agent:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};
