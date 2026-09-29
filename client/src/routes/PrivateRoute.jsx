// src/routes/PrivateRoute.jsx
//
// Guards any route that requires authentication.
//
// Behaviour:
//   - While Clerk resolves the session: renders a full-screen loading state
//     (prevents a white flash or premature redirect).
//   - Unauthenticated: uses Clerk's <RedirectToSignIn /> which sends the user
//     to the Clerk hosted sign-in page and returns them here after success.
//   - Authenticated: renders the protected page.

import { useAuth } from "@clerk/clerk-react";
import { RedirectToSignIn } from "@clerk/clerk-react";
import { motion } from "framer-motion";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#04060b] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/15" />
          <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin" />
        </div>
        <p className="text-xs font-mono text-slate-600 tracking-wider">
          Verifying session...
        </p>
      </motion.div>
    </div>
  );
}

export default function PrivateRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  // Clerk is still resolving the JWT — show a loading screen to prevent flash
  if (!isLoaded) return <LoadingScreen />;

  // Not authenticated — redirect to Clerk's hosted sign-in;
  // Clerk will return the user to this URL after a successful login.
  if (!isSignedIn) return <RedirectToSignIn />;

  return children;
}
