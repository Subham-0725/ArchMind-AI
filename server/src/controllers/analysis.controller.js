// src/controllers/analysis.controller.js
//
// Orchestrates per-module analysis job management and LLM execution.
// Validates capability relevance before queuing, returns cached results
// when already completed, and drives the status lifecycle:
//   idle → queued → processing → completed | failed

import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { randomUUID } from "crypto";
import Project from "../models/Project.js";
import { generateArchitecture, generateERD } from "../services/llmService.js";
import { aggregateBlueprint } from "../rie/blueprintAggregator.js";
import { extractDatabaseSchema } from "../rie/dbSchemaExtractor.js";
import { populateKeyFileContents } from "../services/githubService.js";

/**
 * Valid analysis module names and the capability key each one requires.
 * Architecture is always relevant.
 */
const MODULE_CONFIG = {
  architecture: { capabilityKey: null, label: "Architecture Topology" },
  erd:          { capabilityKey: "hasDatabase", label: "ER Diagram" },
  api:          { capabilityKey: "hasApis", label: "API Sequence" },
  security:     { capabilityKey: "hasSecuritySensitiveCode", label: "Security Audit" },
  devops:       { capabilityKey: "hasDevops", label: "DevOps Analysis" },
};

const VALID_MODULES = Object.keys(MODULE_CONFIG);

/**
 * Helper: Load project with ownership check.
 */
const loadOwnedProject = async (userId, projectId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return { error: "Invalid project ID.", status: 400 };
  }
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    return { error: "Project not found.", status: 404 };
  }
  return { project };
};

/**
 * Checks whether a module is relevant based on project capabilities.
 */
const isModuleRelevant = (moduleName, capabilities = {}) => {
  const config = MODULE_CONFIG[moduleName];
  if (!config) return false;
  if (!config.capabilityKey) return true; // architecture is always relevant
  return Boolean(capabilities[config.capabilityKey]);
};

/**
 * Safely reads a module's analysis status from the project.
 */
const getModuleStatus = (project, moduleName) => {
  const analysis = project.analysis || {};
  const mod = analysis[moduleName];
  if (!mod || !mod.status) return { status: "idle", analysisId: null, completedAt: null, errorMessage: null };
  return {
    status: mod.status,
    analysisId: mod.analysisId || null,
    completedAt: mod.completedAt || null,
    errorMessage: mod.errorMessage || null,
    result: project.analysisResults?.[moduleName] || null,
  };
};

/**
 * Asynchronously executes LLM analysis for a module and persists the result.
 * Status lifecycle: queued → processing → completed | failed.
 *
 * @param {string|mongoose.Types.ObjectId} projectId
 * @param {string} moduleName
 * @param {Object} [options]
 */
export async function executeModuleAnalysis(projectId, moduleName, options = {}) {
  const project = await Project.findById(projectId);
  if (!project) return;

  // Set processing status
  if (!project.analysis) project.analysis = {};
  project.set(`analysis.${moduleName}.status`, "processing");
  await project.save();

  try {
    // If project has database capability, ensure database schema is fresh
    if (project.capabilities?.hasDatabase) {
      if (!project.database || !Array.isArray(project.database.entities) || project.database.entities.length === 0) {
        if (project.source === "github" && project.github?.owner && project.github?.repo) {
          await populateKeyFileContents(project.github.owner, project.github.repo, project.tree);
        }
        project.database = extractDatabaseSchema(project.tree, project.capabilities, project.techStack, null);
      }
    }

    // Always regenerate blueprint to ensure latest database & models are in sync
    const blueprint = aggregateBlueprint({
      name: project.name,
      source: project.source,
      tree: project.tree,
      techStack: project.techStack,
      primaryLanguage: project.primaryLanguage,
      secondaryLanguages: project.secondaryLanguages,
      capabilities: project.capabilities,
      ast: project.ast,
      database: project.database,
    });
    project.blueprint = blueprint;

    let resultPayload = null;

    if (moduleName === "architecture") {
      resultPayload = await generateArchitecture(blueprint, options);
    } else if (moduleName === "erd") {
      resultPayload = await generateERD(blueprint, options);
    } else {
      // Future modules stub
      resultPayload = { status: "stub", module: moduleName };
    }

    if (!project.analysisResults) project.analysisResults = {};

    project.set(`analysisResults.${moduleName}`, resultPayload);
    project.set(`analysis.${moduleName}.status`, "completed");
    project.set(`analysis.${moduleName}.completedAt`, new Date());
    project.set(`analysis.${moduleName}.errorMessage`, null);

    await project.save();
  } catch (err) {
    console.error(`[analysis.controller] executeModuleAnalysis failed for ${moduleName}:`, err);
    project.set(`analysis.${moduleName}.status`, "failed");
    project.set(`analysis.${moduleName}.errorMessage`, err.message);
    await project.save();
  }
}

/**
 * POST /api/projects/:id/analyze
 *
 * "Run Full Analysis" — queues all relevant modules. Supports ?force=true.
 */
