// server/src/rie/pipeline/analysisPipeline.js
//
// Repository Intelligence Engine — Unified Analysis Pipeline
//
// Standardizes the entire ingestion and static intelligence workflow across both
// ZIP archive uploads and GitHub repository imports:
//
//   Ingestion (ZIP / GitHub)
//             │
//             ▼
//   Repository Normalization
//             │
//             ▼
//   Multi-tier File Filtering & Tree Sanitization
//             │
//             ▼
//   Secret Scanning & Pattern Detection
//             │
//             ▼
//   Language & Framework Detection
//             │
//             ▼
//   System Topology Construction
//             │
//             ▼
//   Capabilities & Relevance Matrix Detection
//             │
//             ▼
//   Tree-sitter AST & Database Model Extraction
//             │
//             ▼
//   Source File Indexing (Traceability & Monaco Retrieval)
//             │
//             ▼
//   Repository Blueprint Aggregation
//             │
//             ▼
//   Strict Blueprint Schema Validation
//             │
//             ▼
//   Versioned Analysis Persistence

import mongoose from "mongoose";
import { scanRepositorySecrets } from "../security/secretScanner.js";
import { scanRepositoryAst } from "../security/astSecurityScanner.js";
import SecurityFinding from "../../models/SecurityFinding.js";
import SecurityAudit from "../../models/SecurityAudit.js";
import { detectProjectLanguage } from "../../services/languageDetector.js";
import { buildTopology } from "../topologyBuilder.js";
import { detectCapabilities } from "../relevanceDetector.js";
import { parseRepository } from "../astParser.js";
import { extractApiRoutes } from "../api/routeExtractor.js";
import { extractDatabaseSchema } from "../dbSchemaExtractor.js";
import { indexRepositorySources } from "../indexing/sourceIndexer.js";
import { aggregateBlueprint } from "../blueprintAggregator.js";
import { validateBlueprint } from "../validation/blueprintValidator.js";

/**
 * Executes the unified RIE analysis pipeline for an ingested codebase.
 *
 * @param {Object} params
 * @param {string} params.name - Project display name
 * @param {string} params.source - "zip" | "github"
 * @param {string} params.userId - Clerk user ID
 * @param {string|mongoose.Types.ObjectId} [params.projectId] - MongoDB Project ID
 * @param {Array<Object>} params.tree - Filtered file tree
 * @param {Object} params.stats - File count, byte size, top extensions
 * @param {string} params.sourceFingerprint - SHA hash of archive or Git commit/tree SHA
 * @param {number} [params.analysisVersion=1] - Incremental analysis version
 * @param {string} [params.extractionPath=null] - Local directory (for ZIP)
 * @param {Function} [params.fileFetcher=null] - Async (path, sha) file loader (for GitHub)
 * @param {Object} [params.extraMetadata={}] - Provider-specific metadata (branch, repoUrl, etc.)
 * @returns {Promise<Object>} Normalized analysis output ready for MongoDB persistence
 */
