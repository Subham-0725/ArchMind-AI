// server/src/controllers/report.controller.js
//
// HTTP Controller for ArchMind AI Phase 6 PDF Report Exports.
// Enforces Clerk authentication, project authorization, analysis readiness verification,
// and streams generated PDF reports.

import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import Project from "../models/Project.js";
import { streamProjectPdfReport } from "../services/reports/pdfReport.service.js";

/**
 * Validates request authentication and verifies project ownership.
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
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
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
 * GET /api/projects/:projectId/report/pdf
 * Streams a comprehensive PDF report for an analyzed project.
 */
export async function exportProjectPdfReport(req, res, next) {
  try {
    const { project } = await verifyProjectAccess(req);

    // Verify analysis is complete
    if (project.status !== "completed" && !project.blueprint?.generatedAt) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ANALYSIS_INCOMPLETE",
          message:
            "Repository analysis is incomplete. Please wait for analysis to complete before exporting a report.",
        },
      });
    }

    const sanitizedName = (project.name || "repository")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    const filename = `${sanitizedName}-archmind-report.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await streamProjectPdfReport(project, res);
  } catch (err) {
    // If headers already sent, pass to global error handler
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || "PDF_GENERATION_FAILED",
        message: err.message || "Failed to generate repository PDF report.",
      },
    });
  }
}

