// server/src/devops/devops.service.js
//
// Master DevOps Generation Service for ArchMind AI (Phase 5).
// Orchestrates context collection, multi-artifact generation, deterministic validation,
// and MongoDB persistence with partial-success tolerance.

import DevOpsArtifact from "../models/DevOpsArtifact.js";
import Project from "../models/Project.js";
import { GroqChatService } from "../services/chat/groqChat.service.js";
import { collectDevopsContext } from "./devopsContext.service.js";
import { generateDockerfile } from "./generators/dockerfile.generator.js";
import { generateCicdWorkflow } from "./generators/cicd.generator.js";
import { generateKubernetesManifests } from "./generators/kubernetes.generator.js";
import { validateDockerfile } from "./validators/dockerfile.validator.js";
import { validateCicdWorkflow } from "./validators/cicd.validator.js";
import { validateKubernetesManifests } from "./validators/kubernetes.validator.js";

const SUPPORTED_ARTIFACT_TYPES = ["dockerfile", "cicd", "kubernetes"];

export class DevOpsService {
  constructor(options = {}) {
    this.groqService = options.groqService || null;
    this._initGroq();
  }

  _initGroq() {
    if (!this.groqService) {
      try {
        this.groqService = new GroqChatService();
      } catch {
        this.groqService = null;
      }
    }
  }

  /**
   * Generates requested DevOps artifacts for an analyzed repository.
   *
   * @param {Object} params
   * @param {Object} params.project - Project document
   * @param {string} params.userId - Clerk user ID
   * @param {string[]} [params.artifactTypes] - Array of "dockerfile" | "cicd" | "kubernetes"
   * @param {Object} [params.options] - Generation options
   * @returns {Promise<Array<Object>>} List of saved DevOpsArtifact objects
   */
  async generateArtifacts({ project, userId, artifactTypes = null, options = {} }) {
    if (!project) {
      throw new Error("Project is required for DevOps generation.");
    }

    // Determine artifact types to generate (default to all 3)
    let requestedTypes = Array.isArray(artifactTypes) && artifactTypes.length > 0
      ? artifactTypes.map((t) => String(t).toLowerCase().trim())
      : [...SUPPORTED_ARTIFACT_TYPES];

    // Filter valid types
    requestedTypes = requestedTypes.filter((t) => SUPPORTED_ARTIFACT_TYPES.includes(t));
    if (requestedTypes.length === 0) {
      requestedTypes = [...SUPPORTED_ARTIFACT_TYPES];
    }

    // 1. Collect repository context
    const context = await collectDevopsContext(project, options);

    const savedArtifacts = [];
    const errors = [];

    // 2. Generate each requested artifact type with fault isolation
    for (const type of requestedTypes) {
      try {
        let generatedResult = null;

        if (type === "dockerfile") {
          generatedResult = await generateDockerfile(context, options, this.groqService);
        } else if (type === "cicd") {
          generatedResult = await generateCicdWorkflow(context, options, this.groqService);
        } else if (type === "kubernetes") {
          generatedResult = await generateKubernetesManifests(context, options, this.groqService);
        }

        if (generatedResult) {
          // Mark previous active artifact of this type as superseded
          await DevOpsArtifact.updateMany(
            { projectId: project._id, artifactType: type, superseded: false },
            { $set: { superseded: true } }
          );

          // Persist new artifact
          const artifactDoc = await DevOpsArtifact.create({
            projectId: project._id,
            userId,
            artifactType: type,
            filePath: generatedResult.filePath,
            content: generatedResult.content,
            validation: generatedResult.validation,
            generationStatus: generatedResult.validation?.valid === false && generatedResult.metadata?.skipped ? "failed" : "completed",
            sourceAnalysisVersion: project.analysisVersion || 1,
            version: 1,
            superseded: false,
            metadata: generatedResult.metadata || {},
          });

          savedArtifacts.push(artifactDoc.toSafeObject());
        }
      } catch (err) {
        console.error(`[DevOpsService] Error generating artifact '${type}':`, err.message);
        errors.push({ artifactType: type, error: err.message });
      }
    }

    // 3. Update project analysis status for devops module
    try {
      const overallStatus = savedArtifacts.length > 0 ? "completed" : "failed";
      if (!project.analysis) project.analysis = {};
      project.set("analysis.devops.status", overallStatus);
      project.set("analysis.devops.completedAt", new Date());
      project.set("analysis.devops.errorMessage", errors.length > 0 ? errors.map((e) => `${e.artifactType}: ${e.error}`).join("; ") : null);

      if (!project.analysisResults) project.analysisResults = {};
      project.set("analysisResults.devops", {
        artifactsCount: savedArtifacts.length,
        artifactsSummary: savedArtifacts.map((a) => ({
          id: a.id,
          artifactType: a.artifactType,
          filePath: a.filePath,
          valid: a.validation?.valid,
        })),
        generatedAt: new Date().toISOString(),
      });

      await project.save();
    } catch (saveErr) {
      console.warn("[DevOpsService] Failed to update project analysis status:", saveErr.message);
    }

    return savedArtifacts;
  }

