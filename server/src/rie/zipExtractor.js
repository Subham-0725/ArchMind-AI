// src/rie/zipExtractor.js
//
// Repository Intelligence Engine — Safe ZIP Extraction Module
//
// Responsibilities:
//   1. Validate ZIP magic bytes (PK signatures)
//   2. Prevent Zip Slip / Path Traversal attacks (verifies entries remain inside sandbox)
//   3. Reject empty or corrupted archives
//   4. Extract contents securely to a job-scoped directory
//   5. Provide safe error handling with typed codes (INVALID_ZIP, EMPTY_ZIP, SECURITY_ERROR, EXTRACT_ERROR)

import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { safeRmDir } from "../config/storage.js";

/** Valid ZIP header signatures: PK\x03\x04 (file), PK\x05\x06 (empty/central), PK\x07\x08 (spanned) */
const VALID_ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];

/**
 * Validates that the file starts with a recognized ZIP magic byte sequence.
 * @param {string} filePath - Absolute path to the uploaded file
 * @returns {boolean}
 */
const hasValidZipSignature = (filePath) => {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    return VALID_ZIP_SIGNATURES.some((sig) => buf.equals(sig));
  } catch {
    return false;
  }
};

/**
 * Extracts a ZIP archive safely into a dedicated job directory under extracted/.
 * Prevents Zip Slip vulnerabilities by verifying that all target extraction paths
 * resolve strictly within the designated job directory.
 *
 * @param {string} zipFilePath   - Absolute path to the uploaded .zip file
 * @param {string} extractedDir  - Absolute path to server/src/storage/extracted/
 * @param {string} jobId         - Unique identifier for this extraction job (UUID)
 * @returns {Promise<{ extractedPath: string, entryCount: number }>}
 *
 * @throws {Error} code: INVALID_ZIP    — file fails magic byte check or cannot be parsed
 * @throws {Error} code: EMPTY_ZIP      — archive has 0 entries
 * @throws {Error} code: SECURITY_ERROR — path traversal detected in ZIP entry (Zip Slip)
 * @throws {Error} code: EXTRACT_ERROR  — fs extraction failure
 */
export const extractZip = async (zipFilePath, extractedDir, jobId) => {
  // 1. Validate magic bytes
  if (!hasValidZipSignature(zipFilePath)) {
    const err = new Error(
      "The uploaded file is not a valid ZIP archive or may be corrupted."
    );
    err.code = "INVALID_ZIP";
    throw err;
  }

  // 2. Open ZIP archive
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (openErr) {
    const err = new Error(
      `Failed to open the ZIP archive: ${openErr.message || "File may be corrupted or password-protected."}`
    );
    err.code = "INVALID_ZIP";
    throw err;
  }

  const entries = zip.getEntries();

  // 3. Reject empty archives
  if (!entries || entries.length === 0) {
    const err = new Error(
      "The uploaded ZIP archive contains no files. Please upload a non-empty repository archive."
    );
    err.code = "EMPTY_ZIP";
    throw err;
  }

  // 4. Create job-scoped extraction workspace
  const extractedPath = path.resolve(extractedDir, jobId);
  try {
    fs.mkdirSync(extractedPath, { recursive: true });
  } catch (fsErr) {
    const err = new Error(`Failed to create extraction directory: ${fsErr.message}`);
    err.code = "EXTRACT_ERROR";
    throw err;
  }

  // 5. Safe entry-by-entry extraction with Zip Slip defense
  try {
    const resolvedBase = path.resolve(extractedPath);

    for (const entry of entries) {
      const entryName = entry.entryName;
      // Resolve absolute target path for this entry
      const targetPath = path.resolve(extractedPath, entryName);

      // Zip Slip Defense: Ensure the target path is strictly contained within extractedPath
      if (!targetPath.startsWith(resolvedBase + path.sep) && targetPath !== resolvedBase) {
        const err = new Error(
          `Security violation: ZIP entry '${entryName}' attempts directory traversal outside the extraction sandbox.`
        );
        err.code = "SECURITY_ERROR";
        throw err;
      }

      if (entry.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        const parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(targetPath, entry.getData());
      }
    }
  } catch (extractErr) {
    // Clean up partial extraction on failure
    safeRmDir(extractedPath);
    throw extractErr;
  }

  return {
    extractedPath,
    entryCount: entries.length,
  };
};