export async function executeRiePipeline({
  name,
  source,
  userId,
  projectId = null,
  tree = [],
  stats = {},
  sourceFingerprint,
  analysisVersion = 1,
  extractionPath = null,
  fileFetcher = null,
  extraMetadata = {},
}) {
  const tPipelineStart = performance.now();
  console.log(`[RIE Pipeline] Starting local static analysis for '${name}' (${source})...`);

  // 1. Repository Normalization: sanitize tree entries
  const normalizedTree = (Array.isArray(tree) ? tree : []).map((node) => ({
    path: (node.path || "").replace(/\\/g, "/"),
    type: node.type || "file",
    size: typeof node.size === "number" ? node.size : 0,
    sha: node.sha || null,
    content: node.content || null,
  }));

  // 2. Secret Scanning (deterministic regex & entropy checks)
  const tSecretStart = performance.now();
  const secretResults = await scanRepositorySecrets(normalizedTree, {
    extractionPath,
    fileFetcher,
  });
  const tSecretDuration = ((performance.now() - tSecretStart) / 1000).toFixed(2);
  console.log(
    `[RIE Pipeline] [Stage: Secrets] Scanned in ${tSecretDuration}s. Found ${secretResults.findings?.length || 0} secrets across ${secretResults.scannedFilesCount || 0} files.`
  );

  // 3. Static Language & Framework Detection
  const tLangStart = performance.now();
  const langResult = detectProjectLanguage(normalizedTree, extractionPath);

  const techStack = {
    languages: langResult.primaryLanguage
      ? Array.from(new Set([langResult.primaryLanguage, ...(langResult.secondaryLanguages || [])]))
      : [],
    frameworks: langResult.frameworks || [],
    databases: [],
    devops: [],
  };

  // 4. Smart Relevance & Capability Matrix
  const capabilities = detectCapabilities(normalizedTree, techStack, extractionPath);

  // Merge detected framework and database details into techStack
  if (capabilities?.details?.frameworks) {
    techStack.frameworks = Array.from(new Set([...techStack.frameworks, ...capabilities.details.frameworks]));
  }
  if (capabilities?.details?.databases) {
    techStack.databases = Array.from(new Set([...techStack.databases, ...capabilities.details.databases]));
  }
  const tLangDuration = ((performance.now() - tLangStart) / 1000).toFixed(2);
  console.log(
    `[RIE Pipeline] [Stage: Language/Stack] Completed in ${tLangDuration}s. Primary: ${langResult.primaryLanguage || "None"}, Frameworks: ${techStack.frameworks.join(", ") || "None"}`
  );

  // 5. Tree-sitter AST & Symbol Parsing
  const tAstStart = performance.now();
  const ast = await parseRepository(normalizedTree, { extractionPath });

  // 5.5 Tree-sitter AST Security Inspection
  const astSecurityResults = await scanRepositoryAst(normalizedTree, {
    extractionPath,
    fileFetcher,
  });
  const tAstDuration = ((performance.now() - tAstStart) / 1000).toFixed(2);
  console.log(
    `[RIE Pipeline] [Stage: AST & Security] Parsed in ${tAstDuration}s. AST Security Findings: ${astSecurityResults.findings?.length || 0}`
  );

  // Combine secret findings & AST security findings
  const combinedSecurityFindings = [...secretResults.findings, ...astSecurityResults.findings];
  const combinedSeverityCounts = {
    Critical: (secretResults.severityCounts.Critical || 0) + (astSecurityResults.findings.filter((f) => f.severity === "Critical").length),
    High: (secretResults.severityCounts.High || 0) + (astSecurityResults.findings.filter((f) => f.severity === "High").length),
    Medium: (secretResults.severityCounts.Medium || 0) + (astSecurityResults.findings.filter((f) => f.severity === "Medium").length),
    Low: (secretResults.severityCounts.Low || 0) + (astSecurityResults.findings.filter((f) => f.severity === "Low").length),
  };

  if (projectId && mongoose.connection?.readyState === 1) {
    try {
      await SecurityFinding.deleteMany({ projectId, analysisVersion });
      if (combinedSecurityFindings.length > 0) {
        await SecurityFinding.insertMany(
          combinedSecurityFindings.map((f) => ({
            ...f,
            projectId,
            analysisVersion,
          }))
        );
      }
      await SecurityAudit.findOneAndUpdate(
        { projectId, analysisVersion },
        {
          projectId,
          analysisVersion,
          status: "completed",
          completedAt: new Date(),
          totalFindings: combinedSecurityFindings.length,
          severityCounts: combinedSeverityCounts,
          filesScanned: (secretResults.scannedFilesCount || 0) + (astSecurityResults.filesScanned || 0),
          filesSkipped: (secretResults.scannableFilesCount || 0) - (secretResults.scannedFilesCount || 0) + (astSecurityResults.filesSkipped || 0),
          unsupportedFilesCount: astSecurityResults.unsupportedFiles?.length || 0,
          unsupportedFiles: astSecurityResults.unsupportedFiles || [],
          errors: astSecurityResults.errors || [],
        },
        { upsert: true }
      );
    } catch (persistErr) {
      console.warn("[analysisPipeline] Security persistence warning:", persistErr.message);
    }
  }

  // 6. Dedicated API Route Extraction (Express, Fastify, NestJS, FastAPI, Flask, Django)
  const tApiStart = performance.now();
  const apiRouteResults = await extractApiRoutes(normalizedTree, {
    extractionPath,
    fileFetcher,
    ast,
  });

  if (apiRouteResults.frameworks?.length > 0) {
    techStack.frameworks = Array.from(new Set([...techStack.frameworks, ...apiRouteResults.frameworks]));
  }
  const tApiDuration = ((performance.now() - tApiStart) / 1000).toFixed(2);
  console.log(
    `[RIE Pipeline] [Stage: API Routes] Extracted in ${tApiDuration}s. Found ${apiRouteResults.routes?.length || 0} routes.`
  );

  // 7. Database Schema Extraction (Prisma, Mongoose, SQLAlchemy, Django, TypeORM, etc.)
  const tDbStart = performance.now();
  const database = extractDatabaseSchema(normalizedTree, capabilities, techStack, extractionPath);
  if (database?.type && database.type !== "Unknown") {
    techStack.databases = Array.from(new Set([...techStack.databases, database.type]));
  }
  const tDbDuration = ((performance.now() - tDbStart) / 1000).toFixed(2);
  console.log(
    `[RIE Pipeline] [Stage: Database Schema] Extracted in ${tDbDuration}s. Type: ${database?.type || "Unknown"}, Models: ${database?.models?.length || 0}`
  );

  // 7.5 Evidence-Grounded System Topology Construction
  const topology = buildTopology({
    name,
    tree: normalizedTree,
    techStack,
    primaryLanguage: langResult.primaryLanguage,
    secondaryLanguages: langResult.secondaryLanguages,
    capabilities,
    database,
    apiRoutes: apiRouteResults.routes,
    apiFrameworks: apiRouteResults.frameworks,
    ast,
  });

  // 8. Source File Indexing (for line-level traceability & Monaco retrieval)
  if (projectId) {
    const tIndexStart = performance.now();
    const { indexedCount } = await indexRepositorySources({
      projectId,
      userId,
      analysisVersion,
      tree: normalizedTree,
      ast,
      extractionPath,
      fileFetcher,
    });
    const tIndexDuration = ((performance.now() - tIndexStart) / 1000).toFixed(2);
    console.log(
      `[RIE Pipeline] [Stage: Source Indexing] Indexed ${indexedCount} files in ${tIndexDuration}s.`
    );
  }

  // 9. Repository Blueprint Assembly
  const blueprint = aggregateBlueprint({
    projectId,
    name,
    source,
    repositoryUrl: extraMetadata.repositoryUrl || null,
    branch: extraMetadata.branch || "main",
    commitSha: sourceFingerprint,
    analysisVersion,
    tree: normalizedTree,
    techStack,
    primaryLanguage: langResult.primaryLanguage,
    secondaryLanguages: langResult.secondaryLanguages,
    capabilities,
    ast,
    database,
    apiRoutes: apiRouteResults.routes,
    securityFindings: combinedSecurityFindings,
    securitySummary: {
      totalFindings: combinedSecurityFindings.length,
      severityCounts: combinedSeverityCounts,
      scannedFilesCount: (secretResults.scannedFilesCount || 0) + (astSecurityResults.filesScanned || 0),
      scannableFilesCount: secretResults.scannableFilesCount || 0,
      unsupportedFilesCount: astSecurityResults.unsupportedFiles?.length || 0,
      status: secretResults.status || "completed",
    },
  });

  // 10. Strict Blueprint Schema Validation
  validateBlueprint(blueprint);

  const tPipelineDuration = ((performance.now() - tPipelineStart) / 1000).toFixed(2);
  console.log(`[RIE Pipeline] Completed all static analysis stages in ${tPipelineDuration}s`);

  return {
    name,
    source,
    sourceFingerprint,
    analysisVersion,
    lastAnalyzedAt: new Date(),
    tree: normalizedTree,
    stats,
    primaryLanguage: langResult.primaryLanguage,
    secondaryLanguages: langResult.secondaryLanguages,
    languageDetectionConfidence: langResult.confidence,
    techStack,
    topology,
    capabilities,
    ast,
    database,
    blueprint,
    apiRoutes: apiRouteResults.routes,
    apiFrameworks: apiRouteResults.frameworks,
    apiSummary: apiRouteResults.summary,
    securityFindings: combinedSecurityFindings,
    securitySummary: {
      totalFindings: combinedSecurityFindings.length,
      severityCounts: combinedSeverityCounts,
      filesScanned: (secretResults.scannedFilesCount || 0) + (astSecurityResults.filesScanned || 0),
      scannableFilesCount: secretResults.scannableFilesCount || 0,
      unsupportedFilesCount: astSecurityResults.unsupportedFiles?.length || 0,
      status: secretResults.status || "completed",
    },
  };
}

