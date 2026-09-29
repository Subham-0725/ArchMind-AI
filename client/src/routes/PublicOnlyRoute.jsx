// src/routes/PublicOnlyRoute.jsx
//
// Guards routes that should only be accessible to unauthenticated users:
// the landing page, marketing pages, etc.
//
// Behaviour:
//   - While Clerk resolves the session: renders nothing (landing page has its
//     own fast skeleton so a brief null is acceptable here).
//   - Already authenticated: redirects to /dashboard so logged-in users don't
//     land on the marketing page.
//   - Unauthenticated: renders the public page normally.

import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export default function PublicOnlyRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  // Wait for Clerk to resolve before deciding — avoids incorrect redirects
  if (!isLoaded) return null;

  // Authenticated user visiting a public-only page → send them to the app
  if (isSignedIn) return <Navigate to="/dashboard" replace />;

  return children;
}
