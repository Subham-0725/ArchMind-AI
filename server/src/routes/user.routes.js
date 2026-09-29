// src/routes/user.routes.js
//
// Maps HTTP verbs + paths to user controller handlers.
// requireAuth protects both endpoints — no unauthenticated access.

import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import { syncUser, getMe } from "../controllers/user.controller.js";

const router = Router();

// POST /api/users/sync — create or update user on login
router.post("/sync", requireAuth, syncUser);

// GET  /api/users/me   — retrieve current user's stored profile
router.get("/me", requireAuth, getMe);

export default router;
