// src/hooks/useUserSync.js
//
// Fires once after Clerk confirms the user is signed in.
// Syncs the Clerk profile to our MongoDB via POST /api/users/sync.
//
// Why a hook and not a component effect in Dashboard?
//   - Keeps the sync logic reusable — any route can use it.
//   - Dashboard stays thin (spec: pages orchestrate, not implement).
//   - If sync fails, the user still has a working session via Clerk;
//     we degrade gracefully and log the error.

import { useEffect, useState, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { syncUserWithBackend } from "../services/userService.js";

/**
 * Syncs the signed-in user's Clerk profile to MongoDB on mount.
 *
 * @returns {{ dbUser: Object|null, isSyncing: boolean, syncError: string|null }}
 */
export default function useUserSync() {
  const { isSignedIn, getToken } = useAuth();
  const { user, isLoaded } = useUser();

  const [dbUser, setDbUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Prevent the effect from running twice in React 19 StrictMode double-invoke
  const hasSynced = useRef(false);

  useEffect(() => {
    // Only sync once Clerk has fully loaded and the user is signed in
    if (!isLoaded || !isSignedIn || !user) return;
    // Prevent duplicate sync calls within the same session
    if (hasSynced.current) return;

    let cancelled = false;

    const sync = async () => {
      hasSynced.current = true;
      setIsSyncing(true);
      setSyncError(null);

      try {
        // Request a short-lived JWT from Clerk to authenticate the backend call
        const token = await getToken();

        if (!token) {
          throw new Error("Could not retrieve authentication token.");
        }

        const stored = await syncUserWithBackend(token, user);

        if (!cancelled) {
          setDbUser(stored);
        }
      } catch (err) {
        if (!cancelled) {
          // Log full error server-side context for debugging,
          // but store only a user-friendly message in state.
          console.error("[useUserSync] Failed to sync user:", err);
          setSyncError("Could not sync profile. Some features may be limited.");
          // Reset so the next mount can retry
          hasSynced.current = false;
        }
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    sync();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user, getToken]);

  return { dbUser, isSyncing, syncError };
}
