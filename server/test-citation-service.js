// server/test-citation-service.js
//
// Test suite for Citation Extraction & Verification:
// Verifies regex parsing, JSON blocks, path traversal rejection,
// line-number bounds, overlap with retrieved context, and deduplication.

import assert from "node:assert";
import { extractRawCitations, verifyCitations } from "./src/services/chat/citation.service.js";

console.log("==================================================");
console.log("Running Citation Service Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Extract citations from standard textual patterns
{
  const text = `
Authentication is implemented via Clerk in the middleware.
Sources:
- server/src/middleware/auth.middleware.js, lines 12–38
- server/src/app.js:40-55
Also check src/models/User.js:L5-L18.
`;

  const extracted = extractRawCitations(text);
  assert.strictEqual(extracted.length, 3);
  assert.strictEqual(extracted[0].rawPath, "server/src/middleware/auth.middleware.js");
  assert.strictEqual(extracted[0].startLine, 12);
  assert.strictEqual(extracted[0].endLine, 38);

  assert.strictEqual(extracted[1].rawPath, "server/src/app.js");
  assert.strictEqual(extracted[1].startLine, 40);
  assert.strictEqual(extracted[1].endLine, 55);

  assert.strictEqual(extracted[2].rawPath, "src/models/User.js");
  assert.strictEqual(extracted[2].startLine, 5);
  assert.strictEqual(extracted[2].endLine, 18);

  console.log("✅ PASS 1: Raw citations extracted from varied text patterns");
  testsPassed++;
}

// Test 2: Extract citations from structured JSON code block
{
  const textWithJson = `
Here is the explanation of the routing structure.
\`\`\`json
{
  "citations": [
    { "filePath": "server/routes/api.js", "startLine": 10, "endLine": 30 },
    { "filePath": "server/controllers/userController.js", "startLine": 45, "endLine": 75 }
  ]
}
\`\`\`
`;

  const extracted = extractRawCitations(textWithJson);
  assert.ok(extracted.length >= 2);
  assert.strictEqual(extracted[0].rawPath, "server/routes/api.js");
  assert.strictEqual(extracted[0].startLine, 10);
  assert.strictEqual(extracted[0].endLine, 30);

  console.log("✅ PASS 2: Citations extracted from embedded JSON block");
  testsPassed++;
}

// Test 3: Verification with valid overlap in retrieved context
{
  const rawCitations = [
    { rawPath: "src/controllers/auth.controller.js", startLine: 15, endLine: 35 },
  ];

  const retrievedChunks = [
    {
      filePath: "src/controllers/auth.controller.js",
      startLine: 10,
      endLine: 50,
      content: "// auth code...",
    },
  ];

  const projectTree = [
    { path: "src/controllers/auth.controller.js", type: "file" },
  ];

  const verified = verifyCitations(rawCitations, retrievedChunks, projectTree);
  assert.strictEqual(verified.length, 1);
  assert.strictEqual(verified[0].filePath, "src/controllers/auth.controller.js");
  assert.strictEqual(verified[0].startLine, 15);
  assert.strictEqual(verified[0].endLine, 35);

  console.log("✅ PASS 3: Citation verified within valid retrieved context chunk");
  testsPassed++;
}

// Test 4: Rejection of line range outside retrieved chunks (hallucination defense)
{
  const rawCitations = [
    // Model cited lines 300-350, but retrieved context only covered lines 1-100
    { rawPath: "src/app.js", startLine: 300, endLine: 350 },
  ];

  const retrievedChunks = [
    {
      filePath: "src/app.js",
      startLine: 1,
      endLine: 100,
      content: "// setup code...",
    },
  ];

  const projectTree = [
    { path: "src/app.js", type: "file" },
  ];

  const verified = verifyCitations(rawCitations, retrievedChunks, projectTree);
  assert.strictEqual(verified.length, 0, "Out-of-context line range must be rejected");

  console.log("✅ PASS 4: Out-of-bounds hallucinated line range rejected");
  testsPassed++;
}

// Test 5: Rejection of fabricated or non-existent files
{
  const rawCitations = [
    { rawPath: "server/invented/fakeService.js", startLine: 1, endLine: 20 },
  ];

  const retrievedChunks = [
    { filePath: "server/realService.js", startLine: 1, endLine: 50 },
  ];

  const projectTree = [
    { path: "server/realService.js", type: "file" },
  ];

  const verified = verifyCitations(rawCitations, retrievedChunks, projectTree);
  assert.strictEqual(verified.length, 0, "Fabricated file must be rejected");

  console.log("✅ PASS 5: Fabricated file path rejected");
  testsPassed++;
}

// Test 6: Rejection of path traversal attempts
{
  const rawCitations = [
    { rawPath: "../../etc/passwd", startLine: 1, endLine: 10 },
    { rawPath: "../secrets.env", startLine: 1, endLine: 5 },
  ];

  const retrievedChunks = [];
  const projectTree = [{ path: "secrets.env", type: "file" }];

  const verified = verifyCitations(rawCitations, retrievedChunks, projectTree);
  assert.strictEqual(verified.length, 0, "Path traversal citations must be rejected");

  console.log("✅ PASS 6: Path traversal attempts rejected");
  testsPassed++;
}

// Test 7: Deduplication of duplicate citations
{
  const rawCitations = [
    { rawPath: "src/utils/math.js", startLine: 10, endLine: 20 },
    { rawPath: "src/utils/math.js", startLine: 10, endLine: 20 },
    { rawPath: "./src/utils/math.js", startLine: 10, endLine: 20 },
  ];

  const retrievedChunks = [
    { filePath: "src/utils/math.js", startLine: 1, endLine: 100 },
  ];

  const projectTree = [{ path: "src/utils/math.js", type: "file" }];

  const verified = verifyCitations(rawCitations, retrievedChunks, projectTree);
  assert.strictEqual(verified.length, 1, "Duplicate citations must be deduplicated");

  console.log("✅ PASS 7: Duplicate citations deduplicated cleanly");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
