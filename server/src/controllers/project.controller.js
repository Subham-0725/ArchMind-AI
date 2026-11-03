// src/controllers/project.controller.js
//
// Orchestrates project ingestion (ZIP archive uploads & GitHub repository imports)
// and project retrieval with strict multi-tenant isolation.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { randomUUID } from "crypto";
import Project from "../models/Project.js";
import SourceFile from "../models/SourceFile.js";
import { parseGithubUrl } from "../utils/githubUrl.js";
import { fetchRepoMetadata, fetchRepoTree, populateKeyFileContents, fetchFileBlob } from "../services/githubService.js";
import { extractZip } from "../rie/zipExtractor.js";
import { scanRepository } from "../rie/repoScanner.js";
import { detectProjectLanguage } from "../services/languageDetector.js";
import { buildTopology } from "../rie/topologyBuilder.js";
import { detectCapabilities } from "../rie/relevanceDetector.js";
import { parseRepository } from "../rie/astParser.js";
import { aggregateBlueprint } from "../rie/blueprintAggregator.js";
import { extractDatabaseSchema } from "../rie/dbSchemaExtractor.js";
import { executeRiePipeline } from "../rie/pipeline/analysisPipeline.js";
import { isBinaryExtension } from "../rie/indexing/sourceIndexer.js";
import { redactSecrets } from "../rie/security/secretRedactor.js";
import { EXTRACTED_DIR, safeUnlink, safeRmDir } from "../config/storage.js";

/**
 * POST /api/projects/github
 *
 * Imports or refreshes a GitHub repository for the authenticated user.
 * Fetches metadata + recursive file tree from GitHub REST API,
 * applies unified RIE analysis pipeline, checks source cache version,
 * and upserts the Project document in MongoDB.
 */
export const importGithub = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { repoUrl } = req.body;
    if (!repoUrl) {
      return res.status(400).json({
        success: false,
        error: "A valid GitHub repository URL is required.",
      });
    }

    // 1. Validate & parse URL
    const parseResult = parseGithubUrl(repoUrl);
    if (!parseResult.valid) {
      return res.status(400).json({
        success: false,
        error: parseResult.error,
      });
    }

    const { owner, repo } = parseResult;

    // 2. Fetch metadata from GitHub REST API
    const metadata = await fetchRepoMetadata(owner, repo);

    // 3. Fetch recursive tree from GitHub Git Trees API
    const treeData = await fetchRepoTree(owner, repo, metadata.defaultBranch);
    const sourceFingerprint = treeData.treeSha || `${metadata.pushedAt || metadata.updatedAt}`;

    // 3.1 Check Cache Invalidation & Analysis Versioning
    const forceReanalyze = req.query.force === "true";
    const existingProject = await Project.findOne({
      userId,
      "github.fullName": metadata.fullName,
      source: "github",
    });

    if (
      existingProject &&
      !forceReanalyze &&
      existingProject.sourceFingerprint === sourceFingerprint &&
      existingProject.blueprint?.version &&
      existingProject.status === "completed"
    ) {
      return res.status(200).json({
        success: true,
        message: `Repository '${metadata.fullName}' is up-to-date (using cached analysis version ${existingProject.analysisVersion}).`,
        data: existingProject.toSafeObject(),
      });
    }

    const nextVersion = existingProject ? (existingProject.analysisVersion || 1) + 1 : 1;
    const targetProjectId = existingProject?._id || new mongoose.Types.ObjectId();

    // 3.2 Populate contents for key model/schema/architecture files
    await populateKeyFileContents(owner, repo, treeData.tree);

    // 3.3 Execute Unified RIE Analysis Pipeline
    const rieOutput = await executeRiePipeline({
      name: metadata.name,
      source: "github",
      userId,
      projectId: targetProjectId,
      tree: treeData.tree,
      stats: {
        totalFiles: treeData.stats.totalFiles,
        totalDirs: treeData.stats.totalDirs,
        totalBytes: treeData.stats.totalBytes,
        isTruncated: treeData.isTruncated,
        topExtensions: treeData.stats.topExtensions,
      },
      sourceFingerprint,
      analysisVersion: nextVersion,
      fileFetcher: (p, sha) => fetchFileBlob(owner, repo, sha),
      extraMetadata: {
        repositoryUrl: metadata.htmlUrl,
        branch: metadata.defaultBranch,
      },
    });

    // 3.4 Purge outdated SourceFile records if version bumped
    if (existingProject) {
      await SourceFile.deleteMany({
        projectId: existingProject._id,
        analysisVersion: { $lt: nextVersion },
      }).catch((e) => console.warn("[importGithub] SourceFile cleanup warning:", e.message));
    }

    // 4. Atomic upsert into MongoDB
    const project = await Project.findOneAndUpdate(
      {
        userId,
        "github.fullName": metadata.fullName,
        source: "github",
      },
      {
        $set: {
          userId,
          name: metadata.name,
          source: "github",
          status: "uploaded",
          sourceFingerprint,
          analysisVersion: nextVersion,
          lastAnalyzedAt: new Date(),
          github: {
            githubId: metadata.githubId,
            owner: metadata.owner.login,
            repo: metadata.name,
            fullName: metadata.fullName,
            url: metadata.htmlUrl,
            ownerAvatar: metadata.owner.avatarUrl,
            defaultBranch: metadata.defaultBranch,
            stars: metadata.stars,
            forks: metadata.forks,
            openIssues: metadata.openIssues,
            language: metadata.language,
            topics: metadata.topics,
            isPrivate: metadata.isPrivate,
            isFork: metadata.isFork,
            size: metadata.size,
            license: metadata.license,
          },
          tree: rieOutput.tree,
          stats: rieOutput.stats,
          primaryLanguage: rieOutput.primaryLanguage,
          secondaryLanguages: rieOutput.secondaryLanguages,
          languageDetectionConfidence: rieOutput.languageDetectionConfidence,
          techStack: rieOutput.techStack,
          topology: rieOutput.topology,
          capabilities: rieOutput.capabilities,
          ast: rieOutput.ast,
          blueprint: rieOutput.blueprint,
          database: rieOutput.database,
          securityFindings: rieOutput.securityFindings,
          securitySummary: rieOutput.securitySummary,
          analysisResults: {
            apiRoutes: rieOutput.apiRoutes || [],
          },
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!project) {
      return res.status(500).json({
        success: false,
        error: "Failed to persist project record in database.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Repository '${metadata.fullName}' imported successfully.`,
      data: project.toSafeObject(),
    });
  } catch (error) {
    console.error("[project.controller] importGithub error:", error);

    // Handle known HTTP status codes from githubService
    if (error.status && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
      });
    }

    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to import GitHub repository. Please try again.",
    });
  }
};

