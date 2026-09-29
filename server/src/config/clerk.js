import "./env.js";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import { CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY } from "./env.js";

// Clerk middleware that adds auth context to req.auth
// Does NOT block unauthenticated requests
const clerk = clerkMiddleware({
  publishableKey: CLERK_PUBLISHABLE_KEY,
  secretKey: CLERK_SECRET_KEY,
});

// Middleware that requires authentication
// Use this on protected routes
export { requireAuth };

export default clerk;


