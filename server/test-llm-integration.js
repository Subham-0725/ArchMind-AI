// server/test-llm-integration.js
//
// Comprehensive unit & integration test suite for Feature 14 LLM API Integration

import {
  generateArchitecture,
  generateERD,
  parseAndValidateJson,
} from "./src/services/llmService.js";
import { executeModuleAnalysis } from "./src/controllers/analysis.controller.js";

async function runTests() {
  console.log("===============================================");
  console.log("Running Feature 14 LLM Integration Test Suite");
  console.log("===============================================\n");

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

  // 1. JSON Cleaning & Validation Test (Architecture)
  console.log("--- 1. Architecture Schema Validation & Repair Test ---");
  const markdownJson = `
\`\`\`json
{
  "nodes": [
    { "id": "n1", "type": "custom", "data": { "label": "API", "tier": "backend" } },
    { "id": "n2", "type": "custom", "data": { "label": "DB", "tier": "database" } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "label": "queries" },
    { "id": "e2", "source": "n1", "target": "n3_nonexistent", "label": "invalid" }
  ]
}
\`\`\`
  `;

  const parsedArch = parseAndValidateJson(markdownJson, "architecture");
  assert(parsedArch.nodes.length === 2, "Parsed 2 valid nodes");
  assert(parsedArch.edges.length === 1, "Filtered out edge referencing nonexistent node 'n3_nonexistent'");
  assert(parsedArch.edges[0].source === "n1" && parsedArch.edges[0].target === "n2", "Preserved valid edge n1 -> n2");

  // 2. ERD Schema Validation & Capability Guard Test
  console.log("\n--- 2. ERD Schema Validation & Capability Guard Test ---");
  const erdJson = `
{
  "entities": [
    { "id": "e_user", "name": "User", "fields": [{ "name": "id", "type": "String", "isPrimary": true }] },
    { "id": "e_project", "name": "Project", "fields": [{ "name": "id", "type": "String", "isPrimary": true }] }
  ],
  "relationships": [
    { "id": "r1", "sourceEntity": "e_user", "targetEntity": "e_project", "type": "one-to-many" },
    { "id": "r2", "sourceEntity": "e_user", "targetEntity": "e_missing", "type": "one-to-one" }
  ]
}
  `;

  const parsedErd = parseAndValidateJson(erdJson, "erd");
  assert(parsedErd.entities.length === 2, "Parsed 2 entities");
  assert(parsedErd.relationships.length === 1, "Filtered out relationship with missing target entity 'e_missing'");

  // Test ERD Capability Guard
  const nonDbBlueprint = {
    capabilities: { hasDatabase: false },
    metadata: { name: "Frontend Only" },
  };

  const erdResultNoDb = await generateERD(nonDbBlueprint, { mock: true });
  assert(erdResultNoDb === null, "ERD generation skipped (returns null) when hasDatabase is false");

  // 3. Mock Architecture Generation Test
  console.log("\n--- 3. Mock Architecture Generation Test ---");
  const sampleBlueprint = {
    metadata: { name: "Sample App", primaryLanguage: "JavaScript" },
    capabilities: { hasDatabase: true, details: { databases: ["MongoDB"] } },
    routes: [{ method: "GET", path: "/api/users" }],
    models: [{ name: "User" }],
  };

  const archMock = await generateArchitecture(sampleBlueprint, { mock: true });
  assert(Array.isArray(archMock.nodes) && archMock.nodes.length >= 2, "Generated valid mock architecture nodes");
  assert(Array.isArray(archMock.edges) && archMock.edges.length >= 1, "Generated valid mock architecture edges");

  const erdMock = await generateERD(sampleBlueprint, { mock: true });
  assert(Array.isArray(erdMock.entities) && erdMock.entities.length >= 1, "Generated valid mock ERD entities");
  assert(Array.isArray(erdMock.relationships), "Generated valid mock ERD relationships array");

  // 4. Invalid JSON Error Isolation Test
  console.log("\n--- 4. Malformed JSON Error Isolation Test ---");
  let caughtError = false;
  try {
    parseAndValidateJson("THIS IS NOT JSON AT ALL {{{", "architecture");
  } catch (err) {
    caughtError = true;
    assert(err.message.includes("Failed to parse LLM response as JSON"), "Safely rejects unparseable raw string");
  }
  assert(caughtError, "Caught error on malformed JSON");

  console.log("\n===============================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
