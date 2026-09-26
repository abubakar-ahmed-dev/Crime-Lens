/**
 * Input validation + sanitization middleware (Phase 5).
 *
 * validate(schema, target):
 *   - target "body": parsed (and unknown-key-stripped) data REPLACES req.body.
 *   - target "query" | "params": GATE ONLY — invalid input is rejected with
 *     400 but valid input is NOT written back. Express 5 made req.query a
 *     read-only getter, so assignment would throw; controllers already read
 *     the original (string) values, so rewriting them is unnecessary.
 *
 * sanitizeInput:
 *   Mutates string values of req.body / req.query IN PLACE (no property
 *   reassignment, so it is Express 5-safe), stripping script blocks,
 *   javascript: URIs and inline event handlers. React escaping on the
 *   frontend plus Helmet CSP remain the primary XSS defenses; this is
 *   defense-in-depth for stored payloads.
 */

import { logSecurityEvent } from "./securityMiddleware.js";

export const validate = (schema, target = "body") => {
  return (req, res, next) => {
    const data =
      target === "query" ? req.query : target === "params" ? req.params : req.body;

    const result = schema.safeParse(data);
    if (result.success) {
      if (target === "body") {
        req.body = result.data; // writable own property; strips unknown keys
      }
      return next();
    }

    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || target,
      message: issue.message,
    }));

    logSecurityEvent("VALIDATION_BLOCKED", req, {
      target,
      fields: errors.map((e) => e.field),
    });

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors,
    });
  };
};

const SANITIZE_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
];

const sanitizeValue = (value) => {
  if (typeof value !== "string") return { value, changed: false };
  let out = value;
  let changed = false;
  for (const pattern of SANITIZE_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, "");
      changed = true;
    }
  }
  return { value: out, changed };
};

const sanitizeInPlace = (obj) => {
  if (!obj || typeof obj !== "object") return false;
  let changed = false;

  for (const key of Object.keys(obj)) {
    const current = obj[key];
    if (typeof current === "string") {
      const { value, changed: v } = sanitizeValue(current);
      if (v) {
        obj[key] = value;
        changed = true;
      }
    } else if (Array.isArray(current) || (current && typeof current === "object")) {
      // Nested arrays/objects (e.g. mediaData, captions) — recurse in place
      if (sanitizeInPlace(current)) changed = true;
    }
  }
  return changed;
};

// Exported for unit testing the mutation logic directly
export { sanitizeInPlace };

export const sanitizeInput = (req, res, next) => {
  const bodyChanged = sanitizeInPlace(req.body);
  const queryChanged = sanitizeInPlace(req.query);

  if (bodyChanged || queryChanged) {
    logSecurityEvent("INPUT_SANITIZED", req, { body: bodyChanged, query: queryChanged });
  }
  next();
};

export default { validate, sanitizeInput };
