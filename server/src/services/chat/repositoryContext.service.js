// server/src/services/chat/repositoryContext.service.js
//
// Optimized Repository Context Retrieval Service for ArchMind AI Chat.
// Implements two-phase database querying (metadata-first, lazy content fetching),
// intent-based relevance weighting, cached analysis context, and bounded chunking.

import SourceFile from "../../models/SourceFile.js";
import { redactSecrets } from "../../rie/security/secretRedactor.js";

const DEFAULT_CONFIG = {
  maxRetrievedFiles: 6,
  maxChunks: 10,
  maxLinesPerChunk: 80,
  maxContextCharacters: 18000, // ~4,500 tokens optimal budget
};

// In-memory cache for analysis context keyed by `${projectId}:${analysisVersion}`
const analysisContextCache = new Map();
const CACHE_MAX_ENTRIES = 50;

const COMMON_STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "s", "same", "she",
  "should", "so", "some", "such", "t", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself", "yourselves",
  "code", "project", "repo", "repository", "file", "files", "show", "tell", "explain", "find",
]);

/**
 * Extracts normalized search terms from a natural language question.
 */
export function extractQueryKeywords(question = "") {
  if (!question || typeof question !== "string") return [];
  const normalized = question
    .toLowerCase()
    .replace(/[^a-z0-9_.\-/]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !COMMON_STOP_WORDS.has(word));

  return Array.from(new Set(normalized));
}

/**
 * Detects topic intent to boost domain-specific source files and analysis artifacts.
 */
export function detectQueryIntent(question = "", keywords = []) {
  const qLower = question.toLowerCase();
  const kwSet = new Set(keywords);

  const isDatabase =
    qLower.includes("model") ||
    qLower.includes("schema") ||
    qLower.includes("entity") ||
    qLower.includes("database") ||
    qLower.includes("mongo") ||
    qLower.includes("mongoose") ||
    qLower.includes("table") ||
    qLower.includes("field") ||
    kwSet.has("model") ||
    kwSet.has("models");

  const isApi =
    qLower.includes("api") ||
    qLower.includes("route") ||
    qLower.includes("endpoint") ||
    qLower.includes("controller") ||
    qLower.includes("handler") ||
    qLower.includes("request") ||
    kwSet.has("routes") ||
    kwSet.has("apis");

  const isAuth =
    qLower.includes("auth") ||
    qLower.includes("login") ||
    qLower.includes("token") ||
    qLower.includes("jwt") ||
    qLower.includes("clerk") ||
    qLower.includes("protect") ||
    qLower.includes("permission");

  const isArchitecture =
    qLower.includes("architecture") ||
    qLower.includes("structure") ||
    qLower.includes("topology") ||
    qLower.includes("overview") ||
    qLower.includes("flow");

  return { isDatabase, isApi, isAuth, isArchitecture };
}

/**
 * Fast metadata scoring without loading full file contents into memory.
 */
function scoreFileMetadata(file, keywords, intent) {
  let score = 0;
  const pathLower = (file.filePath || "").toLowerCase();
  const nameLower = (file.fileName || "").toLowerCase();
  const symbolsLower = (file.symbols || []).map((s) => String(s).toLowerCase());

  // 1. Keyword Matches in Path / Name
  for (const kw of keywords) {
    if (nameLower === kw || nameLower === `${kw}.js` || nameLower === `${kw}.ts` || nameLower === `${kw}.py`) {
      score += 25;
    } else if (nameLower.includes(kw)) {
      score += 15;
    } else if (pathLower.includes(kw)) {
      score += 10;
    }

    // Symbol matches
    if (symbolsLower.some((sym) => sym.includes(kw))) {
      score += 12;
    }
  }

  // 2. Domain Intent Boosts
  if (intent.isDatabase) {
    if (pathLower.includes("model") || pathLower.includes("schema") || pathLower.includes("entity")) {
      score += 20;
    }
  }

  if (intent.isApi) {
    if (pathLower.includes("route") || pathLower.includes("controller") || pathLower.includes("api")) {
      score += 20;
    }
  }

  if (intent.isAuth) {
    if (pathLower.includes("auth") || pathLower.includes("middleware") || pathLower.includes("session")) {
      score += 20;
    }
  }

  // 3. Structural Significance Bonus
  if (pathLower.includes("server.js") || pathLower.includes("app.js") || pathLower.includes("main.py")) {
    score += 5;
  }

  return score;
}