/**
 * POST /api/projects/upload
 *
 * Accepts a ZIP repository archive uploaded by an authenticated user.
 * Pipeline:
 *   1. Multer middleware stages file to server/src/storage/uploads/
 *   2. Validate file presence
 *   3. Safe extraction with Zip Slip defense & magic bytes check
 *   4. Repository scanning & tech stack detection
 *   5. Atomic upsert into MongoDB with source: "zip"
 *   6. Guaranteed cleanup of staged ZIP and extracted files
 *   7. Return safe project payload
 */
export const uploadZip = async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized." });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No file uploaded. Please attach a .zip repository archive.",
    });
  }

  const zipFilePath = req.file.path;
  const jobId = randomUUID();
  let extractionPath = null;

  console.log("[UPLOAD] Controller started");

  try {
    // 1. Calculate archive fingerprint for cache invalidation & version tracking
    let sourceFingerprint = "";
    try {
      sourceFingerprint = crypto.createHash("sha256").update(fs.readFileSync(zipFilePath)).digest("hex");
    } catch {
      sourceFingerprint = `zip-${Date.now()}`;
    }

    // Check existing project cache
    const forceReanalyze = req.query.force === "true";
    const existingProject = await Project.findOne({
      userId,
      "zip.originalName": req.file.originalname,
      source: "zip",
    });

    if (
      existingProject &&
      !forceReanalyze &&
      existingProject.sourceFingerprint === sourceFingerprint &&
      existingProject.blueprint?.version &&
      existingProject.status === "completed"
    ) {
      return res.status(200).json({
        success: true,
        message: `Repository '${existingProject.name}' is up-to-date (using cached analysis version ${existingProject.analysisVersion}).`,
        data: existingProject.toSafeObject(),
      });
    }

    const nextVersion = existingProject ? (existingProject.analysisVersion || 1) + 1 : 1;
    const targetProjectId = existingProject?._id || new mongoose.Types.ObjectId();

    // 2. Safe extraction with Zip Slip defense
    console.log("[UPLOAD] ZIP extraction started");
    const { extractedPath } = await extractZip(zipFilePath, EXTRACTED_DIR, jobId);
    extractionPath = extractedPath;
    console.log(`[UPLOAD] ZIP extraction completed`);

    // 3. Scan extracted codebase
    const { tree, stats, scanRoot } = scanRepository(extractionPath);
    const codebasePath = scanRoot || extractionPath;

    // Clean project name
    const rawName = req.file.originalname.replace(/\.zip$/i, "").replace(/[_-]+/g, " ").trim();
    const projectName = rawName || "Unnamed Repository";

    // 4. Unified RIE Analysis Pipeline Execution
    console.log("[UPLOAD] Analysis started");
    const rieOutput = await executeRiePipeline({
      name: projectName,
      source: "zip",
      userId,
      projectId: targetProjectId,
      tree,
      stats,
      sourceFingerprint,
      analysisVersion: nextVersion,
      extractionPath: codebasePath,
      extraMetadata: { branch: "main" },
    });

    // 5. Purge outdated SourceFile records if version bumped
    if (existingProject) {
      await SourceFile.deleteMany({
        projectId: existingProject._id,
        analysisVersion: { $lt: nextVersion },
      }).catch((e) => console.warn("[uploadZip] SourceFile cleanup warning:", e.message));
    }

    // 6. Persist to MongoDB (indexed on userId + zip.originalName)
    const project = await Project.findOneAndUpdate(
      {
        userId,
        "zip.originalName": req.file.originalname,
        source: "zip",
      },
      {
        $set: {
          userId,
          name: projectName,
          source: "zip",
          status: "completed",
          sourceFingerprint,
          analysisVersion: nextVersion,
          lastAnalyzedAt: new Date(),
          "zip.originalName": req.file.originalname,
          "zip.sizeBytes": req.file.size,
          tree: rieOutput.tree,
          stats: rieOutput.stats,
          primaryLanguage: rieOutput.primaryLanguage,
          secondaryLanguages: rieOutput.secondaryLanguages,
          languageDetectionConfidence: rieOutput.languageDetectionConfidence,
          techStack: rieOutput.techStack,
          topology: rieOutput.topology,
          capabilities: rieOutput.capabilities,
          ast: rieOutput.ast,
          blueprint: rieOutput.blueprint,
          database: rieOutput.database,
          securityFindings: rieOutput.securityFindings,
          securitySummary: rieOutput.securitySummary,
          analysisResults: {
            apiRoutes: rieOutput.apiRoutes || [],
          },
        },
      },
      {
        upsert: true,
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!project) {
      return res.status(500).json({
        success: false,
        error: "Failed to persist project record in database.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Repository '${projectName}' uploaded and scanned successfully (analysis version ${nextVersion}).`,
      data: project.toSafeObject(),
    });
  } catch (error) {
    console.error("[UPLOAD] Upload pipeline failed:", error.message);
    console.error("[project.controller] uploadZip error:", error);

    if (error.code === "INVALID_ZIP") {
      return res.status(400).json({ success: false, error: error.message, code: "INVALID_ZIP" });
    }

    if (error.code === "EMPTY_ZIP") {
      return res.status(400).json({ success: false, error: error.message, code: "EMPTY_ZIP" });
    }

    if (error.code === "SECURITY_ERROR") {
      return res.status(422).json({ success: false, error: error.message, code: "SECURITY_ERROR" });
    }

    if (error.code === "UNSUPPORTED_FILE_TYPE") {
      return res.status(422).json({ success: false, error: error.message, code: "UNSUPPORTED_FILE_TYPE" });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process the uploaded repository. Please try again.",
    });
  } finally {
    // Guaranteed cleanup
    safeUnlink(zipFilePath);
    safeRmDir(extractionPath);
  }
};

