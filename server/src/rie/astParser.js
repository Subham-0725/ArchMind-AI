// server/src/rie/astParser.js
//
// Repository Intelligence Engine — Tree-sitter AST Parser & Aggregator
//
// Parses JavaScript, TypeScript, and Python source files across an ingested repository
// and extracts normalized structural AST metadata (imports, exports, functions, classes,
// routes, models, dependencies, and entry points).

import fs from "fs";
import path from "path";
import { parseJsTsFile } from "./parsers/jsTsParser.js";
import { parsePythonFile } from "./parsers/pythonParser.js";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB limit per file

const PARSABLE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs",
  ".ts", ".tsx",
  ".py"
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules", ".git", ".github", "dist", "build", "out", ".next",
  ".nuxt", "venv", ".venv", "__pycache__", "coverage", ".cache", "target",
  "storage", "uploads", "extracted", "scratch", "tmp", "temp", "vendor"
]);

/**
 * Returns true if the file path is noise or unparsable.
 */
function shouldParseFile(relPath, size = 0) {
  if (!relPath) return false;
  const normalized = relPath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (let i = 0; i < segments.length - 1; i++) {
    const dir = segments[i].toLowerCase();
    if (IGNORED_DIRECTORIES.has(dir) || (dir.startsWith(".") && !dir.startsWith(".github"))) {
      return false;
    }
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!PARSABLE_EXTENSIONS.has(ext)) return false;
  if (size > MAX_FILE_SIZE) return false;

  return true;
}

/**
 * Normalizes relative path resolution for internal module dependencies.
 */
function resolveInternalPath(fromFile, importSource) {
  if (!importSource.startsWith(".")) return importSource;
  const fromDir = path.posix.dirname(fromFile.replace(/\\/g, "/"));
  const resolved = path.posix.normalize(path.posix.join(fromDir, importSource));
  return resolved.replace(/^\.\//, "");
}

/**
 * Parses source code for a single file.
 *
 * @param {string} filePath - Relative path
 * @param {string} code - Source text
 * @returns {Object} Normalized single-file AST extraction
 */
export function parseFile(filePath, code) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const ext = path.extname(normalizedPath).toLowerCase();

  if (ext === ".py") {
    return parsePythonFile(normalizedPath, code);
  } else if ([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].includes(ext)) {
    return parseJsTsFile(normalizedPath, code);
  }

  throw new Error(`Unsupported extension '${ext}' for AST parsing.`);
}

/**
 * Parses an entire repository's source files into a normalized AST structure.
 *
 * @param {Array<{ path: string, type?: string, size?: number, content?: string }>} files - Sanitized file tree
 * @param {Object} options - Scanning options
 * @param {string} [options.extractionPath] - Disk root directory where files are extracted (optional)
 * @returns {Promise<Object>} Normalized AST result
 */
export async function parseRepository(files = [], options = {}) {
  const { extractionPath = null } = options;

  const result = {
    summary: {
      totalFilesParsed: 0,
      totalFilesSkipped: 0,
      errorCount: 0,
      languagesParsed: [],
    },
    files: [],
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    routes: [],
    models: [],
    dependencies: {
      internal: [],
      external: [],
    },
    entryPoints: [],
    errors: [],
  };

  const parsedLangs = new Set();

  for (const fileObj of files) {
    const relPath = typeof fileObj === "string" ? fileObj : fileObj.path;
    const fileSize = fileObj.size || 0;

    if (!relPath || (fileObj.type && fileObj.type === "dir")) {
      continue;
    }

    if (!shouldParseFile(relPath, fileSize)) {
      result.summary.totalFilesSkipped++;
      continue;
    }

    let code = fileObj.content || null;

    // Read from disk if code not attached directly and extractionPath is provided
    if (!code && extractionPath) {
      try {
        const fullPath = path.join(extractionPath, relPath);
        if (fs.existsSync(fullPath)) {
          code = fs.readFileSync(fullPath, "utf-8");
        }
      } catch (err) {
        result.errors.push({ file: relPath, error: `Failed to read file from disk: ${err.message}` });
        result.summary.errorCount++;
        continue;
      }
    }

    if (!code) {
      result.summary.totalFilesSkipped++;
      continue;
    }

    // Attempt parsing with error isolation
    try {
      const fileAst = parseFile(relPath, code);

      result.files.push({
        path: relPath,
        language: fileAst.language,
        importsCount: fileAst.imports.length,
        functionsCount: fileAst.functions.length,
        classesCount: fileAst.classes.length,
        routesCount: fileAst.routes.length,
        modelsCount: fileAst.models.length,
      });

      parsedLangs.add(fileAst.language);
      result.summary.totalFilesParsed++;

      result.imports.push(...fileAst.imports);
      result.exports.push(...fileAst.exports);
      result.functions.push(...fileAst.functions);
      result.classes.push(...fileAst.classes);
      result.routes.push(...fileAst.routes);
      result.models.push(...fileAst.models);
      result.entryPoints.push(...fileAst.entryPoints);

      // Process dependencies
      for (const imp of fileAst.imports) {
        if (imp.isInternal) {
          result.dependencies.internal.push({
            from: relPath,
            to: resolveInternalPath(relPath, imp.source),
            source: imp.source,
            specifiers: imp.specifiers,
          });
        } else {
          result.dependencies.external.push({
            from: relPath,
            package: imp.source,
            specifiers: imp.specifiers,
          });
        }
      }
    } catch (err) {
      result.errors.push({ file: relPath, error: err.message });
      result.summary.errorCount++;
    }
  }

  result.summary.languagesParsed = Array.from(parsedLangs);
  return result;
}
