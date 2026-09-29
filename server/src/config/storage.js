// src/config/storage.js
//
// Centralized storage configuration for ephemeral workspaces.
// Ensures upload and extraction directories exist and provides safe cleanup helpers.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the ephemeral uploads directory (staged ZIP files) */
export const UPLOADS_DIR = path.resolve(__dirname, "../storage/uploads");

/** Absolute path to the ephemeral extracted/ workspace */
export const EXTRACTED_DIR = path.resolve(__dirname, "../storage/extracted");

/**
 * Initializes and guarantees storage directory availability.
 */
export const initStorage = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(EXTRACTED_DIR)) {
    fs.mkdirSync(EXTRACTED_DIR, { recursive: true });
  }
};

// Auto-initialize directories on load
initStorage();

/**
 * Safely removes a file if it exists.
 * @param {string} filePath - Absolute path to file
 */
export const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[storage] Failed to delete file ${filePath}:`, err.message);
  }
};

/**
 * Safely removes a directory recursively if it exists.
 * @param {string} dirPath - Absolute path to directory
 */
export const safeRmDir = (dirPath) => {
  if (!dirPath) return;
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[storage] Failed to delete directory ${dirPath}:`, err.message);
  }
};