/**
 * GET /api/projects
 *
 * Returns recent projects for the currently authenticated user.
 */
export const getProjects = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projects = await Project.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .select("-tree -analysis") // Omit large tree payloads for list view
      .lean();

    const formatted = projects.map((p) => ({
      id: p._id,
      name: p.name,
      source: p.source,
      status: p.status,
      github: p.github,
      zip: p.zip,
      stats: p.stats,
      techStack: p.techStack,
      primaryLanguage: p.primaryLanguage || null,
      secondaryLanguages: p.secondaryLanguages || [],
      languageDetectionConfidence: p.languageDetectionConfidence || 0,
      errorDetails: p.errorDetails?.message ? p.errorDetails : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("[project.controller] getProjects error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch projects.",
    });
  }
};

/**
 * GET /api/projects/:id
 *
 * Returns complete project details including the scanned file tree.
 * Enforces strict multi-tenant isolation (userId match).
 */
export const getProjectById = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid project ID." });
    }

    const project = await Project.findOne({ _id: id, userId }).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found.",
      });
    }

    // Self-heal language & framework detection if missing or incomplete on older records
    let primaryLanguage = project.primaryLanguage || null;
    let secondaryLanguages = project.secondaryLanguages || [];
    let languageDetectionConfidence = project.languageDetectionConfidence || 0;
    let techStack = project.techStack || { languages: [], frameworks: [], databases: [], devops: [] };

    if (!primaryLanguage || ((!techStack.languages || techStack.languages.length === 0) && (!techStack.frameworks || techStack.frameworks.length === 0))) {
      const langResult = detectProjectLanguage(project.tree || [], null);
      primaryLanguage = langResult.primaryLanguage;
      secondaryLanguages = langResult.secondaryLanguages;
      languageDetectionConfidence = langResult.confidence;
      techStack = {
        languages: primaryLanguage ? Array.from(new Set([primaryLanguage, ...secondaryLanguages, ...(techStack.languages || [])])) : (techStack.languages || []),
        frameworks: Array.from(new Set([...(techStack.frameworks || []), ...(langResult.frameworks || [])])),
        databases: techStack.databases || [],
        devops: techStack.devops || [],
      };

      // Asynchronously update MongoDB record with self-healed language analysis
      Project.updateOne(
        { _id: id, userId },
        { $set: { primaryLanguage, secondaryLanguages, languageDetectionConfidence, techStack } }
      ).catch((err) => console.error("[project.controller] Failed to persist self-healed language detection:", err));
    }

    // Always ensure capability detection evaluates full current tree & techStack
    const detectedCapabilities = detectCapabilities(project.tree || [], techStack, null);

    // Always generate robust topology based on self-healed techStack & language
    const topology =
      project.topology && Array.isArray(project.topology.nodes) && project.topology.nodes.length > 0
        ? project.topology
        : buildTopology({
            name: project.name,
            tree: project.tree || [],
            techStack,
            primaryLanguage,
            secondaryLanguages,
          });

    // Asynchronously persist self-healed topology and capabilities if needed
    if (!project.capabilities || !project.topology || !Array.isArray(project.topology.nodes) || project.topology.nodes.length === 0) {
      Project.updateOne({ _id: id, userId }, { $set: { topology, capabilities: detectedCapabilities } }).catch((err) =>
        console.error("[project.controller] Failed to persist self-healed topology/capabilities:", err)
      );
    }

    const overview = {
      totalFiles: project.stats?.totalFiles || 0,
      totalDirectories: project.stats?.totalDirs || 0,
      totalSize: project.stats?.totalBytes || 0,
      topExtensions: project.stats?.topExtensions || [],
    };

    const languages = {
      primary: primaryLanguage,
      secondary: secondaryLanguages,
      confidence: languageDetectionConfidence,
    };

    const capabilities = {
      architecture: true,
      erd: Boolean(detectedCapabilities.hasDatabase),
      securityAudit: Boolean(detectedCapabilities.hasSecuritySensitiveCode),
      devops: Boolean(detectedCapabilities.hasDevops),
      apis: Boolean(detectedCapabilities.hasApis),
      hasDatabase: Boolean(detectedCapabilities.hasDatabase),
      hasApis: Boolean(detectedCapabilities.hasApis),
      hasDevops: Boolean(detectedCapabilities.hasDevops),
      hasSecuritySensitiveCode: Boolean(detectedCapabilities.hasSecuritySensitiveCode),
      details: detectedCapabilities.details || { databases: [], frameworks: [], devops: [] },
    };

    const categorizedTechStack = {
      languages: techStack.languages || [],
      frameworks: techStack.frameworks || [],
      databases: techStack.databases || [],
      devops: techStack.devops || [],
    };


    return res.status(200).json({
      success: true,
      data: {
        // Direct root fields (legacy compatibility)
        id: project._id,
        name: project.name,
        source: project.source,
        status: project.status,
        github: project.github,
        zip: project.zip,

        // Workspace structured contract
        project: {
          id: project._id,
          name: project.name,
          source: project.source,
          status: project.status,
        },
        overview,
        languages,
        techStack: categorizedTechStack,
        tree: project.tree || [],
        topology,
        capabilities,

        // Direct root fields
        stats: project.stats,
        primaryLanguage: project.primaryLanguage || null,
        secondaryLanguages: project.secondaryLanguages || [],
        languageDetectionConfidence: project.languageDetectionConfidence || 0,
        errorDetails: project.errorDetails?.message ? project.errorDetails : null,
        analysis: (() => {
          const defaultMod = { status: "idle", analysisId: null, completedAt: null, errorMessage: null };
          const a = project.analysis || {};
          return {
            architecture: a.architecture || defaultMod,
            erd: a.erd || defaultMod,
            api: a.api || defaultMod,
            security: a.security || defaultMod,
            devops: a.devops || defaultMod,
          };
        })(),
        analysisResults: project.analysisResults || null,
        blueprint: project.blueprint || null,
        database: project.database || null,
        sourceFingerprint: project.sourceFingerprint || null,
        analysisVersion: project.analysisVersion || 1,
        lastAnalyzedAt: project.lastAnalyzedAt || null,
        securityFindings: project.securityFindings || [],
        securitySummary: project.securitySummary || {},
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    console.error("[project.controller] getProjectById error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve project details.",
    });
  }
};

