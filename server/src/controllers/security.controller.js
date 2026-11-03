// server/src/controllers/security.controller.js
//
// HTTP controller for ArchMind AI Phase 4 Security, Audit, Code Review, and Test Generation endpoints.
// Enforces Clerk authentication and multi-tenant project ownership.

import { getAuth } from "@clerk/express";
import { isValidObjectId } from "mongoose";
import Project from "../models/Project.js";
import { defaultSecurityAuditService } from "../services/security/securityAudit.service.js";
import { defaultCodeReviewService } from "../services/security/codeReview.service.js";
import { defaultTestGeneratorService } from "../services/security/testGenerator.service.js";

/**
 * Validates request authentication and verifies project ownership.
 *
 * @param {import('express').Request} req
 * @returns {Promise<Object>} Verified Project document
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
 * POST /api/projects/:projectId/security/scan
 * Triggers a security scan against the current repository version.
 */
export async function triggerSecurityScan(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);

    const scanResult = await defaultSecurityAuditService.runSecurityScan({
      project,
    });

    return res.status(200).json({
      success: true,
      data: {
        status: scanResult.audit.status,
        analysisVersion: scanResult.audit.analysisVersion,
        totalFindings: scanResult.totalFindings,
        severityCounts: scanResult.severityCounts,
        filesScanned: scanResult.audit.filesScanned,
        filesSkipped: scanResult.audit.filesSkipped,
        unsupportedFilesCount: scanResult.audit.unsupportedFilesCount,
        completedAt: scanResult.audit.completedAt,
      },
    });
  } catch (err) {
    console.error("[security.controller] triggerSecurityScan error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to execute security scan.",
      code: err.code || "SCAN_ERROR",
    });
  }
}

/**
 * GET /api/projects/:projectId/security
 * Returns overall security status, scan summary, and coverage info.
 */
export async function getSecuritySummary(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);

    const summary = await defaultSecurityAuditService.getSecuritySummary(
      project._id,
      project.analysisVersion
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("[security.controller] getSecuritySummary error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to retrieve security summary.",
      code: err.code || "SUMMARY_ERROR",
    });
  }
}

/**
 * GET /api/projects/:projectId/security/findings
 * Lists security findings with filtering, search, and pagination.
 */
export async function getSecurityFindings(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);

    const {
      severity,
      category,
      status,
      source,
      ruleId,
      filePath,
      page = 1,
      limit = 50,
    } = req.query;

    const result = await defaultSecurityAuditService.getFindings({
      projectId: project._id,
      analysisVersion: project.analysisVersion,
      filters: { severity, category, status, source, ruleId, filePath },
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.findings,
      pagination: {
        totalCount: result.totalCount,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    console.error("[security.controller] getSecurityFindings error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to retrieve security findings.",
      code: err.code || "FINDINGS_ERROR",
    });
  }
}

/**
 * GET /api/projects/:projectId/security/findings/:findingId
 * Retrieves detailed finding information.
 */
export async function getFindingDetail(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);
    const { findingId } = req.params;

    if (!isValidObjectId(findingId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid finding ID format.",
        code: "INVALID_FINDING_ID",
      });
    }

    const finding = await defaultSecurityAuditService.getFindingDetail(
      project._id,
      findingId
    );

    return res.status(200).json({
      success: true,
      data: finding,
    });
  } catch (err) {
    console.error("[security.controller] getFindingDetail error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to retrieve finding detail.",
      code: err.code || "FINDING_DETAIL_ERROR",
    });
  }
}

/**
 * PATCH /api/projects/:projectId/security/findings/:findingId
 * Updates finding status (open, resolved, ignored).
 */
export async function updateFindingStatus(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);
    const { findingId } = req.params;
    const { status } = req.body || {};

    if (!isValidObjectId(findingId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid finding ID format.",
        code: "INVALID_FINDING_ID",
      });
    }

    if (!status || typeof status !== "string") {
      return res.status(400).json({
        success: false,
        error: "Field 'status' is required ('open', 'resolved', or 'ignored').",
        code: "MISSING_STATUS",
      });
    }

    const updatedFinding = await defaultSecurityAuditService.updateFindingStatus(
      project._id,
      findingId,
      status.toLowerCase().trim()
    );

    return res.status(200).json({
      success: true,
      data: updatedFinding,
    });
  } catch (err) {
    console.error("[security.controller] updateFindingStatus error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to update finding status.",
      code: err.code || "UPDATE_STATUS_ERROR",
    });
  }
}

/**
 * POST /api/projects/:projectId/code-review
 * Triggers AI-assisted code review for a specified source file.
 */
export async function triggerCodeReview(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);
    const { filePath, customFocus } = req.body || {};

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({
        success: false,
        error: "Field 'filePath' is required.",
        code: "MISSING_FILE_PATH",
      });
    }

    const review = await defaultCodeReviewService.reviewFile({
      projectId: project._id,
      filePath: filePath.trim(),
      customFocus,
    });

    return res.status(200).json({
      success: true,
      data: review,
    });
  } catch (err) {
    console.error("[security.controller] triggerCodeReview error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to perform code review.",
      code: err.code || "CODE_REVIEW_ERROR",
    });
  }
}

/**
 * POST /api/projects/:projectId/tests/generate
 * Generates unit test preview for a specified source file.
 */
export async function triggerTestGeneration(req, res) {
  try {
    const { project } = await verifyProjectAccess(req);
    const { filePath } = req.body || {};

    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({
        success: false,
        error: "Field 'filePath' is required.",
        code: "MISSING_FILE_PATH",
      });
    }

    const testPreview = await defaultTestGeneratorService.generateTests({
      projectId: project._id,
      filePath: filePath.trim(),
    });

    return res.status(200).json({
      success: true,
      data: testPreview,
    });
  } catch (err) {
    console.error("[security.controller] triggerTestGeneration error:", err.message);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || "Failed to generate tests.",
      code: err.code || "TEST_GENERATION_ERROR",
    });
  }
}
