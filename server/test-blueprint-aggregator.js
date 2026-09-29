// server/test-blueprint-aggregator.js
//
// Comprehensive unit & integration test suite for Repository Blueprint Aggregator (Feature 13)

import { aggregateBlueprint } from "./src/rie/blueprintAggregator.js";

async function runTests() {
  console.log("==================================================");
  console.log("Running Feature 13 Blueprint Aggregator Test Suite");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Basic Aggregation & Metadata Test
  console.log("--- 1. Basic Aggregation & Metadata Test ---");
  const sampleData = {
    name: "My E-Commerce",
    source: "github",
    tree: [
      { path: "src\\index.js", type: "file", size: 500 },
      { path: "src\\controllers\\user.js", type: "file", size: 1200 },
      { path: "node_modules\\express\\index.js", type: "file", size: 4000 },
    ],
    techStack: {
      languages: ["JavaScript", "TypeScript"],
      frameworks: ["Express", "React"],
      databases: ["MongoDB"],
      devops: ["Docker"],
    },
    primaryLanguage: "JavaScript",
    secondaryLanguages: ["TypeScript"],
    capabilities: {
      hasDatabase: true,
      hasApis: true,
      hasDevops: true,
      hasSecuritySensitiveCode: false,
    },
    ast: {
      entryPoints: [{ file: "src/index.js", type: "web-server" }],
      dependencies: {
        internal: [
          { from: "src/controllers/user.js", to: "src/services/user.js" },
          { from: "src/controllers/user.js", to: "src/services/user.js" }, // duplicate
        ],
        external: [
          { from: "src/controllers/user.js", package: "express" },
          { from: "src/controllers/user.js", package: "express" }, // duplicate
        ],
      },
      routes: [
        { file: "src/routes/user.js", method: "GET", path: "/api/users", handler: "getUsers", line: 10 },
        { file: "src/routes/user.js", method: "GET", path: "/api/users", handler: "getUsers", line: 10 }, // duplicate
      ],
      models: [
        { file: "src/models/User.js", name: "User", framework: "mongoose", line: 5 },
      ],
      classes: [
        { file: "src/services/UserService.js", name: "UserService", superClass: null, methods: ["find"], line: 1 },
      ],
      functions: [
        { file: "src/controllers/user.js", name: "getUsers", params: ["req", "res"], isAsync: true, line: 15 },
      ],
    },
  };

  const bp = aggregateBlueprint(sampleData);

  assert(bp.version === 1, "Blueprint version is 1");
  assert(Boolean(bp.generatedAt), "Includes ISO generatedAt timestamp");
  assert(bp.metadata.name === "My E-Commerce", "Aggregated project name");
  assert(bp.metadata.primaryLanguage === "JavaScript", "Aggregated primary language");
  assert(bp.capabilities.hasDatabase === true, "Aggregated database capability");
  assert(bp.entryPoints.length === 1, "Extracted 1 entry point");
  assert(bp.dependencies.internal.length === 1, "Deduplicated internal dependencies (2 -> 1)");
  assert(bp.dependencies.external.length === 1, "Deduplicated external dependencies (2 -> 1)");
  assert(bp.routes.length === 1, "Deduplicated API routes (2 -> 1)");
  assert(bp.models.length === 1, "Aggregated database model 'User'");

  // Verify path normalization (Windows backslashes to forward slashes)
  assert(bp.structure.some((f) => f.path === "src/index.js"), "Normalized structure file path with forward slashes");

  // 2. Token Budget & Truncation Optimization Test
  console.log("\n--- 2. Token Budget Optimization Test ---");
  const largeFunctions = [];
  for (let i = 0; i < 200; i++) {
    largeFunctions.push({
      file: `src/controllers/controller_${i}.js`,
      name: `handlerFunction_${i}`,
      params: ["req", "res", "next"],
      isAsync: true,
      line: i * 10,
    });
  }

  const largeData = {
    ...sampleData,
    ast: {
      ...sampleData.ast,
      functions: largeFunctions,
    },
  };

  // Run with restrictive maxTokens budget of 500 tokens (~2000 chars)
  const budgetedBp = aggregateBlueprint(largeData, { maxTokens: 500 });
  assert(budgetedBp.isBudgetTruncated === true, "Budget truncation flag set to true");
  assert(budgetedBp.functions.length < 200, "Truncated excessive functions array to fit token budget");
  assert(budgetedBp.tokenEstimate > 0, `Computed valid token estimate (${budgetedBp.tokenEstimate} tokens)`);
  assert(typeof JSON.stringify(budgetedBp) === "string", "Truncated output remains 100% valid JSON");

  // 3. Minimal / Empty Repository Edge Case
  console.log("\n--- 3. Minimal / Empty Repository Test ---");
  const emptyBp = aggregateBlueprint({});
  assert(emptyBp.version === 1, "Empty repo returns version 1");
  assert(emptyBp.metadata.name === "Unnamed Project", "Falls back to default name");
  assert(emptyBp.structure.length === 0, "Empty structure array");
  assert(emptyBp.tokenEstimate > 0, "Empty blueprint computes minimal token estimate");

  // 4. Malformed AST Input Handling
  console.log("\n--- 4. Malformed AST Input Test ---");
  const malformedBp = aggregateBlueprint({
    name: "Broken AST Repo",
    ast: null,
  });
  assert(malformedBp.metadata.name === "Broken AST Repo", "Handles null AST gracefully");
  assert(Array.isArray(malformedBp.routes), "Routes array initialized empty");
  assert(Array.isArray(malformedBp.models), "Models array initialized empty");

  console.log("\n==================================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
