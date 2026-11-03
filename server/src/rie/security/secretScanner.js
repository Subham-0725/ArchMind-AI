// server/src/rie/security/secretScanner.js
//
// Repository Intelligence Engine — Secret Scanner
//
// Scans repository source and configuration files line-by-line using deterministic
// regular expressions and heuristic rules. Produces structured findings with
// masked values so raw credentials are NEVER leaked, logged, or sent to LLM providers.

import fs from "fs";
import path from "path";
import { SECRET_PATTERNS } from "./secretPatterns.js";

/** Extensions that may contain source code or configuration files with secrets */
const SCANNABLE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs",
  ".ts", ".tsx",
  ".py", ".pyw",
  ".env", ".env.local", ".env.development", ".env.production",
  ".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".config",
  ".xml", ".properties", ".gradle",
  ".sh", ".bash", ".zsh",
  ".sql",
  ".go", ".rs", ".java", ".php", ".rb", ".cs",
]);

/** Max file size to scan for secrets (default: 500 KB to avoid memory bloat) */
const MAX_SCAN_FILE_SIZE = 500 * 1024;

/**
 * Builds a safe one-line evidence snippet by replacing the raw secret with its masked value.
 *
 * @param {string} line - Raw line text
 * @param {string} rawSecret - Secret string discovered
 * @param {string} maskedValue - Masked string representation
 * @returns {string} Truncated safe snippet
 */
function buildRedactedSnippet(line, rawSecret, maskedValue) {
  if (!line || !rawSecret) return maskedValue || "****";
  const safeLine = line.replace(rawSecret, maskedValue).trim();
  // Keep snippet bounded to max 140 chars
  if (safeLine.length > 140) {
    return safeLine.slice(0, 137) + "...";
  }
  return safeLine;
}

/**
 * Scans a string content line by line and returns detected secret findings.
 *
 * @param {string} content - Raw text content
 * @param {string} filePath - Repository-relative file path
 * @returns {Array<Object>} List of structured findings
 */
export function scanFileContent(content, filePath = "unknown") {
  if (!content || typeof content !== "string") return [];

  const findings = [];
  const lines = content.split(/\r?\n/);
  const normalizedPath = filePath.replace(/\\/g, "/");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx];
    if (!lineText || lineText.trim().length === 0) continue;

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;

      let match;
      while ((match = pattern.regex.exec(lineText)) !== null) {
        const rawSecret = pattern.captureGroup ? match[pattern.captureGroup] : match[0];
        if (!rawSecret) continue;

        // Custom filter check (e.g., skip placeholders)
        if (typeof pattern.filterFn === "function" && !pattern.filterFn(rawSecret)) {
          continue;
        }

        const maskedValue = pattern.maskFn ? pattern.maskFn(rawSecret) : "****";
        const redactedEvidence = buildRedactedSnippet(lineText, rawSecret, maskedValue);

        findings.push({
          ruleId: pattern.id,
          category: pattern.category,
          title: pattern.title || `Hardcoded ${pattern.category} Detected`,
          description: pattern.description || `Detected high-entropy pattern matching ${pattern.category}`,
          filePath: normalizedPath,
          lineNumber: lineIdx + 1,
          startLine: lineIdx + 1,
          endLine: lineIdx + 1,
          severity: pattern.severity,
          confidence: pattern.confidence,
          maskedValue,
          redactedEvidence,
          recommendation: pattern.recommendation || "Remove hardcoded credentials and load them from environment variables.",
          source: "secret_scanner",
          status: "open",
        });

        // Prevent infinite loops on zero-width matches
        if (pattern.regex.lastIndex === match.index) {
          pattern.regex.lastIndex++;
        }
      }
    }
  }

  return findings;
}

/**
 * Scans all supported files in a repository tree for secrets.
 *
 * @param {Array<Object>} tree - Sanitized repository file tree
 * @param {Object} options
 * @param {string} [options.extractionPath] - Local directory where repository files are extracted (for ZIP)
 * @param {Function} [options.fileFetcher] - Async function (filePath, sha) => Promise<string|null> (for GitHub)
 * @param {boolean} [options.scanEnvFiles=true] - Whether to inspect .env files (contents are never leaked)
 * @returns {Promise<{ findings: Array<Object>, totalFindings: number, severityCounts: Object }>}
 */
export async function scanRepositorySecrets(tree = [], options = {}) {
  const { extractionPath = null, fileFetcher = null, scanEnvFiles = true } = options;
  const allFindings = [];
  let scannedFilesCount = 0;

  const scannableFiles = (Array.isArray(tree) ? tree : []).filter((node) => {
    if (!node || node.type === "dir" || !node.path) return false;
    const ext = path.extname(node.path).toLowerCase();
    const baseName = path.basename(node.path).toLowerCase();

    if (!scanEnvFiles && baseName.startsWith(".env")) {
      return false;
    }

    const isScannable = SCANNABLE_EXTENSIONS.has(ext) || baseName.startsWith(".env");
    const withinSize = (node.size || 0) <= MAX_SCAN_FILE_SIZE;
    return isScannable && withinSize;
  });

  for (const fileNode of scannableFiles) {
    let content = fileNode.content || null;

    if (!content && extractionPath) {
      try {
        const fullPath = path.resolve(extractionPath, fileNode.path);
        if (fullPath.startsWith(path.resolve(extractionPath))) {
          if (fs.existsSync(fullPath)) {
            content = fs.readFileSync(fullPath, "utf8");
          }
        }
      } catch {
        content = null;
      }
    } else if (!content && typeof fileFetcher === "function") {
      try {
        content = await fileFetcher(fileNode.path, fileNode.sha);
      } catch {
        content = null;
      }
    }

    if (content) {
      scannedFilesCount++;
      const fileFindings = scanFileContent(content, fileNode.path);
      if (fileFindings.length > 0) {
        allFindings.push(...fileFindings);
      }
    }
  }

  // Compile severity counts
  const severityCounts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  for (const f of allFindings) {
    if (severityCounts[f.severity] !== undefined) {
      severityCounts[f.severity]++;
    }
  }

  const status = scannableFiles.length > 0 && scannedFilesCount === 0 ? "incomplete" : "completed";

  return {
    findings: allFindings,
    totalFindings: allFindings.length,
    severityCounts,
    scannedFilesCount,
    scannableFilesCount: scannableFiles.length,
    status,
  };
}
