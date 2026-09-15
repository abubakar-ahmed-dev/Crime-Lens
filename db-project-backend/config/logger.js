/**
 * Structured logging (Phase 7).
 *
 * One shared pino instance for the whole backend. Development (NODE_ENV unset
 * or not "production") gets pretty output; production emits one JSON object
 * per line for aggregation.
 *
 * Request-scoped logging comes from pino-http (`httpLogger`): every request
 * gets `req.log` (with `request_id`) and exactly one completion line with
 * method, url, status and responseTime — except the health endpoints, which
 * are polled and would otherwise flood the log.
 *
 * Rules enforced here and by convention:
 * - Request bodies are NEVER logged (no serializer emits them; do not add any).
 * - Authorization/cookie headers and credential-like fields are redacted as
 *   a second line of defense — the first line is simply not logging them.
 * - Pass errors as the `err` binding (`logger.error({ err }, "msg")`) so
 *   pino serializes message + stack; do not hand-extract err.message.
 */

import crypto from "crypto";
import pino from "pino";
import pinoHttp from "pino-http";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  base: { service: "crimelens-api" },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname,service",
          },
        },
      }),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.apiKey",
    ],
    censor: "***",
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) =>
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    crypto.randomUUID(),
  // NOTE: use originalUrl — Express 5's router leaves the raw req.url
  // stripped of mount prefixes, which would log "/types" for
  // /api/crimes/types. originalUrl keeps the full path.
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode} completed`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${err.message}`,
  customAttributeKeys: {
    reqId: "request_id",
  },
  // Polled endpoints must not flood the log
  autoLogging: {
    ignore: (req) => req.url === "/api/health" || req.url === "/health" || req.url === "/ready",
  },
});

export default { logger, httpLogger };