export const analyzeProject = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized." });

    const { id } = req.params;
    const isForce = req.body?.force === true || req.query?.force === "true";
    const result = await loadOwnedProject(userId, id);
    if (result.error) return res.status(result.status).json({ success: false, error: result.error });

    const { project } = result;
    const capabilities = project.capabilities || {};
    const queued = [];
    const skippedIrrelevant = [];
    const skippedCompleted = [];

    for (const moduleName of VALID_MODULES) {
      const relevant = isModuleRelevant(moduleName, capabilities);

      if (!relevant) {
        skippedIrrelevant.push(moduleName);
        continue;
      }

      const currentStatus = getModuleStatus(project, moduleName);

      // Skip if already completed and current (unless force=true)
      if (currentStatus.status === "completed" && !isForce) {
        skippedCompleted.push(moduleName);
        continue;
      }

      // Queue this module (or re-queue if stuck)
      const analysisId = randomUUID();
      queued.push({ module: moduleName, analysisId });
    }

    // Apply all queued status changes via Mongoose document save
    if (queued.length > 0) {
      if (!project.analysis) project.analysis = {};
      for (const item of queued) {
        project.set(`analysis.${item.module}`, {
          status: "queued",
          analysisId: item.analysisId,
          completedAt: null,
          errorMessage: null,
        });
      }
      await project.save();

      // Trigger asynchronous execution for each queued module
      for (const item of queued) {
        executeModuleAnalysis(project._id, item.module).catch((err) =>
          console.error(`[analyzeProject] Background processing failed for ${item.module}:`, err)
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: queued.length > 0
        ? `${queued.length} module(s) queued for analysis.`
        : "All relevant modules are already completed or in progress.",
      data: {
        queued,
        skippedIrrelevant,
        skippedCompleted,
        analysis: {
          architecture: getModuleStatus(project, "architecture"),
          erd: getModuleStatus(project, "erd"),
          api: getModuleStatus(project, "api"),
          security: getModuleStatus(project, "security"),
          devops: getModuleStatus(project, "devops"),
        },
      },
    });
  } catch (error) {
    console.error("[analysis.controller] analyzeProject error:", error);
    return res.status(500).json({ success: false, error: "Failed to queue analysis." });
  }
};

/**
 * POST /api/projects/:id/:module
 *
 * Triggers analysis for a single module.
 */
export const analyzeModule = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized." });

    const { id, module: moduleName } = req.params;

    if (!VALID_MODULES.includes(moduleName)) {
      return res.status(400).json({
        success: false,
        error: `Invalid module '${moduleName}'. Valid modules: ${VALID_MODULES.join(", ")}.`,
      });
    }

    const result = await loadOwnedProject(userId, id);
    if (result.error) return res.status(result.status).json({ success: false, error: result.error });

    const { project } = result;
    const capabilities = project.capabilities || {};

    if (!isModuleRelevant(moduleName, capabilities)) {
      const config = MODULE_CONFIG[moduleName];
      return res.status(422).json({
        success: false,
        error: `${config.label} is not relevant to this repository. The required capability '${config.capabilityKey}' was not detected.`,
        code: "MODULE_NOT_RELEVANT",
      });
    }

    const isForce = req.body?.force === true || req.query?.force === "true";
    const currentStatus = getModuleStatus(project, moduleName);

    if (currentStatus.status === "completed" && !isForce) {
      return res.status(200).json({
        success: true,
        message: `${MODULE_CONFIG[moduleName].label} analysis is already completed.`,
        data: {
          module: moduleName,
          ...currentStatus,
          cached: true,
        },
      });
    }



    const analysisId = randomUUID();
    if (!project.analysis) project.analysis = {};
    project.set(`analysis.${moduleName}`, {
      status: "queued",
      analysisId,
      completedAt: null,
      errorMessage: null,
    });
    await project.save();

    // Trigger async LLM analysis
    executeModuleAnalysis(project._id, moduleName).catch((err) =>
      console.error(`[analyzeModule] Background processing failed for ${moduleName}:`, err)
    );

    return res.status(200).json({
      success: true,
      message: `${MODULE_CONFIG[moduleName].label} analysis queued.`,
      data: {
        module: moduleName,
        status: "queued",
        analysisId,
        cached: false,
      },
    });
  } catch (error) {
    console.error("[analysis.controller] analyzeModule error:", error);
    return res.status(500).json({ success: false, error: "Failed to queue module analysis." });
  }
};

/**
 * GET /api/projects/:id/analysis
 *
 * Returns the current analysis status and results for all modules.
 */
export const getAnalysisStatus = async (req, res) => {
  try {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ success: false, error: "Unauthorized." });

    const { id } = req.params;
    const result = await loadOwnedProject(userId, id);
    if (result.error) return res.status(result.status).json({ success: false, error: result.error });

    const { project } = result;
    const capabilities = project.capabilities || {};

    const modules = {};
    for (const moduleName of VALID_MODULES) {
      modules[moduleName] = {
        ...getModuleStatus(project, moduleName),
        relevant: isModuleRelevant(moduleName, capabilities),
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        projectId: id,
        analysis: modules,
      },
    });
  } catch (error) {
    console.error("[analysis.controller] getAnalysisStatus error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch analysis status." });
  }
};
