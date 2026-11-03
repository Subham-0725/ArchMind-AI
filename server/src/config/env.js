// src/config/env.js
//
// Centralized environment variable loader.
// Resolves .env relative to the server package root regardless of process.cwd().

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Try server/.env (relative to this file: ../../.env)
const serverEnvPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: serverEnvPath });

// 2. Fallback to process.cwd() .env if not found or empty
dotenv.config();

export const PORT = process.env.PORT || 5000;
export const MONGODB_URI = process.env.MONGODB_URI;
export const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
export const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Centralized Groq LLM Configuration
export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Validates presence of Groq configuration without exposing credentials.
 * @throws {Error} If GROQ_API_KEY is missing or invalid.
 */
export function validateGroqConfig() {
  const key = process.env.GROQ_API_KEY;
  if (!key || typeof key !== "string" || !key.trim() || key.startsWith("YOUR_")) {
    const err = new Error("Groq API key is not configured on the server. Please set GROQ_API_KEY in the server environment.");
    err.code = "GROQ_KEY_MISSING";
    err.status = 503;
    throw err;
  }
  return {
    apiKey: key.trim(),
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  };
}
