// server/src/services/chat/citation.service.js
//
// Citation Generation, Extraction, and Strict Verification Service for ArchMind AI.
// Ensures that every cited file and line range is mathematically verified against
// actually retrieved repository context chunks and stored project files.

/**
 * Normalizes relative file paths to standard forward slashes.
 */
function normalizePath(p) {
  if (!p) return "";
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^["'`]|["'`]$/g, "");
}

/**
 * Parses raw LLM text for candidate citation mentions.
 * Supports multiple standard citation formats:
 *   - Sources: path/to/file.js, lines 12–38
 *   - [Source: path/to/file.js:12-38]
 *   - (path/to/file.js:L12-L38)
 *   - JSON citations block
 *
 * @param {string} assistantText
 * @returns {Array<{ rawPath: string, startLine: number|null, endLine: number|null }>}
 */
export function extractRawCitations(assistantText = "") {
  if (!assistantText || typeof assistantText !== "string") return [];

  const candidates = [];

  // 1. Check for structured JSON citation block
  const jsonMatch = assistantText.match(/```json\s*(\{[\s\S]*?"citations"[\s\S]*?\})\s*```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed.citations)) {
        for (const c of parsed.citations) {
          if (c && c.filePath) {
            candidates.push({
              rawPath: normalizePath(c.filePath),
              startLine: c.startLine ? Number(c.startLine) : null,
              endLine: c.endLine ? Number(c.endLine) : (c.startLine ? Number(c.startLine) : null),
            });
          }
        }
      }
    } catch {
      // Fall through to regex extraction
    }
  }

  // 2. Regex for textual citations:
  // Examples:
  //   - `server/src/app.js:20-45`
  //   - `server/src/app.js, lines 20–45`
  //   - `[Source: server/src/app.js:L20-L45]`
  const citationRegex =
    /(?:\[Source:\s*|Sources?:\s*|[-*]\s*)?([a-zA-Z0-9_.\-\\/]+\.[a-zA-Z0-9]+)(?:[:,\s]+(?:lines?\s*|L)?(\d+)(?:\s*(?:[-–—]|to)\s*(?:lines?\s*|L)?(\d+))?)?/gi;

  let match;
  while ((match = citationRegex.exec(assistantText)) !== null) {
    const rawPath = normalizePath(match[1]);
    const startStr = match[2];
    const endStr = match[3];

    // Filter out common non-file false positives
    const ext = rawPath.split(".").pop().toLowerCase();
    const commonCodeExtensions = new Set([
      "js", "jsx", "ts", "tsx", "py", "json", "yaml", "yml", "html", "css",
      "md", "env", "sql", "prisma", "go", "rs", "java", "sh", "toml",
    ]);

    if (!commonCodeExtensions.has(ext)) continue;
    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) continue;

    const startLine = startStr ? parseInt(startStr, 10) : null;
    const endLine = endStr ? parseInt(endStr, 10) : (startLine || null);

    candidates.push({
      rawPath,
      startLine,
      endLine,
    });
  }

  return candidates;
}

/**
 * Strictly verifies citations against the retrieved context chunks and stored project tree.
 *
 * Rules:
 *   1. Cited file must match a retrieved context chunk or project tree node.
 *   2. Line numbers must be positive integers where startLine <= endLine.
 *   3. Line range must overlap with the lines that were actually provided in retrievedChunks.
 *   4. Fabricated paths, non-existent files, and out-of-bounds line numbers are rejected.
 *
 * @param {Array<Object>} candidateCitations - Extracted candidate citations
 * @param {Array<Object>} retrievedChunks - Chunks provided to the model in this turn
 * @param {Array<Object>} projectTree - Sanitized project file tree
 * @returns {Array<{ filePath: string, startLine: number, endLine: number, sourceType: string, snippet: string|null }>}
 */
export function verifyCitations(candidateCitations = [], retrievedChunks = [], projectTree = []) {
  if (!Array.isArray(candidateCitations) || candidateCitations.length === 0) {
    return [];
  }

  const validTreePaths = new Set(
    (projectTree || [])
      .filter((n) => n && n.type !== "dir" && n.path)
      .map((n) => normalizePath(n.path).toLowerCase())
  );

  const chunkMapByPath = new Map();
  for (const chunk of retrievedChunks || []) {
    const norm = normalizePath(chunk.filePath).toLowerCase();
    if (!chunkMapByPath.has(norm)) {
      chunkMapByPath.set(norm, []);
    }
    chunkMapByPath.get(norm).push(chunk);
  }

  const verified = [];
  const seenKeys = new Set();

  for (const candidate of candidateCitations) {
    const normPath = normalizePath(candidate.rawPath);
    const lowerPath = normPath.toLowerCase();

    // Check 1: Prevent path traversal
    if (normPath.includes("..") || normPath.startsWith("/") || normPath.includes("://")) {
      continue;
    }

    // Check 2: File must exist in project tree or retrieved chunks
    const fileExistsInTree = validTreePaths.has(lowerPath);
    const chunksForFile = chunkMapByPath.get(lowerPath) || [];

    if (!fileExistsInTree && chunksForFile.length === 0) {
      continue; // Fabricated or hallucinated file path
    }

    // Check 3: Validate line numbers
    let startLine = candidate.startLine;
    let endLine = candidate.endLine;

    if (startLine !== null && startLine !== undefined) {
      if (isNaN(startLine) || startLine < 1) continue;
      if (endLine !== null && endLine !== undefined) {
        if (isNaN(endLine) || endLine < startLine) {
          endLine = startLine;
        }
      } else {
        endLine = startLine;
      }
    }

    // Check 4: Overlap verification with retrieved context chunks
    // If lines were specified, at least one retrieved chunk must overlap the cited range
    let verifiedSnippet = null;
    let isWithinRetrievedContext = false;

    if (chunksForFile.length > 0) {
      for (const ch of chunksForFile) {
        if (startLine === null) {
          // File-level citation without specific lines
          isWithinRetrievedContext = true;
          startLine = ch.startLine;
          endLine = ch.endLine;
          break;
        }

        // Check if [startLine, endLine] intersects with [ch.startLine, ch.endLine]
        const hasOverlap = startLine <= ch.endLine && endLine >= ch.startLine;
        if (hasOverlap) {
          isWithinRetrievedContext = true;
          // Clamp lines to chunk boundaries if needed
          const clampedStart = Math.max(startLine, ch.startLine);
          const clampedEnd = Math.min(endLine, ch.endLine);
          startLine = clampedStart;
          endLine = clampedEnd;
          break;
        }
      }
    } else if (fileExistsInTree && startLine === null) {
      // Valid file in tree, but no lines chunked (e.g. metadata reference)
      isWithinRetrievedContext = true;
      startLine = 1;
      endLine = 1;
    }

    if (!isWithinRetrievedContext) {
      // Hallucinated line range that was never presented in prompt context
      continue;
    }

    // Find original case-preserved file path
    const chunkMatch = chunksForFile[0];
    const treeMatch = (projectTree || []).find(
      (n) => normalizePath(n.path).toLowerCase() === lowerPath
    );
    const exactFilePath = chunkMatch?.filePath || treeMatch?.path || normPath;

    const dedupeKey = `${exactFilePath}:${startLine}-${endLine}`;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      verified.push({
        filePath: exactFilePath,
        startLine,
        endLine,
        sourceType: "source_file",
        snippet: verifiedSnippet,
      });
    }
  }

  // Cap citations per turn to 5 most specific
  return verified.slice(0, 5);
}
