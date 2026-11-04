// server/src/devops/devops.controller.js
//
// HTTP Controller for ArchMind AI Phase 5 DevOps Artifact Generation endpoints.
// Enforces Clerk authentication, project authorization, input validation,
// and standard API response conventions.

import { getAuth } from "@clerk/express";
import { isValidObjectId } from "mongoose";
import Project from "../models/Project.js";
import { defaultDevOpsService } from "./devops.service.js";

/**
 * Validates request authentication and verifies multi-tenant project ownership.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ project: Object, userId: string }>}
 */
async function verifyProjectAccess(req) {
  let userId = null;
  try {
    const auth = getAuth(req);
    userId = auth?.userId || null;
  } catch {
    userId = null;
  }
  if (!userId && req.auth?.userId) {
    userId = req.auth.userId;
  }

  if (!userId) {
    const err = new Error("Unauthorized. Valid authentication required.");
    err.status = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const projectId = req.params.projectId || req.params.id;
  if (!isValidObjectId(projectId)) {
    const err = new Error("Invalid project ID format.");
    err.status = 400;
    err.code = "INVALID_PROJECT_ID";
    throw err;
  }

  const project = await Project.findById(projectId);
  if (!project) {
    const err = new Error("Project not found.");
    err.status = 404;
    err.code = "PROJECT_NOT_FOUND";
    throw err;
  }

  if (project.userId !== userId) {
    const err = new Error("Forbidden. You do not own this project.");
    err.status = 403;
    err.code = "FORBIDDEN";
    throw err;
  }

  return { project, userId };
}

/**
 * POST /api/projects/:projectId/devops/generate
 * Generates repository-grounded DevOps artifacts (Dockerfile, CI/CD, Kubernetes).
 */
export async function generateDevops(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);

    const { artifactTypes, options } = req.body || {};

    if (artifactTypes && !Array.isArray(artifactTypes)) {
      return res.status(400).json({
        success: false,
        error: "'artifactTypes' must be an array of strings ('dockerfile', 'cicd', 'kubernetes').",
      });
    }

    const artifacts = await defaultDevOpsService.generateArtifacts({
      project,
      userId,
      artifactTypes,
      options: options || {},
    });

    return res.status(200).json({
      success: true,
      data: {
        artifacts,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "DevOps generation failed.",
      code: err.code || "DEVOPS_GENERATION_FAILED",
    });
  }
}

/**
 * GET /api/projects/:projectId/devops/artifacts
 * Lists active DevOps artifacts for a project.
 */
export async function listDevopsArtifacts(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);

    const artifacts = await defaultDevOpsService.listArtifacts({
      projectId: project._id,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: {
        artifacts,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to list DevOps artifacts.",
      code: err.code || "DEVOPS_LIST_FAILED",
    });
  }
}

/**
 * GET /api/projects/:projectId/devops/artifacts/:artifactId
 * Retrieves a single DevOps artifact by ID.
 */
export async function getDevopsArtifact(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);
    const { artifactId } = req.params;

    if (!isValidObjectId(artifactId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid artifact ID format.",
      });
    }

    const artifact = await defaultDevOpsService.getArtifactById({
      projectId: project._id,
      userId,
      artifactId,
    });

    if (!artifact) {
      return res.status(404).json({
        success: false,
        error: "DevOps artifact not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        artifact,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to retrieve DevOps artifact.",
      code: err.code || "DEVOPS_RETRIEVAL_FAILED",
    });
  }
}

/**
 * POST /api/projects/:projectId/devops/artifacts/:artifactId/regenerate
 * Regenerates an artifact using current repository intelligence.
 */
export async function regenerateDevopsArtifact(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);
    const { artifactId } = req.params;

    if (!isValidObjectId(artifactId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid artifact ID format.",
      });
    }

    const artifact = await defaultDevOpsService.regenerateArtifact({
      project,
      userId,
      artifactId,
      options: req.body?.options || {},
    });

    return res.status(200).json({
      success: true,
      data: {
        artifact,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to regenerate DevOps artifact.",
      code: err.code || "DEVOPS_REGENERATE_FAILED",
    });
  }
}

/**
 * POST /api/projects/:projectId/devops/artifacts/:artifactId/validate
 * Re-runs deterministic validation against a stored artifact.
 */
export async function validateDevopsArtifact(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);
    const { artifactId } = req.params;

    if (!isValidObjectId(artifactId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid artifact ID format.",
      });
    }

    const artifact = await defaultDevOpsService.validateArtifact({
      projectId: project._id,
      userId,
      artifactId,
    });

    return res.status(200).json({
      success: true,
      data: {
        artifact,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to validate DevOps artifact.",
      code: err.code || "DEVOPS_VALIDATE_FAILED",
    });
  }
}

/**
 * DELETE /api/projects/:projectId/devops/artifacts/:artifactId
 * Deletes an artifact belonging to the authorized project and user.
 */
export async function deleteDevopsArtifact(req, res) {
  try {
    const { project, userId } = await verifyProjectAccess(req);
    const { artifactId } = req.params;

    if (!isValidObjectId(artifactId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid artifact ID format.",
      });
    }

    const deleted = await defaultDevOpsService.deleteArtifact({
      projectId: project._id,
      userId,
      artifactId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "DevOps artifact not found or already deleted.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "DevOps artifact deleted successfully.",
    });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to delete DevOps artifact.",
      code: err.code || "DEVOPS_DELETE_FAILED",
    });
  }
}