/**
 * Chunks a single file into bounded line ranges containing relevant content.
 */
export function chunkFileContent(file, keywords, maxLines = 80) {
  if (!file || !file.content || typeof file.content !== "string") return [];

  const rawLines = file.content.split(/\r?\n/);
  const totalLines = rawLines.length;

  if (totalLines <= maxLines) {
    return [
      {
        filePath: file.filePath,
        startLine: 1,
        endLine: totalLines,
        content: file.content,
        sourceType: "source_file",
      },
    ];
  }

  // Find line indices where keywords appear
  const matchingLineIndices = [];
  rawLines.forEach((lineText, idx) => {
    const l = lineText.toLowerCase();
    if (keywords.some((kw) => l.includes(kw))) {
      matchingLineIndices.push(idx + 1); // 1-based
    }
  });

  const chunks = [];

  if (matchingLineIndices.length > 0) {
    const firstMatch = matchingLineIndices[0];
    const half = Math.floor(maxLines / 2);
    const startLine = Math.max(1, firstMatch - half);
    const endLine = Math.min(totalLines, startLine + maxLines - 1);

    const chunkLines = rawLines.slice(startLine - 1, endLine);
    chunks.push({
      filePath: file.filePath,
      startLine,
      endLine,
      content: chunkLines.join("\n"),
      sourceType: "source_file",
    });

    // Check for another distinct match cluster further down
    const laterMatches = matchingLineIndices.filter((line) => line > endLine + 10);
    if (laterMatches.length > 0) {
      const secondMatch = laterMatches[0];
      const startLine2 = Math.max(1, secondMatch - half);
      const endLine2 = Math.min(totalLines, startLine2 + maxLines - 1);
      const chunkLines2 = rawLines.slice(startLine2 - 1, endLine2);
      chunks.push({
        filePath: file.filePath,
        startLine: startLine2,
        endLine: endLine2,
        content: chunkLines2.join("\n"),
        sourceType: "source_file",
      });
    }
  } else {
    // Fallback: chunk from beginning of file
    const chunkLines = rawLines.slice(0, maxLines);
    chunks.push({
      filePath: file.filePath,
      startLine: 1,
      endLine: Math.min(totalLines, maxLines),
      content: chunkLines.join("\n"),
      sourceType: "source_file",
    });
  }

  return chunks;
}

/**
 * Extracts and caches structured analysis artifacts from the Project document.
 */
