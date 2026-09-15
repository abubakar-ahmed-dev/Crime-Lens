/**
 * Security event logging (Phase 5).
 *
 * Lightweight structured events on the existing console transport; Phase 7
 * (Pino) will route these through the structured logger and Phase 8 can
 * count them as Prometheus metrics.
 *
 * NEVER include request bodies, headers, tokens or credentials in events —
 * only metadata (ip, method, path, field names, sizes).
 */

export const logSecurityEvent = (eventType, req, details = {}) => {
  const event = {
    timestamp: new Date().toISOString(),
    eventType,
    ip: req?.ip,
    method: req?.method,
    path: req?.path,
    ...details,
  };

  console.warn(`SECURITY_EVENT ${JSON.stringify(event)}`);
};

export default { logSecurityEvent };
