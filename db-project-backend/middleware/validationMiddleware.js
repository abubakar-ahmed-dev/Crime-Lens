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

/**
 * Hand-rolled HTML scrubbing, implemented as linear single-pass scanners.
 * Replaces the former backtracking regexes (CodeQL js/polynomial-redos,
 * js/bad-tag-filter): those could degrade polynomially on adversarial input
 * and missed `</script >`-style end tags. These scanners are worst-case O(n)
 * and strip end tags with optional whitespace before `>`.
 */

const SCRIPT_OPEN = "<script";
const SCRIPT_CLOSE = "</script";

const isWordChar = (c) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";

const isWhitespace = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";

/**
 * Removes `<script ...>...</script>` blocks (case-insensitive, tolerant of
 * whitespace before the end tag's `>`). An unclosed `<script` marker is
 * left untouched, matching the previous behavior for input without a full
 * block.
 */
const stripScriptBlocks = (input) => {
  const lower = input.toLowerCase();
  let out = "";
  let cursor = 0;
  for (;;) {
    const open = lower.indexOf(SCRIPT_OPEN, cursor);
    if (open === -1) {
      out += input.slice(cursor);
      return out;
    }
    const close = lower.indexOf(SCRIPT_CLOSE, open + SCRIPT_OPEN.length);
    if (close === -1) {
      out += input.slice(cursor);
      return out;
    }
    const closeEnd = lower.indexOf(">", close);
    if (closeEnd === -1) {
      out += input.slice(cursor);
      return out;
    }
    out += input.slice(cursor, open);
    cursor = closeEnd + 1;
  }
};

/**
 * Removes inline event handlers (`onclick=...`, `OnLoad="..."`), scanning
 * each character exactly once — no backtracking.
 */
const stripInlineEventHandlers = (input) => {
  let out = "";
  let i = 0;
  const n = input.length;
  while (i < n) {
    let matched = false;
    if ((input[i] === "o" || input[i] === "O") && (input[i + 1] === "n" || input[i + 1] === "N")) {
      let j = i + 2;
      while (j < n && isWordChar(input[j])) j += 1;
      let k = j;
      while (k < n && isWhitespace(input[k])) k += 1;
      if (j > i + 2 && k < n && input[k] === "=") {
        k += 1;
        while (k < n && isWhitespace(input[k])) k += 1;
        if (k < n && (input[k] === '"' || input[k] === "'")) {
          const quote = input[k];
          k += 1;
          while (k < n && input[k] !== quote) k += 1;
          if (k < n) k += 1; // consume closing quote
          i = k;
          matched = true;
        } else {
          const valueStart = k;
          while (k < n && !isWhitespace(input[k]) && input[k] !== ">") k += 1;
          if (k > valueStart) {
            i = k;
            matched = true;
          }
        }
      }
    }
    if (!matched) {
      out += input[i];
      i += 1;
    }
  }
  return out;
};

const sanitizeValue = (value) => {
  if (typeof value !== "string") return { value, changed: false };
  let out = stripScriptBlocks(value);
  out = out.replace(/javascript:/gi, "");
  out = stripInlineEventHandlers(out);
  return out === value ? { value, changed: false } : { value: out, changed: true };
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