export function extractAnalysisContext(project, keywords) {
  const cacheKey = `${project._id}:${project.analysisVersion || 1}`;
  if (analysisContextCache.has(cacheKey)) {
    return analysisContextCache.get(cacheKey);
  }

  const analysisContext = {};

  // 1. Tech Stack & Capabilities
  analysisContext.techStack = {
    primaryLanguage: project.primaryLanguage || project.blueprint?.metadata?.primaryLanguage || "Unknown",
    languages: project.techStack?.languages || project.secondaryLanguages || [],
    frameworks: project.techStack?.frameworks || [],
    databases: project.techStack?.databases || [],
    devops: project.techStack?.devops || [],
    capabilities: project.capabilities || {},
  };

  // 2. Database Schema (Entities & Relationships)
  const dbEntities = project.database?.entities || project.analysisResults?.erd?.entities || [];
  if (dbEntities.length > 0) {
    analysisContext.database = {
      type: project.database?.type || "MongoDB / Mongoose",
      totalEntities: dbEntities.length,
      entities: dbEntities.map((e) => ({
        name: e.name,
        sourceFile: e.sourceFile || null,
        fields: (e.fields || []).map((f) => ({
          name: f.name,
          type: f.type || "String",
          isPrimary: Boolean(f.isPrimary),
          isForeign: Boolean(f.isForeign),
          isRequired: Boolean(f.isRequired),
          details: f.references ? `Ref: ${f.references}` : f.isRequired ? "Required" : "",
        })),
      })),
    };
  }

  // 3. API Routes
  const apiRoutes = project.analysisResults?.apiRoutes || project.blueprint?.routes || [];
  if (apiRoutes.length > 0) {
    analysisContext.apiRoutes = {
      totalRoutes: apiRoutes.length,
      routes: apiRoutes.slice(0, 15).map((r) => ({
        method: r.method,
        path: r.path,
        framework: r.framework,
        sourceFile: r.sourceFile,
        lineRange: r.lineRange || null,
        isAuthProtected: r.isAuthProtected,
      })),
    };
  }

  // 4. Architecture Topology
  const topologyNodes = project.analysisResults?.architecture?.nodes || project.topology?.nodes || [];
  const topologyEdges = project.analysisResults?.architecture?.edges || project.topology?.edges || [];
  if (topologyNodes.length > 0) {
    analysisContext.architecture = {
      nodes: topologyNodes.slice(0, 10).map((n) => ({
        id: n.id,
        label: n.data?.label || n.id,
        tier: n.data?.tier || "service",
        technology: n.data?.technology || null,
      })),
      edges: topologyEdges.slice(0, 10).map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label || null,
      })),
    };
  }

  // 5. Security Findings
  const securityFindings = project.securityFindings || project.analysisResults?.securityFindings || [];
  const securitySummary = project.securitySummary || project.analysisResults?.securitySummary;
  if (securitySummary || securityFindings.length > 0) {
    analysisContext.security = {
      totalFindings: securitySummary?.totalFindings ?? securityFindings.length,
      severityCounts: securitySummary?.severityCounts || {},
      findings: securityFindings.slice(0, 10).map((f) => ({
        category: f.category,
        filePath: f.filePath,
        lineNumber: f.lineNumber,
        severity: f.severity,
      })),
    };
  }

  // Manage Cache Size
  if (analysisContextCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = analysisContextCache.keys().next().value;
    analysisContextCache.delete(firstKey);
  }
  analysisContextCache.set(cacheKey, analysisContext);

  return analysisContext;
}

/**
 * Optimized Two-Phase Context Retrieval with Sub-Stage Instrumentation.
 */
