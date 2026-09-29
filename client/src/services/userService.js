// src/services/userService.js
//
// Axios calls for user-related backend endpoints.
// All requests send the Clerk JWT in the Authorization header.
// The token is passed in by the calling hook — this module has no Clerk dependency.

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

/**
 * Sync the authenticated user's profile with the backend.
 * Creates a new record on first login, updates on subsequent logins.
 *
 * @param {string} token   - Clerk JWT from useAuth().getToken()
 * @param {Object} profile - User profile data from Clerk's useUser() hook
 * @returns {Promise<Object>} Stored user data from MongoDB
 */
export const syncUserWithBackend = async (token, profile) => {
  const { data } = await api.post(
    "/api/users/sync",
    {
      email: profile.primaryEmailAddress?.emailAddress ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      username: profile.username ?? "",
      imageUrl: profile.imageUrl ?? "",
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return data.data;
};

/**
 * Fetch the current authenticated user's stored profile.
 *
 * @param {string} token - Clerk JWT from useAuth().getToken()
 * @returns {Promise<Object>} Stored user data from MongoDB
 */
export const fetchCurrentUser = async (token) => {
  const { data } = await api.get("/api/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.data;
};
