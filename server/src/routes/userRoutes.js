import { Router } from "express";
import { syncUser, getCurrentUser } from "../controllers/userController.js";

const router = Router();

// All routes here are prefixed with /api/users
// Authentication is handled by clerkMiddleware in app.js
// Controllers extract userId via getAuth(req)

/**
 * POST /api/users/sync
 * Sync Clerk user profile to MongoDB
 * Protected: requires authentication
 */
router.post("/sync", syncUser);

/**
 * GET /api/users/me
 * Get current authenticated user's profile
 * Protected: requires authentication
 */
router.get("/me", getCurrentUser);

export default router;