export async function retrieveRepositoryContext({ project, question, options = {} }) {
  if (!project || !project._id) {
    throw new Error("A valid project document is required for context retrieval.");
  }

  const config = { ...DEFAULT_CONFIG, ...options };
  const keywords = extractQueryKeywords(question);
  const intent = detectQueryIntent(question, keywords);

  // ── PHASE 1: Fast Metadata Retrieval (No heavy content payload) ─────────────
  const tMetaStart = performance.now();
  const fileMetadatas = await SourceFile.find({
    projectId: project._id,
    isBinary: false,
  })
    .select("_id filePath fileName extension language size lineCount symbols")
    .lean();
  const metadataRetrievalMs = Number((performance.now() - tMetaStart).toFixed(2));

  // ── PHASE 2: Intent-Aware Scoring & Top Candidates Selection ────────────────
  const tScoreStart = performance.now();
  const scoredFiles = fileMetadatas
    .map((file) => ({
      file,
      score: scoreFileMetadata(file, keywords, intent),
    }))
    .filter((item) => item.score > 0 || fileMetadatas.length <= config.maxRetrievedFiles)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxRetrievedFiles)
    .map((item) => item.file);

  const topFileIds = scoredFiles.map((f) => f._id);
  const contextRankingMs = Number((performance.now() - tScoreStart).toFixed(2));

  // ── PHASE 3: Targeted Content Fetching (Only top scored files) ──────────────
  const tContentStart = performance.now();
  let fullFiles = [];
  if (topFileIds.length > 0) {
    fullFiles = await SourceFile.find({
      projectId: project._id,
      _id: { $in: topFileIds },
    })
      .select("filePath fileName content")
      .lean();
  }
  const contentFetchMs = Number((performance.now() - tContentStart).toFixed(2));
  const contextRetrievalMs = Number((metadataRetrievalMs + contentFetchMs).toFixed(2));

  // ── PHASE 4: Deduplicated Chunking ─────────────────────────────────────────
  const allChunks = [];
  const seenRanges = new Set();

  for (const file of fullFiles) {
    if (allChunks.length >= config.maxChunks) break;
    const fileChunks = chunkFileContent(file, keywords, config.maxLinesPerChunk);
    for (const chunk of fileChunks) {
      if (allChunks.length >= config.maxChunks) break;
      const rangeKey = `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`;
      if (!seenRanges.has(rangeKey)) {
        seenRanges.add(rangeKey);
        allChunks.push(chunk);
      }
    }
  }

  // ── PHASE 5: Context Assembly with Intent Priority ─────────────────────────
  const analysisContext = extractAnalysisContext(project, keywords);
  const formattedSections = [];

  // Metadata Header
  formattedSections.push(`=== REPOSITORY METADATA ===
Name: ${project.name}
Primary Language: ${analysisContext.techStack.primaryLanguage}
Frameworks: ${analysisContext.techStack.frameworks.join(", ") || "None"}
Databases: ${analysisContext.techStack.databases.join(", ") || "None"}`);

  // If Database Intent: Provide detailed Markdown table format for models
  if (analysisContext.database && (intent.isDatabase || !intent.isApi)) {
    const modelBlocks = analysisContext.database.entities.map((e) => {
      const fieldRows = e.fields.map(
        (f) => `| \`${f.name}\` | \`${f.type}\` | ${f.details || (f.isPrimary ? "Primary Key" : "Standard Field")} |`
      );
      return `### Model: ${e.name}
Source: ${e.sourceFile || "inferred"}
| Field | Type | Details |
|---|---|---|
${fieldRows.join("\n")}`;
    });

    formattedSections.push(`=== DATABASE SCHEMAS & MODELS (${analysisContext.database.type}) ===
${modelBlocks.join("\n\n")}`);
  }

  // If API Intent: Provide endpoints summary
  if (analysisContext.apiRoutes && (intent.isApi || !intent.isDatabase)) {
    const routesStr = analysisContext.apiRoutes.routes
      .map(
        (r) =>
          `- ${r.method} ${r.path} [${r.framework || "REST"}] (${r.sourceFile || "route"}${
            r.lineRange ? `:L${r.lineRange.startLine}-L${r.lineRange.endLine}` : ""
          }) ${r.isAuthProtected ? "[Auth Protected]" : "[Public]"}`
      )
      .join("\n");
    formattedSections.push(`=== API ENDPOINTS (${analysisContext.apiRoutes.totalRoutes} total) ===\n${routesStr}`);
  }

  // Architecture Topology
  if (analysisContext.architecture && (intent.isArchitecture || (!intent.isDatabase && !intent.isApi))) {
    const nodesStr = analysisContext.architecture.nodes
      .map((n) => `- [${n.tier}] ${n.label} (${n.technology || "Generic"})`)
      .join("\n");
    formattedSections.push(`=== ARCHITECTURE TOPOLOGY ===\n${nodesStr}`);
  }

  // Security Findings
  if (analysisContext.security && (intent.isAuth || (!intent.isDatabase && !intent.isApi))) {
    const findingsStr = analysisContext.security.findings
      .map((f) => `- [${f.severity}] ${f.category} in ${f.filePath}${f.lineNumber ? `:${f.lineNumber}` : ""}`)
      .join("\n");
    formattedSections.push(`=== SECURITY FINDINGS (${analysisContext.security.totalFindings} total) ===\n${findingsStr}`);
  }

  // Source Snippets
  if (allChunks.length > 0) {
    const codeSnippets = allChunks.map(
      (c) => `--- File: ${c.filePath} (Lines ${c.startLine}–${c.endLine}) ---
${c.content}
------------------------------------------------`
    );
    formattedSections.push(`=== RELEVANT SOURCE CODE EXCERPTS ===\n${codeSnippets.join("\n\n")}`);
  }

  let rawContext = formattedSections.join("\n\n");
  if (rawContext.length > config.maxContextCharacters) {
    rawContext = rawContext.slice(0, config.maxContextCharacters) + "\n\n[Context truncated to fit token budget]";
  }

  const sanitizedContext = redactSecrets(rawContext);

  return {
    chunks: allChunks,
    analysisContext,
    keywords,
    intent,
    formattedContext: sanitizedContext,
    timings: {
      metadataRetrievalMs,
      contextRankingMs,
      contentFetchMs,
      contextRetrievalMs,
    },
  };
}