/**
 * PATCH /api/projects/:id/status
 *
 * Updates processing status and optional error details of a project.
 */
export const updateProjectStatus = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid project ID." });
    }

    const VALID_STATUSES = ["uploaded", "processing", "completed", "failed"];
    const { status, errorDetails } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}.`,
      });
    }

    const updatePayload = { status };

    if (status === "failed" && errorDetails) {
      updatePayload.errorDetails = {
        message: errorDetails.message || "Unknown error",
        code: errorDetails.code || null,
        at: new Date(),
      };
    }

    if (status !== "failed") {
      updatePayload.errorDetails = { message: null, code: null, at: null };
    }

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      { $set: updatePayload },
      { returnDocument: "after", runValidators: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: "Project not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: project.toSafeObject(),
    });
  } catch (error) {
    console.error("[project.controller] updateProjectStatus error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to update project status.",
    });
  }
};

/**
 * GET /api/projects/:id/blueprint
 *
 * Retrieves the compiled Repository Blueprint for downstream LLM analysis.
 * Uses cached blueprint if present, otherwise aggregates on-the-fly.
 */
export const getProjectBlueprint = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid project ID." });
    }

    const project = await Project.findOne({ _id: id, userId });
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found." });
    }

    let blueprint = project.blueprint;
    if (!blueprint || !blueprint.metadata || !blueprint.metadata.name) {
      blueprint = aggregateBlueprint({
        name: project.name,
        source: project.source,
        tree: project.tree,
        techStack: project.techStack,
        primaryLanguage: project.primaryLanguage,
        secondaryLanguages: project.secondaryLanguages,
        capabilities: project.capabilities,
        ast: project.ast,
      });
      project.blueprint = blueprint;
      await project.save();
    }

    return res.status(200).json({
      success: true,
      data: blueprint,
    });
  } catch (error) {
    console.error("[project.controller] getProjectBlueprint error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve repository blueprint.",
    });
  }
};

/**
 * GET /api/projects/:id/file?path=<filePath>
 *
 * Retrieves the content and metadata of a specific file in a project.
 * Implements strict path traversal defense, project ownership check,
 * and seamless fallback across SourceFile cache, disk storage, and GitHub Git Blobs API.
 */
export const getProjectFile = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid project ID." });
    }

    const project = await Project.findOne({ _id: id, userId });
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found or access denied." });
    }

    const requestedPath = req.query.path;
    if (!requestedPath || typeof requestedPath !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing required query parameter: path",
      });
    }

    // Path Traversal Security Checks
    const normalizedPath = requestedPath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (
      normalizedPath.includes("..") ||
      normalizedPath.includes("\0") ||
      normalizedPath.startsWith("/") ||
      normalizedPath.includes("://")
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid file path. Path traversal is strictly prohibited.",
        code: "INVALID_PATH",
      });
    }

    // Check if file is part of the project's sanitized tree
    const treeNode = (project.tree || []).find((f) => f.path === normalizedPath && f.type !== "dir");
    if (!treeNode) {
      return res.status(404).json({
        success: false,
        error: `File '${normalizedPath}' does not exist in the repository tree.`,
        code: "FILE_NOT_FOUND",
      });
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const isBinary = isBinaryExtension(ext);

    if (isBinary) {
      return res.status(200).json({
        success: true,
        file: {
          path: normalizedPath,
          language: ext.replace(".", "") || "binary",
          size: treeNode.size || 0,
          isBinary: true,
          content: null,
          message: "Binary file content cannot be displayed as text.",
        },
      });
    }

    // 1. Check SourceFile index in MongoDB
    const currentVersion = project.analysisVersion || 1;
    let sourceDoc = await SourceFile.findOne({
      projectId: project._id,
      filePath: normalizedPath,
      analysisVersion: currentVersion,
    });

    if (sourceDoc) {
      if (sourceDoc.isBinary) {
        return res.status(200).json({
          success: true,
          file: {
            path: sourceDoc.filePath,
            language: sourceDoc.language || "binary",
            size: sourceDoc.size || 0,
            isBinary: true,
            content: null,
            message: "Binary file content cannot be displayed as text.",
          },
        });
      }

      if (sourceDoc.content !== null) {
        return res.status(200).json({
          success: true,
          file: {
            path: sourceDoc.filePath,
            language: sourceDoc.language,
            content: sourceDoc.content,
            size: sourceDoc.size,
            lineCount: sourceDoc.lineCount,
            symbols: sourceDoc.symbols || [],
            sourceLocations: sourceDoc.sourceLocations || [],
          },
        });
      }
    }

    // 2. Fallback for GitHub projects: on-demand blob retrieval
    if (project.source === "github" && project.github?.owner && project.github?.repo && treeNode.sha) {
      const rawContent = await fetchFileBlob(project.github.owner, project.github.repo, treeNode.sha);
      if (rawContent !== null) {
        const sanitized = redactSecrets(rawContent);
        const lines = sanitized.split(/\r?\n/).length;

        // Cache in SourceFile for future instant retrieval
        await SourceFile.findOneAndUpdate(
          { projectId: project._id, filePath: normalizedPath, analysisVersion: currentVersion },
          {
            $set: {
              userId,
              fileName: path.basename(normalizedPath),
              extension: ext,
              language: ext.replace(".", "") || "text",
              size: treeNode.size || sanitized.length,
              lineCount: lines,
              content: sanitized,
              isBinary: false,
            },
          },
          { upsert: true }
        ).catch((e) => console.warn("[getProjectFile] Cache save warning:", e.message));

        return res.status(200).json({
          success: true,
          file: {
            path: normalizedPath,
            language: ext.replace(".", "") || "text",
            content: sanitized,
            size: treeNode.size || sanitized.length,
            lineCount: lines,
          },
        });
      }
    }

    // 3. Fallback for ZIP projects: check if extractionPath is still mounted
    if (project.source === "zip" && project.extractionPath && fs.existsSync(project.extractionPath)) {
      const absPath = path.resolve(project.extractionPath, normalizedPath);
      if (absPath.startsWith(path.resolve(project.extractionPath)) && fs.existsSync(absPath)) {
        const rawContent = fs.readFileSync(absPath, "utf8");
        const sanitized = redactSecrets(rawContent);
        const lines = sanitized.split(/\r?\n/).length;

        return res.status(200).json({
          success: true,
          file: {
            path: normalizedPath,
            language: ext.replace(".", "") || "text",
            content: sanitized,
            size: treeNode.size || sanitized.length,
            lineCount: lines,
          },
        });
      }
    }

    return res.status(404).json({
      success: false,
      error: `Content for file '${normalizedPath}' is not available in storage cache.`,
      code: "CONTENT_UNAVAILABLE",
    });
  } catch (error) {
    console.error("[project.controller] getProjectFile error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve source file content.",
    });
  }
};
