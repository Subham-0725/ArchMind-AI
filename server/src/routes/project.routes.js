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
} from "../controllers/project.controller.js";
import {
  analyzeProject,
  analyzeModule,
  getAnalysisStatus,
} from "../controllers/analysis.controller.js";

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

// POST /api/projects/upload — upload a ZIP repository archive
router.post("/upload", requireAuth, handleMulterErrors(uploadZipMiddleware), uploadZip);

// POST /api/projects/github — import repository by GitHub URL
router.post("/github", requireAuth, importGithub);

// GET /api/projects — list user's projects
router.get("/", requireAuth, getProjects);

// ── Analysis endpoints (MUST be before /:id to avoid param collision) ─────────

// POST /api/projects/:id/analyze — run full analysis (queues all relevant modules)
router.post("/:id/analyze", requireAuth, analyzeProject);

// GET /api/projects/:id/analysis — get analysis status for all modules
router.get("/:id/analysis", requireAuth, getAnalysisStatus);

// GET /api/projects/:id/blueprint — get compiled repository blueprint
router.get("/:id/blueprint", requireAuth, getProjectBlueprint);

// POST /api/projects/:id/:module — trigger individual module analysis
router.post("/:id/:module", requireAuth, analyzeModule);

// ── Project detail endpoints ─────────────────────────────────────────────────

// GET /api/projects/:id — get project details with file tree
router.get("/:id", requireAuth, getProjectById);

// PATCH /api/projects/:id/status — update processing status and error details
router.patch("/:id/status", requireAuth, updateProjectStatus);

export default router;

