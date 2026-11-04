// src/routes/project.routes.js
//
// Express router for project endpoints.
// All endpoints are protected with requireAuth middleware.

import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import uploadZipMiddleware from "../config/multer.js";
import {
  importGithub,
  getProjects,
  getProjectById,
  uploadZip,
  updateProjectStatus,
  getProjectBlueprint,
  getProjectFile,
  deleteProject,
  updateProjectMetadata,
  reanalyzeProject,
} from "../controllers/project.controller.js";
import { exportProjectPdfReport } from "../controllers/report.controller.js";
import {
  analyzeProject,
  analyzeModule,
  getAnalysisStatus,
} from "../controllers/analysis.controller.js";
import {
  getProjectApiRoutes,
  getProjectApiRouteDetail,
  getRouteSequenceDiagram,
} from "../controllers/apiRoute.controller.js";
import chatRoutes from "./chat.routes.js";
import securityRoutes from "./security.routes.js";
import devopsRoutes from "../devops/devops.routes.js";
import {
  triggerCodeReview,
  triggerTestGeneration,
} from "../controllers/security.controller.js";

const router = Router();

/**
 * Wraps Multer middleware to convert Multer-specific errors (file size, file type)
 * into structured JSON responses instead of letting them bubble as HTML Express errors.
 *
 * @param {import('multer').Multer['single']} multerMiddleware
 */
const handleMulterErrors = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();

    // Multer file size exceeded
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error: "ZIP file exceeds the 50 MB size limit. Please upload a smaller archive.",
        code: "LIMIT_FILE_SIZE",
      });
    }

    // Rejected by fileFilter (unsupported type)
    if (err.code === "UNSUPPORTED_FILE_TYPE") {
      return res.status(422).json({
        success: false,
        error: err.message,
        code: "UNSUPPORTED_FILE_TYPE",
      });
    }

    // All other Multer errors
    return res.status(400).json({
      success: false,
      error: err.message || "File upload failed.",
      code: "UPLOAD_ERROR",
    });
  });
};

const logUploadStage = (stage) => (req, _res, next) => {
  console.log(`[UPLOAD] ${stage}`);
  next();
};

// POST /api/projects/upload — upload a ZIP repository archive
router.post(
  "/upload",
  logUploadStage("Request received"),
  requireAuth,
  logUploadStage("Authentication passed"),
  handleMulterErrors(uploadZipMiddleware),
  logUploadStage("Multipart middleware completed"),
  uploadZip
);

// POST /api/projects/github — import repository by GitHub URL
router.post("/github", requireAuth, importGithub);

// GET /api/projects — list user's projects
router.get("/", requireAuth, getProjects);

// ── Analysis endpoints (MUST be before /:id to avoid param collision) ─────────

// POST /api/projects/:id/analyze — run full analysis (queues all relevant modules)
router.post("/:id/analyze", requireAuth, analyzeProject);

// POST /api/projects/:id/reanalyze — reanalyze repository (version increment, cache reset, RIE rerun)
router.post("/:id/reanalyze", requireAuth, reanalyzeProject);
router.post("/:projectId/reanalyze", requireAuth, reanalyzeProject);

// GET /api/projects/:id/analysis — get analysis status for all modules
router.get("/:id/analysis", requireAuth, getAnalysisStatus);

// GET /api/projects/:id/report/pdf — export comprehensive architecture PDF report
router.get("/:id/report/pdf", requireAuth, exportProjectPdfReport);
router.get("/:projectId/report/pdf", requireAuth, exportProjectPdfReport);

// GET /api/projects/:id/blueprint — get compiled repository blueprint
router.get("/:id/blueprint", requireAuth, getProjectBlueprint);

// GET /api/projects/:id/file?path=... — retrieve source file content
router.get("/:id/file", requireAuth, getProjectFile);

// ── API Route Intelligence endpoints ─────────────────────────────────────────

// GET /api/projects/:id/api-routes — list extracted routes with filtering
router.get("/:id/api-routes", requireAuth, getProjectApiRoutes);

// GET /api/projects/:id/api-routes/:routeId/sequence — get request sequence diagram
router.get("/:id/api-routes/:routeId/sequence", requireAuth, getRouteSequenceDiagram);

// GET /api/projects/:id/api-routes/:routeId — get route detail with citation
router.get("/:id/api-routes/:routeId", requireAuth, getProjectApiRouteDetail);

// ── Security & Code Quality endpoints ───────────────────────────────────────
router.use("/:projectId/security", securityRoutes);
router.use("/:id/security", securityRoutes);
router.post("/:projectId/code-review", requireAuth, triggerCodeReview);
router.post("/:id/code-review", requireAuth, triggerCodeReview);
router.post("/:projectId/tests/generate", requireAuth, triggerTestGeneration);
router.post("/:id/tests/generate", requireAuth, triggerTestGeneration);

// ── Repository AI Chat endpoints ─────────────────────────────────────────────
router.use("/:projectId/chat", chatRoutes);
router.use("/:id/chat", chatRoutes);

// ── DevOps Artifact Generation endpoints (Phase 5) ──────────────────────────
router.use("/:projectId/devops", devopsRoutes);
router.use("/:id/devops", devopsRoutes);

// ── Project detail endpoints ─────────────────────────────────────────────────

// GET /api/projects/:id — get project details with file tree
router.get("/:id", requireAuth, getProjectById);

// PATCH /api/projects/:id — update permitted project metadata (name, description)
router.patch("/:id", requireAuth, updateProjectMetadata);

// DELETE /api/projects/:id — delete project and cascade cleanup all child collections/files
router.delete("/:id", requireAuth, deleteProject);

// PATCH /api/projects/:id/status — update processing status and error details
router.patch("/:id/status", requireAuth, updateProjectStatus);

// ── Analysis module execution (placed after explicit sub-resource routes to prevent route collisions) ──
// POST /api/projects/:id/:module — trigger individual module analysis (architecture, erd, api, security, devops)
router.post("/:id/:module", requireAuth, analyzeModule);

export default router;

