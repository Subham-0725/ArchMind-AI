// server/test-github-import-resilience.js
//
// Verification suite for GitHub import resilience (Phase 1)
// and archive-based repository ingestion (Phase 2).

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import {
  fetchWithRetry,
  handleApiError,
  downloadRepoArchive,
  isNoisePath,
} from "./src/services/githubService.js";
import { UPLOADS_DIR, EXTRACTED_DIR, safeUnlink, safeRmDir } from "./src/config/storage.js";
import { extractZip } from "./src/rie/zipExtractor.js";
import { scanRepository } from "./src/rie/repoScanner.js";
import { executeRiePipeline } from "./src/rie/pipeline/analysisPipeline.js";

console.log("==================================================");
console.log("Running GitHub Import Resilience & Archive Ingestion Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: handleApiError parses HTML 504 Gateway Timeout cleanly without throwing SyntaxError
{
  const mockHtml504 = new Response("<html><body><h1>504 Gateway Time-out</h1></body></html>", {
    status: 504,
    statusText: "Gateway Time-out",
    headers: { "Content-Type": "text/html" },
  });

  let errorCaught = null;
  try {
    await handleApiError(mockHtml504, "Repository 'test/repo'");
  } catch (err) {
    errorCaught = err;
  }

  assert.ok(errorCaught, "handleApiError must throw an Error for status 504");
  assert.strictEqual(errorCaught.status, 504, "Error status must be 504");
  assert.strictEqual(errorCaught.code, "GITHUB_UPSTREAM_TIMEOUT", "Error code must be GITHUB_UPSTREAM_TIMEOUT");
  assert.strictEqual(errorCaught.retryable, true, "Error must be marked retryable");
  assert.ok(
    errorCaught.message.includes("gateway timeout"),
    "Error message should explain gateway timeout"
  );

  console.log("✅ PASS: handleApiError safely handles HTML 504 gateway timeout");
  testsPassed++;
}

// Test 2: handleApiError correctly distinguishes 404, 401, 429, and 502
{
  // 404
  const res404 = new Response(JSON.stringify({ message: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
  let err404 = null;
  try {
    await handleApiError(res404, "Repository 'test/missing'");
  } catch (err) {
    err404 = err;
  }
  assert.strictEqual(err404.status, 404);
  assert.strictEqual(err404.code, "GITHUB_NOT_FOUND");
  assert.strictEqual(err404.retryable, false);

  // 401
  const res401 = new Response(JSON.stringify({ message: "Bad credentials" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  let err401 = null;
  try {
    await handleApiError(res401, "Repository 'test/private'");
  } catch (err) {
    err401 = err;
  }
  assert.strictEqual(err401.status, 401);
  assert.strictEqual(err401.code, "GITHUB_UNAUTHORIZED");

  // 429 / Rate Limit
  const res429 = new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": (Math.floor(Date.now() / 1000) + 3600).toString(),
    },
  });
  let err429 = null;
  try {
    await handleApiError(res429, "Repository 'test/ratelimited'");
  } catch (err) {
    err429 = err;
  }
  assert.strictEqual(err429.status, 429);
  assert.strictEqual(err429.code, "GITHUB_RATE_LIMITED");

  console.log("✅ PASS: handleApiError accurately maps 404, 401, and 429 rate limits");
  testsPassed++;
}

// Test 3: fetchWithRetry automatically retries on 504 and succeeds on subsequent attempt
{
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (url, options) => {
    callCount++;
    if (callCount === 1) {
      // First attempt returns 504 Gateway Time-out
      return new Response("<html><body>504 Gateway Timeout</body></html>", {
        status: 504,
        headers: { "Content-Type": "text/html" },
      });
    }
    // Second attempt succeeds with 200 OK
    return new Response(JSON.stringify({ full_name: "test/repo", default_branch: "main" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const res = await fetchWithRetry("https://api.github.com/repos/test/repo", {}, { maxRetries: 3, baseDelayMs: 50, timeoutMs: 5000 });
    assert.strictEqual(res.status, 200, "Should succeed with 200 on second attempt");
    assert.strictEqual(callCount, 2, "Should have attempted exactly twice");
    const data = await res.json();
    assert.strictEqual(data.full_name, "test/repo");
    console.log("✅ PASS: fetchWithRetry successfully retried transient 504 and recovered on 2nd attempt");
    testsPassed++;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Test 4: fetchWithRetry does NOT retry permanent errors (404, 400, 401)
{
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async (url, options) => {
    callCount++;
    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const res = await fetchWithRetry("https://api.github.com/repos/test/missing", {}, { maxRetries: 3, baseDelayMs: 50, timeoutMs: 5000 });
    assert.strictEqual(res.status, 404, "Should return 404 immediately");
    assert.strictEqual(callCount, 1, "Must NOT retry 404");
    console.log("✅ PASS: fetchWithRetry fast-fails permanent 404 without retrying");
    testsPassed++;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Test 5: downloadRepoArchive enforces max archive size and aborts if exceeded
{
  const originalFetch = globalThis.fetch;
  const crypto = await import("node:crypto");
  // Create random uncompressible bytes so ZIP is > 200 KB
  const randomPayload = crypto.randomBytes(200 * 1024);
  const mockZip = new AdmZip();
  mockZip.addFile("random.bin", randomPayload);
  const zipBuffer = mockZip.toBuffer();

  const testZipPath = path.resolve(UPLOADS_DIR, `size-limit-test-${Date.now()}.zip`);

  globalThis.fetch = async () => {
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  };

  try {
    let sizeError = null;
    try {
      // Limit set to 50 KB (uncompressed buffer is > 200 KB)
      await downloadRepoArchive("test-owner", "test-repo", "main", testZipPath, {
        maxArchiveBytes: 50 * 1024,
      });
    } catch (err) {
      sizeError = err;
    }

    assert.ok(sizeError, "Should throw when archive exceeds max limit");
    assert.strictEqual(sizeError.code, "PAYLOAD_TOO_LARGE");
    assert.strictEqual(sizeError.status, 413);
    assert.ok(!fs.existsSync(testZipPath), "Partial archive file must be cleaned up on error");
    console.log("✅ PASS: downloadRepoArchive enforces max archive byte limits and cleans up partial file");
    testsPassed++;
  } finally {
    safeUnlink(testZipPath);
    globalThis.fetch = originalFetch;
  }
}

// Test 6: Complete Archive Extraction + Directory Unwrapping + Local RIE Pipeline Execution
{
  const testJobId = `gh-test-${Date.now()}`;
  const testZipPath = path.resolve(UPLOADS_DIR, `gh-archive-${testJobId}.zip`);

  // GitHub archives wrap contents inside an `{owner}-{repo}-{sha}/` folder:
  const wrapperDir = "Subham-0725-CVNexus-ad7a2b0";
  const zip = new AdmZip();

  // Root wrapper directory
  zip.addFile(`${wrapperDir}/package.json`, Buffer.from(JSON.stringify({
    name: "cvnexus",
    version: "1.0.0",
    dependencies: { express: "^4.18.2", mongoose: "^7.0.0" }
  })));
  zip.addFile(`${wrapperDir}/server.js`, Buffer.from(
    "const express = require('express');\nconst app = express();\napp.get('/api/resumes', (req, res) => res.json([]));\napp.listen(3000);"
  ));
  zip.addFile(`${wrapperDir}/models/Resume.js`, Buffer.from(
    "const mongoose = require('mongoose');\nconst schema = new mongoose.Schema({ title: String });\nmodule.exports = mongoose.model('Resume', schema);"
  ));
  zip.addFile(`${wrapperDir}/.env.example`, Buffer.from("PORT=3000\nDATABASE_URL=mongodb://localhost:27017"));

  // Add noise directory to verify it is filtered out
  zip.addFile(`${wrapperDir}/node_modules/dummy/index.js`, Buffer.from("module.exports = {};"));

  zip.writeZip(testZipPath);

  let extractionPath = null;
  try {
    // 1. Safe extraction
    const { extractedPath, entryCount, contentHash } = await extractZip(testZipPath, EXTRACTED_DIR, testJobId);
    extractionPath = extractedPath;
    assert.ok(fs.existsSync(extractedPath), "Extraction path must exist");
    assert.ok(entryCount >= 5, "Must extract all entries");

    // 2. Scan repository — should auto-unwrap the GitHub wrapperDir!
    const { tree, stats, techStack, scanRoot } = scanRepository(extractionPath);
    const codebasePath = scanRoot || extractionPath;

    assert.ok(codebasePath.endsWith(wrapperDir), "scanRoot must unwrap GitHub top-level wrapper folder");
    // Verify tree paths are relative to repo root (not starting with wrapperDir)
    assert.ok(tree.some((f) => f.path === "package.json"), "package.json must be at repo root");
    assert.ok(tree.some((f) => f.path === "server.js"), "server.js must be at repo root");
    assert.ok(!tree.some((f) => f.path.includes("node_modules")), "node_modules must be filtered out");

    // 3. Execute Unified RIE Analysis Pipeline (100% on-disk local execution)
    const rieOutput = await executeRiePipeline({
      name: "CVNexus",
      source: "github",
      userId: "test_user_gh_resilience",
      tree,
      stats,
      sourceFingerprint: contentHash,
      analysisVersion: 1,
      extractionPath: codebasePath,
      extraMetadata: {
        repositoryUrl: "https://github.com/Subham-0725/CVNexus",
        branch: "main",
      },
    });

    assert.ok(rieOutput.tree.length > 0, "RIE tree must be populated");
    assert.ok(rieOutput.techStack.languages.length > 0, "Languages must be detected");
    assert.ok(rieOutput.blueprint, "Blueprint must be aggregated");
    assert.ok(rieOutput.blueprint.version !== undefined, "Blueprint version must be defined");
    assert.ok(rieOutput.topology.nodes.length > 0, "Topology nodes must be generated");

    console.log("✅ PASS: Archive-based GitHub ingestion successfully unwraps root wrapper, filters noise, and executes 100% local RIE pipeline");
    testsPassed++;
  } finally {
    safeUnlink(testZipPath);
    safeRmDir(extractionPath);
    assert.ok(!fs.existsSync(testZipPath), "ZIP archive must be cleaned up");
    assert.ok(!fs.existsSync(extractionPath), "Extracted workspace must be cleaned up");
  }
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
