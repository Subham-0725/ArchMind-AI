// server/src/rie/security/rules/index.js
//
// Registry of modular AST security rules across supported languages.

import { JS_AST_RULES } from "./jsRules.js";
import { PYTHON_AST_RULES } from "./pythonRules.js";

export const ALL_AST_RULES = [...JS_AST_RULES, ...PYTHON_AST_RULES];

const SUPPORTED_LANGUAGES = new Set(["javascript", "typescript", "python"]);

/**
 * Returns whether a language identifier or file extension is supported for AST security analysis.
 */
export function isLanguageSupportedForAst(langOrExt) {
  if (!langOrExt) return false;
  const clean = langOrExt.toLowerCase().replace(/^\./, "");
  if (SUPPORTED_LANGUAGES.has(clean)) return true;
  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(clean)) return true;
  if (["py", "pyw"].includes(clean)) return true;
  return false;
}

/**
 * Returns active rules for a given language.
 */
export function getRulesForLanguage(langOrExt) {
  if (!langOrExt) return [];
  const clean = langOrExt.toLowerCase().replace(/^\./, "");

  if (["javascript", "typescript", "js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(clean)) {
    return JS_AST_RULES;
  }
  if (["python", "py", "pyw"].includes(clean)) {
    return PYTHON_AST_RULES;
  }

  return [];
}

/**
 * Looks up a rule by rule ID.
 */
export function getRuleById(ruleId) {
  return ALL_AST_RULES.find((r) => r.id === ruleId) || null;
}

