/**
 * Zod validation schemas (Phase 5 — API security hardening).
 *
 * Schemas describe what the API ACTUALLY accepts today (verified against the
 * frontend callers and controller logic), adding type/length/range bounds on
 * top. They intentionally do NOT tighten formats the controllers treat
 * loosely — that would be a behavior change, not a security fix.
 *
 * Notable contract facts these schemas encode:
 * - Login requires `verify_role` ("admin" | "police", legacy display names
 *   also mapped by the controller) — a username/password-only schema would
 *   reject every real login.
 * - The report form sends latitude/longitude (and zone/crimeType selects)
 *   as STRINGS, so numeric fields use z.coerce.
 * - Crime report `title` is optional server-side (controller defaults to
 *   "Untitled Crime"); empty-string optionals are coerced to undefined
 *   because `Number("") === 0` would otherwise pass coerce validation.
 * - Date inputs are `<input type="date">` values ("YYYY-MM-DD"), NOT full
 *   ISO datetimes.
 */

import { z } from "zod";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Treat "" / null as absent (form fields start as empty strings). */
const emptyToUndefined = (value) => (value === "" || value === null ? undefined : value);

/** Optional field that also tolerates "" (e.g. unset query params). */
const optionalEmpty = (schema) => z.preprocess(emptyToUndefined, schema.optional());

/** Coerced numeric field that tolerates "" (Number("") === 0 trap). */
const optionalCoercedNumber = (schema) => optionalEmpty(z.coerce.number(schema));

/** "YYYY-MM-DD" string that also parses as a real calendar date. */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Date must be a valid calendar date");

const latitudeField = z.coerce.number().min(23).max(26);
const longitudeField = z.coerce.number().min(65).max(68);

// ----------------------------------------------------------------
// Authentication
// ----------------------------------------------------------------

// POST /api/auth/login — admin/police login
export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
  // Controller maps "Administrator"/"Police Agent" legacy names too
  verify_role: z.enum(["admin", "police", "Administrator", "Police Agent"]),
});

// POST /api/citizens/register
export const citizenRegisterSchema = z.object({
  email: z.email().max(254),
  // 72 = bcrypt's input limit; longer secrets are silently truncated by bcrypt
  password: z.string().min(6).max(72),
  fullName: z.string().min(1).max(100),
  redirectTo: z.string().max(2048).optional(),
});

// POST /api/citizens/login
export const citizenLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
});

// POST /api/citizens/google-auth
export const googleAuthSchema = z.object({
  accessToken: z.string().min(1).max(2048),
  mode: z.enum(["login", "signup"]).optional(),
});

// ----------------------------------------------------------------
// Crimes
// ----------------------------------------------------------------

const crimeMediaSchema = z.object({
  publicId: z.string().min(1).max(200),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive(),
  fileType: z.enum(["image", "video"]),
  url: z.url(),
  thumbnailUrl: z.url().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().int().nonnegative().optional(),
  caption: z.string().max(300).optional(),
});

// POST /api/user/report-crime (citizen submission)
export const crimeReportSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(), // controller defaults it
  zone: optionalCoercedNumber(z.number().int().positive()),
  crimeTypeId: z.coerce.number().int().positive(),
  date: dateString,
  address: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  latitude: latitudeField,
  longitude: longitudeField,
  mediaData: z.array(crimeMediaSchema).max(10).optional(),
});

// PUT /api/crimes/update/:id (police) — latitude/longitude are enforced as
// required by the controller, mediaOperations must survive validation
export const crimeUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  zoneId: optionalCoercedNumber(z.number().int().positive()),
  latitude: latitudeField.optional(),
  longitude: longitudeField.optional(),
  crimeTypeId: optionalCoercedNumber(z.number().int().positive()),
  incidentDate: dateString.optional(),
  date: dateString.optional(),
  mediaOperations: z
    .object({
      toUpdate: z
        .array(
          z.object({
            mediaId: z.coerce.number().int().positive(),
            visibility: z.enum(["public", "police_only"]).optional(),
            caption: z.string().max(300).optional(),
            evidenceMarked: z.boolean().optional(),
          })
        )
        .max(50)
        .optional(),
      toRemove: z.array(z.coerce.number().int().positive()).max(50).optional(),
    })
    .optional(),
});

// ----------------------------------------------------------------
// Queries (gate-only — Express 5 req.query is read-only)
// ----------------------------------------------------------------

// GET /api/crimes (map) — every real filter param, all optional
export const mapQuerySchema = z.object({
  mode: z.enum(["basic", "radius"]).optional(),
  crimeType: z.string().max(100).optional(),
  zoneId: z.string().max(20).optional(),
  startDate: optionalEmpty(dateString),
  endDate: optionalEmpty(dateString),
  lat: optionalCoercedNumber(z.number().min(23).max(26)),
  lng: optionalCoercedNumber(z.number().min(65).max(68)),
  radius: optionalCoercedNumber(z.number().positive()),
  page: optionalCoercedNumber(z.number().int().positive().max(100000)),
  limit: optionalCoercedNumber(z.number().int().positive().max(200)),
});

// GET /api/crimes/all (police)
export const paginationQuerySchema = z.object({
  page: optionalCoercedNumber(z.number().int().positive().max(100000)),
  limit: optionalCoercedNumber(z.number().int().positive().max(200)),
});

// GET /api/stats/* — start/end are date-input strings ("" when unset)
export const statsQuerySchema = z.object({
  start: optionalEmpty(dateString),
  end: optionalEmpty(dateString),
  crimeTypeId: optionalCoercedNumber(z.number().int().positive()),
});

// GET /api/zones/severity — same date params plus name/id filters
export const zoneSeverityQuerySchema = z.object({
  crimeType: z.string().max(100).optional(),
  zoneId: z.string().max(20).optional(),
  startDate: optionalEmpty(dateString),
  endDate: optionalEmpty(dateString),
});

// ----------------------------------------------------------------
// Agents / admin
// ----------------------------------------------------------------

// POST /api/agent/request (public, unauthenticated write)
export const agentRequestSchema = z.object({
  branchId: z.coerce.number().int().positive(),
  username: z.string().min(3).max(50),
  password: z.string().min(1).max(200),
});

// POST /api/admin/branches
export const branchCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  zoneId: z.coerce.number().int().positive(),
  address: z.string().min(1).max(500),
  contactNumber: z.string().regex(/^\d{10,15}$/, "Contact number must be 10-15 digits"),
  latitude: latitudeField,
  longitude: longitudeField,
});

export default {
  loginSchema,
  citizenRegisterSchema,
  citizenLoginSchema,
  googleAuthSchema,
  crimeReportSchema,
  crimeUpdateSchema,
  mapQuerySchema,
  paginationQuerySchema,
  statsQuerySchema,
  zoneSeverityQuerySchema,
  agentRequestSchema,
  branchCreateSchema,
};
