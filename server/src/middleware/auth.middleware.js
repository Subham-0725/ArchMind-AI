// src/middleware/auth.middleware.js
//
// Validates the incoming Clerk JWT using @clerk/express.
// Attaches req.auth.userId on success.
// Rejects requests with missing or invalid tokens with 401.

import { getAuth } from "@clerk/express";

/**
 * Middleware that requires a valid Clerk JWT.
 * Use on every route that needs an authenticated user.
 */
const requireAuth = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized — valid authentication token required.",
    });
  }

  next();
};

export default requireAuth;
