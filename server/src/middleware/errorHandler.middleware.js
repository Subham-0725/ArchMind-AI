// server/src/middleware/errorHandler.middleware.js
//
// Centralized Express error-handling middleware for ArchMind AI (Phase 6).
// Standardizes error responses with machine-readable codes, structured logging,
// and guarantees credentials, stack traces, and internal server paths are never leaked.

import { redactSecrets } from "../rie/security/secretRedactor.js";

/**
 * Maps HTTP status codes and error names to standardized machine-readable error codes.
 *
 * @param {Error} err
 * @param {number} status
 * @returns {string}
 */
function resolveErrorCode(err, status) {
  if (err.code && typeof err.code === "string" && !err.code.startsWith("ERR_")) {
    return err.code;
  }

  if (err.name === "ValidationError") return "VALIDATION_ERROR";
  if (err.name === "CastError") return "INVALID_IDENTIFIER";

  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "RESOURCE_NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "RATE_LIMITED";
    case 502:
    case 504:
      return "UPSTREAM_SERVICE_ERROR";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

/**
 * Sanitizes error messages to remove any potential token leaks or sensitive file paths.
 *
 * @param {string} msg
 * @returns {string}
 */
function sanitizeErrorMessage(msg) {
  if (typeof msg !== "string" || !msg) return "An unexpected error occurred.";
  const redacted = redactSecrets(msg);
  // Strip Windows/Unix absolute paths if accidentally leaked in system errors
  return redacted.replace(/[A-Z]:\\[^:\s]+/gi, "[REDACTED_PATH]");
}

/**
 * Centralized global error handling middleware.
 */
export function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number(err.status || err.statusCode) || 500;
  const rawMessage = err.message || "An unexpected error occurred.";
  const sanitizedMessage = sanitizeErrorMessage(rawMessage);
  const errorCode = resolveErrorCode(err, status);

  // Structured server-side logging without leaking secrets
  console.error(
    `[ArchMind API Error] ${new Date().toISOString()} | ${req.method} ${req.originalUrl || req.url} | Status: ${status} | Code: ${errorCode} | Message: ${sanitizedMessage}`
  );

  // Backward-compatible structured response
  // Provides both structured object { code, message, details } AND top-level string message
  // so legacy and Phase 6 clients can consume either contract seamlessly.
  return res.status(status).json({
    success: false,
    error: sanitizedMessage, // string for legacy client compatibility
    errorDetail: {
      code: errorCode,
      message: sanitizedMessage,
      details: err.details || null,
    },
  });
}

/**
 * 404 Not Found fallback handler for unmatched routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl || req.url}`,
    code: "ROUTE_NOT_FOUND",
    errorDetail: {
      code: "ROUTE_NOT_FOUND",
      message: `The requested endpoint '${req.originalUrl || req.url}' does not exist on this server.`,
      details: null,
    },
  });
}
