// server/test-zip-upload-pipeline.js
//
// Verification suite for ZIP upload pipeline, storage configuration,
// watcher isolation, Zip Slip protection, and cleanup guarantees.

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { UPLOADS_DIR, EXTRACTED_DIR, safeUnlink, safeRmDir } from "./src/config/storage.js";
import { extractZip } from "./src/rie/zipExtractor.js";
import { scanRepository } from "./src/rie/repoScanner.js";
import { executeRiePipeline } from "./src/rie/pipeline/analysisPipeline.js";

console.log("==================================================");
console.log("Running ZIP Upload & Storage Pipeline Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Storage directories are outside server/src to prevent watcher restarts
{
  const serverRoot = path.resolve(import.meta.dirname, "..");
  const srcDir = path.resolve(serverRoot, "src");

  assert.ok(!UPLOADS_DIR.startsWith(srcDir + path.sep), "UPLOADS_DIR must not be located inside server/src");
  assert.ok(!EXTRACTED_DIR.startsWith(srcDir + path.sep), "EXTRACTED_DIR must not be located inside server/src");
  assert.ok(fs.existsSync(UPLOADS_DIR), "UPLOADS_DIR must exist");
  assert.ok(fs.existsSync(EXTRACTED_DIR), "EXTRACTED_DIR must exist");

  console.log("✅ PASS: Ephemeral storage directories isolated outside server/src/");
  testsPassed++;
}

// Test 2: Nodemon configuration ignores storage paths
{
  const nodemonConfigPath = path.resolve(import.meta.dirname, "nodemon.json");
  assert.ok(fs.existsSync(nodemonConfigPath), "nodemon.json must exist");

  const config = JSON.parse(fs.readFileSync(nodemonConfigPath, "utf8"));
  assert.ok(Array.isArray(config.ignore), "nodemon.json must configure ignore patterns");
  assert.ok(
    config.ignore.some((p) => p.includes("storage")),
    "nodemon.json must ignore storage directories"
  );

  console.log("✅ PASS: Nodemon configuration explicitly ignores storage changes");
  testsPassed++;
}

// Test 3: Safe Extraction of a Multi-File ZIP Archive with JS/JSON files
{
  const tempZipPath = path.resolve(UPLOADS_DIR, `test-repo-${Date.now()}.zip`);
  const jobId = `test-job-${Date.now()}`;

  // Create a real test ZIP archive containing JavaScript and JSON files
  const zip = new AdmZip();
  zip.addFile("package.json", Buffer.from(JSON.stringify({ name: "test-app", version: "1.0.0" })));
  zip.addFile("index.js", Buffer.from("console.log('test server');"));
  zip.addFile("routes/api.js", Buffer.from("module.exports = { routes: [] };"));
  zip.writeZip(tempZipPath);

  assert.ok(fs.existsSync(tempZipPath), "Test ZIP file must be written to disk");

  // Extract
  const { extractedPath, entryCount } = await extractZip(tempZipPath, EXTRACTED_DIR, jobId);

  assert.strictEqual(entryCount, 3, "All 3 entries must be parsed");
  assert.ok(fs.existsSync(extractedPath), "Extraction directory must exist");
  assert.ok(fs.existsSync(path.join(extractedPath, "package.json")), "package.json must be extracted");
  assert.ok(fs.existsSync(path.join(extractedPath, "index.js")), "index.js must be extracted");
  assert.ok(fs.existsSync(path.join(extractedPath, "routes", "api.js")), "routes/api.js must be extracted");

  // Cleanup
  safeUnlink(tempZipPath);
  safeRmDir(extractedPath);

  assert.ok(!fs.existsSync(tempZipPath), "Temporary ZIP file must be cleaned up");
  assert.ok(!fs.existsSync(extractedPath), "Extracted directory must be cleaned up");

  console.log("✅ PASS: Valid ZIP extraction and guaranteed cleanup");
  testsPassed++;
}

// Test 4: Rejection of Corrupted/Invalid Magic Byte Files
{
  const fakeZipPath = path.resolve(UPLOADS_DIR, `fake-zip-${Date.now()}.zip`);
  fs.writeFileSync(fakeZipPath, Buffer.from("NOT_A_VALID_ZIP_HEADER_CONTENT"));

  let caughtError = null;
  try {
    await extractZip(fakeZipPath, EXTRACTED_DIR, `job-invalid-${Date.now()}`);
  } catch (err) {
    caughtError = err;
  } finally {
    safeUnlink(fakeZipPath);
  }

  assert.ok(caughtError, "extractZip must throw on invalid ZIP signature");
  assert.strictEqual(caughtError.code, "INVALID_ZIP", "Must return typed error code INVALID_ZIP");

  console.log("✅ PASS: Corrupted/non-ZIP files rejected with INVALID_ZIP code");
  testsPassed++;
}

// Test 5: Rejection of Empty ZIP Archives
{
  const emptyZipPath = path.resolve(UPLOADS_DIR, `empty-zip-${Date.now()}.zip`);
  const zip = new AdmZip();
  zip.writeZip(emptyZipPath);

  let caughtError = null;
  try {
    await extractZip(emptyZipPath, EXTRACTED_DIR, `job-empty-${Date.now()}`);
  } catch (err) {
    caughtError = err;
  } finally {
    safeUnlink(emptyZipPath);
  }

  assert.ok(caughtError, "extractZip must throw on empty ZIP archive");
  assert.strictEqual(caughtError.code, "EMPTY_ZIP", "Must return typed error code EMPTY_ZIP");

  console.log("✅ PASS: Empty archives rejected with EMPTY_ZIP code");
  testsPassed++;
}

// Test 6: Zip Slip Path Traversal Protection
{
  const slipZipPath = path.resolve(UPLOADS_DIR, `zip-slip-${Date.now()}.zip`);
  const zip = new AdmZip();
  zip.addFile("evil.js", Buffer.from("malicious content"));
  // Set entryName directly to simulate malicious raw archive with directory traversal
  zip.getEntries()[0].entryName = "../../../outside-sandbox.js";
  zip.writeZip(slipZipPath);

  let caughtError = null;
  const jobId = `job-slip-${Date.now()}`;
  try {
    await extractZip(slipZipPath, EXTRACTED_DIR, jobId);
  } catch (err) {
    caughtError = err;
  } finally {
    safeUnlink(slipZipPath);
    safeRmDir(path.resolve(EXTRACTED_DIR, jobId));
  }

  assert.ok(caughtError, "extractZip must throw on path traversal attempt");
  assert.strictEqual(caughtError.code, "SECURITY_ERROR", "Must return typed error code SECURITY_ERROR");

  console.log("✅ PASS: Zip Slip path traversal attempts rejected with SECURITY_ERROR");
  testsPassed++;
}

// Test 7: Gitignore Configuration
{
  const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

  assert.ok(gitignoreContent.includes("storage/"), ".gitignore must ignore storage/");
  assert.ok(gitignoreContent.includes("src/storage/"), ".gitignore must ignore src/storage/");

  console.log("✅ PASS: .gitignore prevents committing ephemeral upload files");
  testsPassed++;
}

// Test 8: Full ZIP Upload Controller Pipeline Execution (Verify extractionPath is defined and piped)
{
  const tempZipPath = path.resolve(UPLOADS_DIR, `test-pipeline-${Date.now()}.zip`);
  const jobId = `job-pipeline-${Date.now()}`;
  let extractionPath = null;

  try {
    const zip = new AdmZip();
    zip.addFile(
      "package.json",
      Buffer.from(JSON.stringify({ name: "archmind-test-app", version: "1.0.0", dependencies: { express: "^4.18.2" } }))
    );
    zip.addFile(
      "server.js",
      Buffer.from(`
        const express = require("express");
        const app = express();
        app.get("/api/health", (req, res) => res.json({ status: "ok" }));
        app.listen(3000);
      `)
    );
    zip.writeZip(tempZipPath);

    // 1. Extraction
    const { extractedPath } = await extractZip(tempZipPath, EXTRACTED_DIR, jobId);
    extractionPath = extractedPath;
    assert.ok(extractionPath, "extractionPath must be defined after extractZip");
    assert.ok(fs.existsSync(extractionPath), "Extracted path must exist on disk");

    // 2. Scan repository
    const { tree, stats } = scanRepository(extractionPath);
    assert.ok(tree.length >= 2, "File tree must contain at least 2 files");

    // 3. Execute unified RIE pipeline with extractionPath
    const rieOutput = await executeRiePipeline({
      name: "ArchMind Test App",
      source: "zip",
      userId: "user_test_clerk_id",
      projectId: "6727a810f274a4918e97a1a1",
      tree,
      stats,
      sourceFingerprint: "sha256-test-fingerprint",
      analysisVersion: 1,
      extractionPath,
      extraMetadata: { branch: "main" },
    });

    assert.ok(rieOutput, "RIE pipeline output must be produced");
    assert.ok(rieOutput.blueprint, "Blueprint must be present");
    assert.strictEqual(rieOutput.primaryLanguage, "JavaScript");
    assert.ok(Array.isArray(rieOutput.apiRoutes), "apiRoutes must be an array");
  } finally {
    safeUnlink(tempZipPath);
    safeRmDir(extractionPath);
  }

  assert.ok(!fs.existsSync(tempZipPath), "Temporary test zip must be deleted in finally");
  assert.ok(!fs.existsSync(extractionPath), "Extracted path must be deleted in finally");

  console.log("✅ PASS: Full ZIP extraction and RIE pipeline executes with extractionPath defined and cleaned up");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
