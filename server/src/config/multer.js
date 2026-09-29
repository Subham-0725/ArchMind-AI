// src/config/multer.js
//
// Multer disk-storage configuration for ZIP repository uploads.
//
// Constraints:
//   - Accepts valid .zip files (MIME type + file extension double-check)
//   - 50 MB hard ceiling
//   - Ephemeral disk storage targeting server/src/storage/uploads/
//   - Unique namespacing with timestamp and random UUID to prevent collisions

import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { UPLOADS_DIR } from "./storage.js";

/** 50 MB — hard ceiling for ZIP uploads */
export const MAX_ZIP_SIZE = 50 * 1024 * 1024;

/** Accepted MIME types for ZIP archives across various OS and browser combinations */
const ACCEPTED_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "multipart/x-zip",
  "application/x-compressed",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (_req, file, cb) => {
    const ts = Date.now();
    const shortId = randomUUID().slice(0, 8);
    // Sanitize original name: remove special chars, keep extension
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `zip-${ts}-${shortId}-${safeName}`);
  },
});

/**
 * Multer file filter — rejects non-ZIP uploads before they hit disk.
 *
 * Uses both MIME type and file extension validation because browser MIME
 * detection is unreliable across OS / browser combinations.
 */
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ACCEPTED_MIME_TYPES.has(file.mimetype);
  const extOk = ext === ".zip";

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    const err = new Error(
      "Only .zip archive files are accepted. Please upload a valid ZIP repository archive."
    );
    err.code = "UNSUPPORTED_FILE_TYPE";
    cb(err, false);
  }
};

/**
 * Configured Multer instance for single ZIP uploads.
 * Field name: "repository" — must match the FormData key on the client.
 */
const uploadZip = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_ZIP_SIZE,
    files: 1, // Only one file per request
  },
}).single("repository");

export default uploadZip;
