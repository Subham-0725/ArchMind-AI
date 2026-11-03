// server/src/rie/api/routeValidator.js
//
// Repository Intelligence Engine — API Route Validator
//
// Strictly validates extracted route records against schema constraints,
// line-range invariants, path traversal rules, and HTTP method standards.

const ALLOWED_METHODS = new Set([
  "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "ALL", "USE"
]);

const ALLOWED_CONFIDENCES = new Set(["high", "medium", "low"]);

/**
 * Validates a single API route record.
 *
 * @param {Object} route
 * @returns {{ isValid: boolean, errors: Array<string> }}
 */
export function validateRouteRecord(route) {
  const errors = [];

  if (!route || typeof route !== "object") {
    return { isValid: false, errors: ["Route record must be a valid non-null object."] };
  }

  // 1. routeId
  if (!route.routeId || typeof route.routeId !== "string" || route.routeId.trim().length === 0) {
    errors.push("Route 'routeId' is required and must be a non-empty string.");
  }

  // 2. HTTP method
  if (!route.method || typeof route.method !== "string" || !ALLOWED_METHODS.has(route.method.toUpperCase())) {
    errors.push(`Invalid HTTP method '${route.method}'. Allowed: ${Array.from(ALLOWED_METHODS).join(", ")}`);
  }

  // 3. Route path
  if (!route.path || typeof route.path !== "string") {
    errors.push("Route 'path' is required and must be a string.");
  }

  // 4. Source file path & traversal checks
  if (!route.sourceFile || typeof route.sourceFile !== "string") {
    errors.push("Route 'sourceFile' is required and must be a string.");
  } else {
    const norm = route.sourceFile.replace(/\\/g, "/");
    if (norm.startsWith("/") || norm.includes("../") || norm.includes("..\\") || norm.includes("://")) {
      errors.push(`Route sourceFile '${route.sourceFile}' violates path safety constraints.`);
    }
  }

  // 5. Line range invariants
  if (!route.lineRange || typeof route.lineRange !== "object") {
    errors.push("Route 'lineRange' is required and must be an object with startLine and endLine.");
  } else {
    const { startLine, endLine } = route.lineRange;
    if (typeof startLine !== "number" || !Number.isInteger(startLine) || startLine < 1) {
      errors.push(`Route 'startLine' (${startLine}) must be an integer >= 1.`);
    }
    if (typeof endLine !== "number" || !Number.isInteger(endLine) || endLine < (startLine || 1)) {
      errors.push(`Route 'endLine' (${endLine}) must be an integer >= startLine.`);
    }
  }

  // 6. Confidence
  if (route.confidence && !ALLOWED_CONFIDENCES.has(route.confidence.toLowerCase())) {
    errors.push(`Invalid confidence '${route.confidence}'. Allowed: high, medium, low.`);
  }

  // 7. Array fields
  if (route.middleware && !Array.isArray(route.middleware)) {
    errors.push("Route 'middleware' must be an array.");
  }
  if (route.params && !Array.isArray(route.params)) {
    errors.push("Route 'params' must be an array.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a collection of API routes.
 *
 * @param {Array<Object>} routes
 * @returns {{ isValid: boolean, validRoutes: Array<Object>, rejectedCount: number, errors: Array<string> }}
 */
export function validateRouteCollection(routes = []) {
  if (!Array.isArray(routes)) {
    return {
      isValid: false,
      validRoutes: [],
      rejectedCount: 0,
      errors: ["Routes collection must be an array."],
    };
  }

  const validRoutes = [];
  const allErrors = [];
  let rejectedCount = 0;

  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    const { isValid, errors } = validateRouteRecord(r);
    if (isValid) {
      validRoutes.push(r);
    } else {
      rejectedCount++;
      allErrors.push(`[Route index ${i}]: ${errors.join("; ")}`);
    }
  }

  return {
    isValid: allErrors.length === 0,
    validRoutes,
    rejectedCount,
    errors: allErrors,
  };
}

