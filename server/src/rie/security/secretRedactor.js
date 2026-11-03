// server/src/rie/security/secretRedactor.js
//
// Repository Intelligence Engine — Secret Redactor
//
// Strips detected secrets and sensitive tokens from source code strings, blueprints,
// and prompts before they are transmitted to external LLM providers or logged.

import { SECRET_PATTERNS } from "./secretPatterns.js";

/**
 * Replaces any detected secrets in text with a safe replacement token:
 * `[REDACTED_SECRET:<CATEGORY>]`
 *
 * @param {string} text - Raw source code or prompt text
 * @returns {string} Sanitized text with secrets redacted
 */
export function redactSecrets(text) {
  if (!text || typeof text !== "string") return text;

  let sanitized = text;

  for (const pattern of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    sanitized = sanitized.replace(regex, (match, ...args) => {
      const p1 = pattern.captureGroup ? args[pattern.captureGroup - 1] : match;
      const target = p1 || match;
      if (!target) return match;

      // If pattern has a custom filter, check it
      if (typeof pattern.filterFn === "function" && !pattern.filterFn(target)) {
        return match;
      }

      const replacement = `[REDACTED_SECRET:${pattern.category.toUpperCase().replace(/[^A-Z0-9]/g, "_")}]`;

      if (pattern.captureGroup) {
        return match.replace(target, replacement);
      }
      return replacement;
    });
  }

  return sanitized;
}

/**
 * Deeply sanitizes an object or array, redacting secrets in all string properties.
 *
 * @param {any} target - Object, array, or primitive
 * @returns {any} Sanitized clone
 */
export function redactDeep(target) {
  if (target === null || target === undefined) return target;
  if (typeof target === "string") return redactSecrets(target);
  if (typeof target !== "object") return target;

  if (Array.isArray(target)) {
    return target.map((item) => redactDeep(item));
  }

  const result = {};
  for (const key of Object.keys(target)) {
    result[key] = redactDeep(target[key]);
  }
  return result;
}
