import User from "../models/User.js";
import { getAuth } from "@clerk/express";

/**
 * Sync user profile from Clerk to MongoDB
 * Creates a new user on first login, updates on subsequent logins
 *
 * POST /api/users/sync
 */
export const syncUser = async (req, res) => {
  try {
    const { userId } = getAuth(req); // Extract userId from Clerk auth context
    const { email, firstName, lastName, username, imageUrl } = req.body;

    console.log("[syncUser] userId:", userId);
    console.log("[syncUser] email:", email);

    if (!userId) {
      console.log("[syncUser] No userId found");
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find existing user or create new one
    let user = await User.findOne({ clerkId: userId });

    if (user) {
      // Update existing user
      user.email = email;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.username = username || user.username;
      user.imageUrl = imageUrl || user.imageUrl;
      user.lastLoginAt = new Date();

      await user.save();
    } else {
      // Create new user
      user = await User.create({
        clerkId: userId,
        email,
        firstName: firstName || "",
        lastName: lastName || "",
        username: username || "",
        imageUrl: imageUrl || "",
        lastLoginAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: user.isNew ? "User created successfully" : "User updated successfully",
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
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error syncing user:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to sync user profile",
      error: error.message,
    });
  }
};

/**
 * Get current authenticated user's profile
 *
 * GET /api/users/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const { userId } = getAuth(req); // Extract userId from Clerk auth context

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID found",
      });
    }

    const user = await User.findOne({ clerkId: userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please sync your profile first.",
      });
    }

    res.status(200).json({
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
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};
