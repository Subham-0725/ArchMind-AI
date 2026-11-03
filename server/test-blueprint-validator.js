// server/test-blueprint-validator.js
import assert from "assert";
import { validateBlueprint, isValidBlueprint, isSafeFilePath, BlueprintValidationError } from "./src/rie/validation/blueprintValidator.js";

console.log("==================================================");
console.log("Running RIE Blueprint Validator Test Suite");
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

// 1. Safe File Path Tests
it("Validates path safety and detects directory traversal attempts", () => {
  assert.strictEqual(isSafeFilePath("src/index.js"), true);
  assert.strictEqual(isSafeFilePath("controllers/user.controller.ts"), true);
  assert.strictEqual(isSafeFilePath("../etc/passwd"), false);
  assert.strictEqual(isSafeFilePath("src/../../secret.key"), false);
  assert.strictEqual(isSafeFilePath("/etc/shadow"), false);
  assert.strictEqual(isSafeFilePath("src\\index.js"), false); // backslashes rejected
  assert.strictEqual(isSafeFilePath(""), false);
});

// 2. Valid Blueprint Acceptance
it("Accepts a fully valid Blueprint", () => {
  const validBp = {
    version: 1,
    generatedAt: new Date().toISOString(),
    metadata: {
      name: "ArchMind Test",
      source: "github",
      primaryLanguage: "JavaScript",
      secondaryLanguages: ["TypeScript"],
      techStack: { languages: ["JavaScript"], frameworks: ["Express"], databases: ["MongoDB"], devops: [] },
    },
    capabilities: {
      hasDatabase: true,
      hasApis: true,
      hasDevops: false,
      hasSecuritySensitiveCode: true,
    },
    entryPoints: [{ file: "src/server.js", type: "web-server" }],
    structure: [
      { path: "src/server.js", type: "file", size: 1024 },
      { path: "src/models/User.js", type: "file", size: 512 },
    ],
    dependencies: {
      internal: [{ from: "src/server.js", to: "src/models/User.js" }],
      external: [{ from: "src/server.js", package: "express" }],
    },
    routes: [{ file: "src/server.js", method: "GET", path: "/api/users", line: 20 }],
    models: [{ file: "src/models/User.js", name: "User" }],
    classes: [],
    functions: [{ file: "src/server.js", name: "startServer", line: 40 }],
    database: {
      type: "MongoDB",
      entities: [
        {
          name: "User",
          fields: [{ name: "email", type: "String" }],
        },
      ],
      relationships: [],
    },
    tokenEstimate: 450,
    isBudgetTruncated: false,
  };

  const res = isValidBlueprint(validBp);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
  assert.doesNotThrow(() => validateBlueprint(validBp));
});

// 3. Rejects Missing Required Fields
it("Rejects blueprint with missing metadata or capabilities", () => {
  const badBp = {
    version: 1,
    generatedAt: "2026-11-03T00:00:00Z",
    metadata: {
      name: "", // empty name
      source: "zip",
      // missing primaryLanguage
    },
    capabilities: {
      hasDatabase: "true", // string instead of boolean
    },
    structure: "not-an-array",
    entryPoints: [],
    dependencies: {},
    routes: [],
    models: [],
    classes: [],
    functions: [],
    tokenEstimate: -5,
    isBudgetTruncated: false,
  };

  const res = isValidBlueprint(badBp);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.length >= 4);
  assert.throws(() => validateBlueprint(badBp), BlueprintValidationError);
});

// 4. Rejects Broken Database Relationships
it("Rejects database relationship that points to a non-existent entity", () => {
  const bp = {
    version: 1,
    generatedAt: new Date().toISOString(),
    metadata: { name: "Test App", source: "zip", primaryLanguage: "Python" },
    capabilities: { hasDatabase: true, hasApis: false, hasDevops: false, hasSecuritySensitiveCode: false },
    entryPoints: [],
    structure: [],
    dependencies: { internal: [], external: [] },
    routes: [],
    models: [],
    classes: [],
    functions: [],
    database: {
      type: "PostgreSQL",
      entities: [{ name: "User", fields: [] }],
      relationships: [{ from: "User", to: "NonExistentEntity" }],
    },
    tokenEstimate: 100,
    isBudgetTruncated: false,
  };

  const res = isValidBlueprint(bp);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("NonExistentEntity")));
});

console.log("==================================================");
console.log(`Test Results: ${passed} PASSED, 0 FAILED`);
console.log("==================================================");

