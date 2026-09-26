/**
 * Security event logging (Phase 5, structured since Phase 7).
 *
 * Events go through the shared pino logger at warn level with the eventType
 * and request metadata as structured bindings; Phase 8 can count them as
 * Prometheus metrics.
 *
 * NEVER include request bodies, headers, tokens or credentials in events —
 * only metadata (ip, method, path, field names, sizes).
 */

import { logger } from "../config/logger.js";

export const logSecurityEvent = (eventType, req, details = {}) => {
  logger.warn(
    {
      eventType,
      ip: req?.ip,
      method: req?.method,
      path: req?.path,
      ...details,
    },
    "security_event"
  );
};

export default { logSecurityEvent };
