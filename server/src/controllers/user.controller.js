// src/controllers/user.controller.js
//
// Handles user sync (create-or-update) and retrieval.
//
// syncUser  → POST /api/users/sync
//   Called by the frontend immediately after a successful Clerk sign-in.
//   Uses findOneAndUpdate with upsert:true so the same code path handles
//   both new registrations and returning users — no if/else branching.
//
// getMe     → GET /api/users/me
//   Returns the current authenticated user's stored profile.

import { getAuth } from "@clerk/express";
import User from "../models/User.js";

/**
 * POST /api/users/sync
 *
 * Creates a new user record on first login, or updates the existing one
 * with the latest profile data from the frontend (name, email, imageUrl).
 *
 * The frontend sends the data it already has from Clerk's useUser() hook —
 * we do NOT call Clerk's backend API here, which keeps this fast and avoids
 * an extra network hop.
 */
export const syncUser = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    // Auth middleware already validated the token, but belt-and-suspenders:
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { email, firstName, lastName, username, imageUrl } = req.body;

    // email is required — reject early with a clear message
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "A valid email address is required.",
      });
    }

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {
          clerkId: userId,
          email: email.toLowerCase().trim(),
          firstName: firstName?.trim() ?? "",
          lastName: lastName?.trim() ?? "",
          username: username?.trim() ?? "",
          imageUrl: imageUrl ?? "",
          lastLoginAt: new Date(),
        },
      },
      {
        // Create the document if it doesn't exist
        upsert: true,
        // Return the document after the update (not before)
        new: true,
        // Run schema validators on the fields being set
        runValidators: true,
      }
    );

    if (!user) {
      return res.status(500).json({
        success: false,
        error: "Failed to persist user profile.",
      });
    }

    return res.status(200).json({
      success: true,
      data: typeof user.toSafeObject === "function" ? user.toSafeObject() : user,
    });
  } catch (error) {
    console.error("[user.controller] syncUser error:", error);

    // Duplicate key race condition (two simultaneous first-logins from same user)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "User record conflict — please retry.",
      });
    }

    // Mongoose validation failure
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to sync user data. Please try again.",
    });
  }
};

/**
 * GET /api/users/me
 *
 * Returns the stored profile for the currently authenticated user.
 * Used to hydrate client-side state without re-hitting Clerk.
 */
export const getMe = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    const user = await User.findOne({ clerkId: userId }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found. Please sign in again.",
      });
    }

    // Build safe response manually from the lean document
    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        clerkId: user.clerkId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        imageUrl: user.imageUrl,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("[user.controller] getMe error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve user data. Please try again.",
    });
  }
};
