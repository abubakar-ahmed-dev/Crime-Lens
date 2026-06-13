import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../models/index.js";
import { QueryTypes } from "sequelize";

const { User, Role } = db;


export const login = async (req, res) => {
  try {
    const { username, password, verify_role } = req.body;

    if (!username || !password || !verify_role)
      return res
        .status(400)
        .json({ success: false, message: "Missing credentials" });

        // ---------------------------
        // RAW SQL: Get user + role
        // ---------------------------
        const query = `
        SELECT 
        u.id,
        u.username,
        u."passwordHash",
        u."roleId",
        r.name AS "roleName"
        FROM "User" u
        LEFT JOIN "Role" r
        ON r.id = u."roleId"
        WHERE u.username = :username
        LIMIT 1;
        `;
        
        const users = await db.sequelize.query(query, {
          type: QueryTypes.SELECT,
          replacements: { username },
        });
        
        const user = users[0];
        
        if (!user)
          return res
        .status(404)
        .json({ success: false, message: "User not found" });
        
        // ---------------------------
        // Compare password using bcrypt
        // ---------------------------
        console.log("Input password:", password);
        console.log("Stored hash:", user.passwordHash);

        let passwordMatches = false;

        // Check if stored password is a bcrypt hash (starts with $2a$ or $2b$)
        if (user.passwordHash && user.passwordHash.startsWith('$2')) {
          // It's a bcrypt hash - use bcrypt.compare
          passwordMatches = await bcrypt.compare(password, user.passwordHash);
          console.log("Using bcrypt comparison, result:", passwordMatches);
        } else {
          // It's plain text - compare directly and then hash it
          passwordMatches = (password === user.passwordHash);
          console.log("Plain text comparison, result:", passwordMatches);

          // If matches, hash the password and update the database
          if (passwordMatches) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.sequelize.query(
              `UPDATE "User" SET "passwordHash" = :hashedPassword WHERE id = :id`,
              {
                replacements: { hashedPassword, id: user.id },
                type: QueryTypes.UPDATE,
              }
            );
            console.log("Password hashed and updated in database");
          }
        }

    if (!passwordMatches)
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
        
        const roleName = user.roleName; // identical to user.Role?.name
        
        const mapVerifyRole = (verifyRole) => {
          if (verifyRole === "Administrator") return "admin";
          if (verifyRole === "Police Agent") return "police";
          return "user";
        };
        
        const expectedRole = mapVerifyRole(verify_role);
        
        // Role mismatch
        if (roleName !== expectedRole) {
          return res.status(401).json({
            success: false,
            message: "Invalid username or password",
          });
        }
        
    // ---------------------------
    // Create JWT
    // ---------------------------
    const payload = {
      id: user.id,
      username: user.username,
      role: roleName,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "6h",
    });

    // ---------------------------
    // RAW SQL: Update last_login
    // ---------------------------
    const updateQuery = `
      UPDATE "User"
      SET last_login = NOW()
      WHERE id = :id
    `;

    db.sequelize.query(updateQuery, {
      type: QueryTypes.UPDATE,
      replacements: { id: user.id },
    }).catch(() => {});


    // ---------------------------
    // FINAL RESPONSE (unchanged)
    // ---------------------------
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: roleName,
        role_id: user.role_id,
      },
    });
  } catch (err) {
    console.error("authController.login error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
