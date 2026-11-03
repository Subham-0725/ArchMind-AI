// server/src/rie/validation/blueprintValidator.js
//
// Repository Intelligence Engine — Blueprint Schema Validator
//
// Enforces strict schema integrity on compiled Repository Blueprints before
// downstream AI analysis, architecture topology generation, or database persistence.
//
// Rejects malformed paths (path traversal, backslashes), missing required fields,
// invalid data types, and broken entity relationships.

export class BlueprintValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = "BlueprintValidationError";
    this.code = "INVALID_BLUEPRINT";
    this.errors = errors;
  }
}

/**
 * Validates file path safety (rejects path traversal, backslashes, absolute roots).
 *
 * @param {string} p - File path
 * @returns {boolean} True if safe
 */
export function isSafeFilePath(p) {
  if (typeof p !== "string" || !p.trim()) return false;
  if (p.includes("\\")) return false; // Must be normalized forward slashes
  if (p.includes("\0")) return false; // No null bytes
  if (p.startsWith("/")) return false; // Must be relative
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === ".") return false;
  }
  return true;
}

/**
 * Validates a Repository Blueprint object against the strict ArchMind schema.
 *
 * @param {Object} blueprint
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function isValidBlueprint(blueprint) {
  const errors = [];

  if (!blueprint || typeof blueprint !== "object" || Array.isArray(blueprint)) {
    return { valid: false, errors: ["Blueprint must be a non-null object."] };
  }

  // 1. Root Version & Timestamp
  if (typeof blueprint.version !== "number" || blueprint.version < 1) {
    errors.push("Field 'version' must be a positive integer.");
  }
  if (!blueprint.generatedAt || isNaN(Date.parse(blueprint.generatedAt))) {
    errors.push("Field 'generatedAt' must be a valid ISO 8601 date string.");
  }

  // 2. Metadata
  if (!blueprint.metadata || typeof blueprint.metadata !== "object") {
    errors.push("Field 'metadata' must be an object.");
  } else {
    if (typeof blueprint.metadata.name !== "string" || !blueprint.metadata.name.trim()) {
      errors.push("metadata.name must be a non-empty string.");
    }
    if (typeof blueprint.metadata.source !== "string") {
      errors.push("metadata.source must be a string.");
    }
    if (typeof blueprint.metadata.primaryLanguage !== "string") {
      errors.push("metadata.primaryLanguage must be a string.");
    }
  }

  // 3. Capabilities
  if (!blueprint.capabilities || typeof blueprint.capabilities !== "object") {
    errors.push("Field 'capabilities' must be an object.");
  } else {
    const requiredCaps = ["hasDatabase", "hasApis", "hasDevops", "hasSecuritySensitiveCode"];
    for (const cap of requiredCaps) {
      if (typeof blueprint.capabilities[cap] !== "boolean") {
        errors.push(`capabilities.${cap} must be a boolean.`);
      }
    }
  }

  // 4. Structure / File Tree
  if (!Array.isArray(blueprint.structure)) {
    errors.push("Field 'structure' must be an array.");
  } else {
    for (let i = 0; i < Math.min(blueprint.structure.length, 100); i++) {
      const item = blueprint.structure[i];
      if (!item || typeof item !== "object") {
        errors.push(`structure[${i}] must be an object.`);
        break;
      }
      if (!isSafeFilePath(item.path)) {
        errors.push(`structure[${i}].path '${item.path}' is invalid or contains path traversal.`);
        break;
      }
      if (typeof item.size !== "number" || item.size < 0) {
        errors.push(`structure[${i}].size must be a non-negative number.`);
        break;
      }
    }
  }

  // 5. Entry Points
  if (!Array.isArray(blueprint.entryPoints)) {
    errors.push("Field 'entryPoints' must be an array.");
  } else {
    for (let i = 0; i < blueprint.entryPoints.length; i++) {
      const ep = blueprint.entryPoints[i];
      if (!ep || typeof ep !== "object" || !ep.file) {
        errors.push(`entryPoints[${i}] must be an object with a 'file' property.`);
      } else if (!isSafeFilePath(ep.file)) {
        errors.push(`entryPoints[${i}].file '${ep.file}' is not a valid relative path.`);
      }
    }
  }

  // 6. Dependencies
  if (!blueprint.dependencies || typeof blueprint.dependencies !== "object") {
    errors.push("Field 'dependencies' must be an object.");
  } else {
    if (!Array.isArray(blueprint.dependencies.internal)) {
      errors.push("dependencies.internal must be an array.");
    }
    if (!Array.isArray(blueprint.dependencies.external)) {
      errors.push("dependencies.external must be an array.");
    }
  }

  // 7. Routes
  if (!Array.isArray(blueprint.routes)) {
    errors.push("Field 'routes' must be an array.");
  } else {
    for (let i = 0; i < blueprint.routes.length; i++) {
      const r = blueprint.routes[i];
      if (!r || typeof r !== "object") {
        errors.push(`routes[${i}] must be an object.`);
      } else {
        if (r.file && !isSafeFilePath(r.file)) {
          errors.push(`routes[${i}].file '${r.file}' is not a valid relative path.`);
        }
        if (typeof r.path !== "string") {
          errors.push(`routes[${i}].path must be a string.`);
        }
        if (r.line !== undefined && (typeof r.line !== "number" || r.line < 0)) {
          errors.push(`routes[${i}].line must be a non-negative integer.`);
        }
      }
    }
  }

  // 8. Models
  if (!Array.isArray(blueprint.models)) {
    errors.push("Field 'models' must be an array.");
  } else {
    for (let i = 0; i < blueprint.models.length; i++) {
      const m = blueprint.models[i];
      if (!m || typeof m !== "object" || typeof m.name !== "string" || !m.name.trim()) {
        errors.push(`models[${i}] must be an object with a non-empty 'name'.`);
      }
    }
  }

  // 9. Database (if present)
  if (blueprint.database !== null && blueprint.database !== undefined) {
    if (typeof blueprint.database !== "object") {
      errors.push("Field 'database' must be null or an object.");
    } else {
      const entities = blueprint.database.entities;
      const relationships = blueprint.database.relationships;

      if (!Array.isArray(entities)) {
        errors.push("database.entities must be an array.");
      } else {
        const knownEntityNames = new Set();
        for (let i = 0; i < entities.length; i++) {
          const ent = entities[i];
          if (!ent || typeof ent !== "object" || typeof ent.name !== "string" || !ent.name.trim()) {
            errors.push(`database.entities[${i}] must have a non-empty 'name'.`);
          } else {
            knownEntityNames.add(ent.name.toLowerCase());
          }
          if (!Array.isArray(ent.fields)) {
            errors.push(`database.entities[${i}].fields must be an array.`);
          }
        }

        // Validate relationships refer to existing entities if relationships are present
        if (Array.isArray(relationships) && knownEntityNames.size > 0) {
          for (let i = 0; i < relationships.length; i++) {
            const rel = relationships[i];
            const rawSrc = rel.from || rel.sourceEntity || "";
            const rawTgt = rel.to || rel.targetEntity || "";
            const srcLower = rawSrc.toLowerCase();
            const tgtLower = rawTgt.toLowerCase();

            if (srcLower && !knownEntityNames.has(srcLower)) {
              errors.push(`database.relationships[${i}] source '${rawSrc}' does not match any known entity.`);
            }
            if (tgtLower && !knownEntityNames.has(tgtLower)) {
              errors.push(`database.relationships[${i}] target '${rawTgt}' does not match any known entity.`);
            }
          }
        }
      }
    }
  }

  // 10. Token budgeting fields
  if (typeof blueprint.tokenEstimate !== "number" || blueprint.tokenEstimate < 0) {
    errors.push("Field 'tokenEstimate' must be a non-negative number.");
  }
  if (typeof blueprint.isBudgetTruncated !== "boolean") {
    errors.push("Field 'isBudgetTruncated' must be a boolean.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a Repository Blueprint and throws a typed BlueprintValidationError if invalid.
 *
 * @param {Object} blueprint
 * @throws {BlueprintValidationError}
 */
export function validateBlueprint(blueprint) {
  const result = isValidBlueprint(blueprint);
  if (!result.valid) {
    const errorMsg = `Repository Blueprint validation failed with ${result.errors.length} error(s):\n- ${result.errors.join("\n- ")}`;
    throw new BlueprintValidationError(errorMsg, result.errors);
  }
  return true;
}
