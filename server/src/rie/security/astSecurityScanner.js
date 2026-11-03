// server/src/rie/security/astSecurityScanner.js
//
// Repository Intelligence Engine — Tree-sitter AST Security Analyzer
//
// Performs structural AST security inspection on eligible source files across
// supported languages (JavaScript, TypeScript, and Python).
// Detects injection flaws, unsafe dynamic evaluation, command execution,
// path traversal, insecure cryptography, and prototype pollution.

import path from "path";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import { isLanguageSupportedForAst, getRulesForLanguage } from "./rules/index.js";

// Cached parser instances for performance
let jsParser = null;
let tsParser = null;
let tsxParser = null;
let pyParser = null;

function getParserForExt(ext) {
  const extension = (ext || "").toLowerCase();
  if (extension === ".ts") {
    if (!tsParser) {
      tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript);
    }
    return tsParser;
  }
  if (extension === ".tsx") {
    if (!tsxParser) {
      tsxParser = new Parser();
      tsxParser.setLanguage(TypeScript.tsx);
    }
    return tsxParser;
  }
  if (extension === ".py" || extension === ".pyw") {
    if (!pyParser) {
      pyParser = new Parser();
      pyParser.setLanguage(Python);
    }
    return pyParser;
  }
  // Default to JavaScript (.js, .jsx, .mjs, .cjs)
  if (!jsParser) {
    jsParser = new Parser();
    jsParser.setLanguage(JavaScript);
  }
  return jsParser;
}

/**
 * Scans a single source file using AST rules.
 *
 * @param {string} filePath - Relative file path in repository
 * @param {string} code - Source code text
 * @returns {{ findings: Array<Object>, status: string, error?: string }}
 */
export function scanFileAst(filePath, code) {
  if (!filePath || typeof code !== "string") {
    return { findings: [], status: "skipped" };
  }

  const normalizedPath = filePath.replace(/\\/g, "/");
  const ext = path.extname(normalizedPath).toLowerCase();

  if (!isLanguageSupportedForAst(ext)) {
    return {
      findings: [],
      status: "unsupported",
      reason: `Language extension '${ext}' is not supported for AST security analysis`,
    };
  }

  const rules = getRulesForLanguage(ext);
  if (rules.length === 0) {
    return { findings: [], status: "unsupported" };
  }

  let tree;
  try {
    const parser = getParserForExt(ext);
    tree = parser.parse(code);
  } catch (err) {
    return {
      findings: [],
      status: "parse_error",
      error: `Failed to parse AST for ${normalizedPath}: ${err.message}`,
    };
  }

  const findings = [];

  function visit(node) {
    if (!node) return;

    for (const rule of rules) {
      try {
        const match = rule.check(node, code);
        if (match) {
          findings.push({
            ruleId: rule.id,
            category: rule.category,
            title: rule.name,
            description: rule.description,
            severity: rule.severity,
            confidence: match.confidence || rule.confidence,
            status: "open",
            filePath: normalizedPath,
            startLine: match.startLine,
            endLine: match.endLine,
            redactedEvidence: match.redactedEvidence || "",
            recommendation: rule.recommendation,
            references: rule.references || [],
            source: "ast_analyzer",
            confirmed: Boolean(match.confirmed),
          });
        }
      } catch {
        // Individual rule check failure does not abort scan
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i));
    }
  }

  visit(tree.rootNode);

  return {
    findings,
    status: "completed",
  };
}

/**
 * Scans an array of source files or file tree nodes for AST-level security vulnerabilities.
 *
 * @param {Array<Object>} sourceFiles
 * @param {Object} [options]
 * @param {string} [options.extractionPath]
 * @param {Function} [options.fileFetcher]
 * @returns {Promise<{
 *   findings: Array<Object>,
 *   totalFindings: number,
 *   filesScanned: number,
 *   filesSkipped: number,
 *   unsupportedFiles: Array<Object>,
 *   errors: Array<Object>
 * }>}
 */
export async function scanRepositoryAst(sourceFiles = [], options = {}) {
  const { extractionPath = null, fileFetcher = null } = options;
  const allFindings = [];
  const unsupportedFiles = [];
  const errors = [];
  let filesScanned = 0;
  let filesSkipped = 0;

  for (const sf of sourceFiles) {
    if (!sf) {
      filesSkipped++;
      continue;
    }

    const filePath = sf.filePath || sf.path;
    if (!filePath || sf.type === "dir") {
      filesSkipped++;
      continue;
    }

    let content = sf.content || null;
    if (!content && extractionPath) {
      try {
        const fullPath = path.resolve(extractionPath, filePath);
        if (fullPath.startsWith(path.resolve(extractionPath)) && fs.existsSync(fullPath)) {
          content = fs.readFileSync(fullPath, "utf8");
        }
      } catch {
        content = null;
      }
    } else if (!content && typeof fileFetcher === "function" && sf.sha) {
      try {
        content = await fileFetcher(filePath, sf.sha);
      } catch {
        content = null;
      }
    }

    if (!content || typeof content !== "string") {
      filesSkipped++;
      continue;
    }

    const result = scanFileAst(filePath, content);

    if (result.status === "completed") {
      filesScanned++;
      if (result.findings.length > 0) {
        allFindings.push(...result.findings);
      }
    } else if (result.status === "unsupported") {
      unsupportedFiles.push({
        filePath,
        reason: result.reason,
      });
      filesSkipped++;
    } else if (result.status === "parse_error") {
      errors.push({
        filePath,
        error: result.error,
      });
      filesSkipped++;
    } else {
      filesSkipped++;
    }
  }

  return {
    findings: allFindings,
    totalFindings: allFindings.length,
    filesScanned,
    filesSkipped,
    unsupportedFiles,
    errors,
  };
}
