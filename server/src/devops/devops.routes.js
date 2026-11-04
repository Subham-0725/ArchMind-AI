// server/src/devops/devops.routes.js
//
// Express router for Phase 5 DevOps Artifact Generation endpoints.
// All endpoints are protected with requireAuth middleware.

import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import {
  generateDevops,
  listDevopsArtifacts,
  getDevopsArtifact,
  regenerateDevopsArtifact,
  validateDevopsArtifact,
  deleteDevopsArtifact,
} from "./devops.controller.js";

const router = Router({ mergeParams: true });

// POST /api/projects/:projectId/devops/generate
router.post("/generate", requireAuth, generateDevops);

// GET /api/projects/:projectId/devops/artifacts
router.get("/artifacts", requireAuth, listDevopsArtifacts);

// GET /api/projects/:projectId/devops/artifacts/:artifactId
router.get("/artifacts/:artifactId", requireAuth, getDevopsArtifact);

// POST /api/projects/:projectId/devops/artifacts/:artifactId/regenerate
router.post("/artifacts/:artifactId/regenerate", requireAuth, regenerateDevopsArtifact);

// POST /api/projects/:projectId/devops/artifacts/:artifactId/validate
router.post("/artifacts/:artifactId/validate", requireAuth, validateDevopsArtifact);

// DELETE /api/projects/:projectId/devops/artifacts/:artifactId
router.delete("/artifacts/:artifactId", requireAuth, deleteDevopsArtifact);

export default router;

