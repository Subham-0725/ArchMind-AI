// server/src/routes/security.routes.js
//
// Express router for Phase 4 Security, Audit, Code Review, and Test Generation endpoints.
// All endpoints are protected with requireAuth middleware.

import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import {
  triggerSecurityScan,
  getSecuritySummary,
  getSecurityFindings,
  getFindingDetail,
  updateFindingStatus,
  triggerCodeReview,
  triggerTestGeneration,
} from "../controllers/security.controller.js";

const router = Router({ mergeParams: true });

// ── Security Audit & Findings Endpoints ─────────────────────────────────────
router.post("/scan", requireAuth, triggerSecurityScan);
router.get("/", requireAuth, getSecuritySummary);
router.get("/findings", requireAuth, getSecurityFindings);
router.get("/findings/:findingId", requireAuth, getFindingDetail);
router.patch("/findings/:findingId", requireAuth, updateFindingStatus);

// ── AI Code Review & Test Generation Endpoints ──────────────────────────────
router.post("/code-review", requireAuth, triggerCodeReview);
router.post("/tests/generate", requireAuth, triggerTestGeneration);

export default router;