  /**
   * Lists active (non-superseded) artifacts for a project.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.projectId
   * @param {string} params.userId
   * @returns {Promise<Array<Object>>}
   */
  async listArtifacts({ projectId, userId }) {
    const docs = await DevOpsArtifact.find({
      projectId,
      userId,
      superseded: { $ne: true },
    }).sort({ createdAt: -1 });

    return docs.map((d) => d.toSafeObject());
  }

  /**
   * Retrieves a single artifact by ID.
   *
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId} params.projectId
   * @param {string} params.userId
   * @param {string|mongoose.Types.ObjectId} params.artifactId
   * @returns {Promise<Object|null>}
   */
  async getArtifactById({ projectId, userId, artifactId }) {
    const doc = await DevOpsArtifact.findOne({
      _id: artifactId,
      projectId,
      userId,
    });

    return doc ? doc.toSafeObject() : null;
  }

  /**
   * Regenerates a single artifact using current project analysis.
   * Increments version without silently destroying history.
   *
   * @param {Object} params
   * @param {Object} params.project
   * @param {string} params.userId
   * @param {string} params.artifactId
   * @param {Object} [params.options]
   * @returns {Promise<Object>}
   */
  async regenerateArtifact({ project, userId, artifactId, options = {} }) {
    const existing = await DevOpsArtifact.findOne({
      _id: artifactId,
      projectId: project._id,
      userId,
    });

    if (!existing) {
      const err = new Error("DevOps artifact not found.");
      err.status = 404;
      err.code = "ARTIFACT_NOT_FOUND";
      throw err;
    }

    const type = existing.artifactType;
    const context = await collectDevopsContext(project, options);

    let generatedResult = null;
    if (type === "dockerfile") {
      generatedResult = await generateDockerfile(context, options, this.groqService);
    } else if (type === "cicd") {
      generatedResult = await generateCicdWorkflow(context, options, this.groqService);
    } else if (type === "kubernetes") {
      generatedResult = await generateKubernetesManifests(context, options, this.groqService);
    }

    if (!generatedResult) {
      throw new Error(`Failed to regenerate artifact of type '${type}'.`);
    }

    // Mark previous as superseded
    existing.superseded = true;
    await existing.save();

    // Create new version
    const newVersion = (existing.version || 1) + 1;
    const newDoc = await DevOpsArtifact.create({
      projectId: project._id,
      userId,
      artifactType: type,
      filePath: generatedResult.filePath,
      content: generatedResult.content,
      validation: generatedResult.validation,
      generationStatus: "completed",
      sourceAnalysisVersion: project.analysisVersion || 1,
      version: newVersion,
      superseded: false,
      metadata: generatedResult.metadata || {},
    });

    return newDoc.toSafeObject();
  }

  /**
   * Re-runs deterministic validation against a stored artifact.
   *
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.userId
   * @param {string} params.artifactId
   * @returns {Promise<Object>}
   */
  async validateArtifact({ projectId, userId, artifactId }) {
    const doc = await DevOpsArtifact.findOne({
      _id: artifactId,
      projectId,
      userId,
    });

    if (!doc) {
      const err = new Error("DevOps artifact not found.");
      err.status = 404;
      err.code = "ARTIFACT_NOT_FOUND";
      throw err;
    }

    let validationResult = null;
    if (doc.artifactType === "dockerfile") {
      validationResult = validateDockerfile(doc.content);
    } else if (doc.artifactType === "cicd") {
      validationResult = validateCicdWorkflow(doc.content);
    } else if (doc.artifactType === "kubernetes") {
      validationResult = validateKubernetesManifests(doc.content);
    }

    if (validationResult) {
      doc.validation = validationResult;
      await doc.save();
    }

    return doc.toSafeObject();
  }

  /**
   * Deletes an artifact belonging to authorized project and user.
   *
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.userId
   * @param {string} params.artifactId
   * @returns {Promise<boolean>}
   */
  async deleteArtifact({ projectId, userId, artifactId }) {
    const result = await DevOpsArtifact.deleteOne({
      _id: artifactId,
      projectId,
      userId,
    });

    return result.deletedCount > 0;
  }
}

export const defaultDevOpsService = new DevOpsService();

