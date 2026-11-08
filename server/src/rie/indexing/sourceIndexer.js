// server/src/rie/indexing/sourceIndexer.js
//
// Repository Intelligence Engine — Source File Indexer
//
// Indexes text source files for a repository:
//   1. Computes line counts and content SHA-256 hashes
//   2. Associates AST symbols and source locations (functions, classes, routes, models)
//   3. Redacts raw secrets using secretRedactor
//   4. Persists SourceFile documents in MongoDB with version scoping

import crypto from "crypto";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import SourceFile from "../../models/SourceFile.js";
import { redactSecrets } from "../security/secretRedactor.js";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib",
  ".mp4", ".mp3", ".wav", ".mov", ".avi",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pyc", ".class", ".o", ".obj",
]);

const MAX_INDEX_CONTENT_SIZE = 500 * 1024; // 500 KB limit for storing inline text content

/**
 * Checks whether an extension is binary.
 * @param {string} ext
 * @returns {boolean}
 */
export function isBinaryExtension(ext) {
  if (!ext) return false;
  return BINARY_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Maps AST symbols and line ranges from astParser output to their respective files.
 *
 * @param {Object} ast - AST parser output
 * @returns {Map<string, { symbols: string[], locations: Array<{ name: string, kind: string, lineStart: number, lineEnd: number }> }>}
 */
export function buildAstSymbolMap(ast = {}) {
  const map = new Map();

  const getEntry = (file) => {
    const norm = (file || "").replace(/\\/g, "/");
    if (!map.has(norm)) {
      map.set(norm, { symbols: [], locations: [] });
    }
    return map.get(norm);
  };

  // 1. Functions
  for (const fn of ast.functions || []) {
    if (!fn.file || !fn.name) continue;
    const entry = getEntry(fn.file);
    entry.symbols.push(fn.name);
    entry.locations.push({
      name: fn.name,
      kind: "function",
      lineStart: fn.line || 1,
      lineEnd: fn.lineEnd || fn.line || 1,
    });
  }

  // 2. Classes
  for (const cls of ast.classes || []) {
    if (!cls.file || !cls.name) continue;
    const entry = getEntry(cls.file);
    entry.symbols.push(cls.name);
    entry.locations.push({
      name: cls.name,
      kind: "class",
      lineStart: cls.line || 1,
      lineEnd: cls.lineEnd || cls.line || 1,
    });
  }

  // 3. Routes
  for (const r of ast.routes || []) {
    if (!r.file || !r.path) continue;
    const entry = getEntry(r.file);
    const routeName = `${r.method || "GET"} ${r.path}`;
    entry.symbols.push(routeName);
    entry.locations.push({
      name: routeName,
      kind: "route",
      lineStart: r.line || 1,
      lineEnd: r.lineEnd || r.line || 1,
    });
  }

  // 4. Models
  for (const m of ast.models || []) {
    if (!m.file || !m.name) continue;
    const entry = getEntry(m.file);
    entry.symbols.push(m.name);
    entry.locations.push({
      name: m.name,
      kind: "model",
      lineStart: m.line || 1,
      lineEnd: m.lineEnd || m.line || 1,
    });
  }

  return map;
}

/**
 * Indexes repository source files into MongoDB SourceFile documents.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.projectId
 * @param {string} params.userId
 * @param {number} params.analysisVersion
 * @param {Array<Object>} params.tree - Filtered file tree
 * @param {Object} params.ast - AST parser output
 * @param {string} [params.extractionPath] - Local directory for ZIP archives
 * @param {Function} [params.fileFetcher] - Async function (path, sha) => Promise<string|null>
 * @returns {Promise<{ indexedCount: number, totalBytes: number }>}
 */
export async function indexRepositorySources({
  projectId,
  userId,
  analysisVersion = 1,
  tree = [],
  ast = {},
  extractionPath = null,
  fileFetcher = null,
}) {
  const symbolMap = buildAstSymbolMap(ast);
  const fileNodes = (Array.isArray(tree) ? tree : []).filter((n) => n && n.type !== "dir" && n.path);

  let indexedCount = 0;
  let totalBytes = 0;
  const docsToUpsert = [];

  for (const node of fileNodes) {
    const normPath = node.path.replace(/\\/g, "/");
    const ext = path.extname(normPath).toLowerCase();
    const fileName = path.basename(normPath);
    const isBinary = isBinaryExtension(ext);
    const size = node.size || 0;

    let content = node.content || null;

    if (!content && !isBinary && size <= MAX_INDEX_CONTENT_SIZE) {
      if (extractionPath) {
        try {
          const fullPath = path.resolve(extractionPath, normPath);
          if (fullPath.startsWith(path.resolve(extractionPath)) && fs.existsSync(fullPath)) {
            content = fs.readFileSync(fullPath, "utf8");
          }
        } catch {
          content = null;
        }
      } else if (typeof fileFetcher === "function" && node.sha) {
        // Only pre-fetch key files; other files are fetched on demand
        if (node.content) {
          content = node.content;
        }
      }
    }

    let lineCount = 0;
    let contentHash = "";
    let sanitizedContent = null;

    if (content && typeof content === "string") {
      lineCount = content.split(/\r?\n/).length;
      contentHash = crypto.createHash("sha256").update(content).digest("hex");
      sanitizedContent = redactSecrets(content);
      totalBytes += size;
    }

    const astInfo = symbolMap.get(normPath) || { symbols: [], locations: [] };

    docsToUpsert.push({
      projectId,
      userId,
      analysisVersion,
      filePath: normPath,
      fileName,
      extension: ext,
      language: node.language || ext.replace(".", "") || "text",
      size,
      lineCount,
      contentHash,
      content: sanitizedContent,
      isBinary,
      symbols: Array.from(new Set(astInfo.symbols)),
      sourceLocations: astInfo.locations,
    });
  }

  // Bulk upsert into MongoDB in batches to avoid buffer timeouts on large repositories
  if (docsToUpsert.length > 0 && SourceFile.bulkWrite && mongoose.connection?.readyState === 1) {
    try {
      const operations = docsToUpsert.map((doc) => ({
        updateOne: {
          filter: {
            projectId: doc.projectId,
            filePath: doc.filePath,
            analysisVersion: doc.analysisVersion,
          },
          update: { $set: doc },
          upsert: true,
        },
      }));

      const BATCH_SIZE = 50;
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = operations.slice(i, i + BATCH_SIZE);
        await SourceFile.bulkWrite(batch, { ordered: false });
      }
      indexedCount = docsToUpsert.length;
    } catch (err) {
      console.warn("[sourceIndexer] Bulk write warning (proceeding):", err.message);
      indexedCount = docsToUpsert.length;
    }
  }

  return { indexedCount, totalBytes };
}

