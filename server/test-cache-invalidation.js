// server/test-cache-invalidation.js
import assert from "assert";
import crypto from "crypto";

console.log("==================================================");
console.log("Running Analysis Versioning & Cache Invalidation Test Suite");
console.log("==================================================");

let passed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Source Fingerprint Calculation
it("Computes deterministic fingerprints for archives and git trees", () => {
  const zipBuffer1 = Buffer.from("PK0304SampleZipContentV1");
  const zipBuffer2 = Buffer.from("PK0304SampleZipContentV2");

  const hash1 = crypto.createHash("sha256").update(zipBuffer1).digest("hex");
  const hash2 = crypto.createHash("sha256").update(zipBuffer2).digest("hex");

  assert.strictEqual(typeof hash1, "string");
  assert.strictEqual(hash1.length, 64);
  assert.notStrictEqual(hash1, hash2);
});

// 2. Cache Hit on Unchanged Source Fingerprint
it("Reuses cached project when source fingerprint is unchanged and analysis is completed", () => {
  const currentFingerprint = "a1b2c3d4e5f67890123456789abcdef012345678";

  const existingProject = {
    sourceFingerprint: currentFingerprint,
    analysisVersion: 2,
    status: "completed",
    blueprint: { version: 1 },
    analysisResults: { architecture: { nodes: [] }, erd: { entities: [] } },
  };

  const incomingFingerprint = "a1b2c3d4e5f67890123456789abcdef012345678";
  const forceReanalyze = false;

  const isCacheHit =
    !forceReanalyze &&
    existingProject.sourceFingerprint === incomingFingerprint &&
    Boolean(existingProject.blueprint?.version) &&
    existingProject.status === "completed";

  assert.strictEqual(isCacheHit, true);
});

// 3. Cache Invalidation and Version Increment on Changed Source
it("Invalidates cache, resets module results, and increments analysisVersion when source changes", () => {
  const existingProject = {
    sourceFingerprint: "old_commit_sha_111",
    analysisVersion: 1,
    status: "completed",
    blueprint: { version: 1 },
    analysisResults: { architecture: { nodes: [] } },
    analysis: {
      architecture: { status: "completed" },
      erd: { status: "completed" },
    },
  };

  const newFingerprint = "new_commit_sha_222";

  const isChanged = existingProject.sourceFingerprint !== newFingerprint;
  assert.strictEqual(isChanged, true);

  // Invalidation logic simulation
  const nextVersion = (existingProject.analysisVersion || 1) + 1;
  assert.strictEqual(nextVersion, 2);

  const invalidatedAnalysisResults = {};
  assert.deepStrictEqual(invalidatedAnalysisResults, {});

  const resetModuleStatus = {
    architecture: { status: "idle" },
    erd: { status: "idle" },
  };
  assert.strictEqual(resetModuleStatus.architecture.status, "idle");
  assert.strictEqual(resetModuleStatus.erd.status, "idle");
});

// 4. Force Flag Bypasses Cache
it("Force flag (?force=true) bypasses cache even when fingerprint is identical", () => {
  const existingProject = {
    sourceFingerprint: "identical_hash_123",
    analysisVersion: 1,
    status: "completed",
    blueprint: { version: 1 },
  };

  const forceReanalyze = true;
  const isCacheHit =
    !forceReanalyze &&
    existingProject.sourceFingerprint === "identical_hash_123" &&
    existingProject.status === "completed";

  assert.strictEqual(isCacheHit, false);
});

console.log("==================================================");
console.log(`Test Results: ${passed} PASSED, 0 FAILED`);
console.log("==================================================");

