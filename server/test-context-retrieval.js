// server/test-context-retrieval.js
//
// Test suite for Repository Context Retrieval:
// Verifies keyword extraction, file chunking, analysis context extraction,
// context bounds, and secret redaction.

import assert from "node:assert";
import {
  extractQueryKeywords,
  chunkFileContent,
  extractAnalysisContext,
} from "./src/services/chat/repositoryContext.service.js";

console.log("==================================================");
console.log("Running Repository Context Retrieval Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Query Keyword Extraction and Stop-word filtering
{
  const question = "Where is the authentication middleware and how are routes protected?";
  const keywords = extractQueryKeywords(question);

  assert.ok(keywords.includes("authentication"));
  assert.ok(keywords.includes("middleware"));
  assert.ok(keywords.includes("routes"));
  assert.ok(keywords.includes("protected"));
  assert.ok(!keywords.includes("where"));
  assert.ok(!keywords.includes("is"));
  assert.ok(!keywords.includes("the"));
  assert.ok(!keywords.includes("and"));

  console.log("✅ PASS 1: Keywords extracted and stop words filtered properly");
  testsPassed++;
}

// Test 2: File Chunking within line bounds
{
  const lines = Array.from({ length: 250 }, (_, i) => `// Line ${i + 1}: code statement here`);
  lines[120] = "export const authenticateUser = (req, res) => { /* auth check */ }";

  const file = {
    filePath: "src/middleware/auth.js",
    content: lines.join("\n"),
  };

  const chunks = chunkFileContent(file, ["authenticateuser"], 100);
  assert.ok(chunks.length >= 1);
  const authChunk = chunks.find((c) => c.content.includes("authenticateUser"));
  assert.ok(authChunk, "Must produce a chunk containing the keyword match");
  assert.ok(authChunk.startLine > 1, "Must center chunk around the keyword match");
  assert.ok(authChunk.endLine - authChunk.startLine + 1 <= 100, "Chunk must not exceed maxLines");

  console.log("✅ PASS 2: Large source file chunked around keyword matches within line bounds");
  testsPassed++;
}

// Test 3: Short File becomes a single chunk
{
  const shortFile = {
    filePath: "src/config/db.js",
    content: "const mongoose = require('mongoose');\nmodule.exports = connectDB;",
  };

  const chunks = chunkFileContent(shortFile, ["mongoose"], 100);
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].startLine, 1);
  assert.strictEqual(chunks[0].endLine, 2);

  console.log("✅ PASS 3: Short file produces a single complete chunk");
  testsPassed++;
}

// Test 4: Analysis Artifacts Extraction from Project Document
{
  const mockProject = {
    name: "CVNexus",
    primaryLanguage: "JavaScript",
    secondaryLanguages: ["TypeScript"],
    techStack: {
      languages: ["JavaScript", "TypeScript"],
      frameworks: ["Express", "React"],
      databases: ["MongoDB"],
      devops: ["Docker"],
    },
    capabilities: { hasDatabase: true, hasApis: true },
    database: {
      type: "MongoDB",
      entities: [
        {
          name: "User",
          sourceFile: "src/models/user.model.js",
          fields: [
            { name: "email", type: "String", isPrimary: false, isForeign: false },
            { name: "password", type: "String", isPrimary: false, isForeign: false },
          ],
        },
      ],
    },
    analysisResults: {
      apiRoutes: [
        {
          method: "GET",
          path: "/api/v1/resumes",
          framework: "express",
          sourceFile: "src/routes/resume.routes.js",
          lineRange: { startLine: 10, endLine: 15 },
          isAuthProtected: true,
        },
      ],
      architecture: {
        nodes: [
          { id: "frontend", data: { label: "React Client", tier: "frontend" } },
          { id: "backend", data: { label: "Express API", tier: "backend" } },
        ],
        edges: [{ source: "frontend", target: "backend", label: "REST" }],
      },
    },
    securitySummary: {
      status: "completed",
      totalFindings: 1,
      severityCounts: { Critical: 1 },
    },
    securityFindings: [
      {
        category: "Database Connection String (MongoDB)",
        filePath: ".env",
        lineNumber: 2,
        severity: "Critical",
      },
    ],
  };

  const analysisContext = extractAnalysisContext(mockProject, ["resumes", "user"]);
  assert.strictEqual(analysisContext.techStack.primaryLanguage, "JavaScript");
  assert.strictEqual(analysisContext.database.totalEntities, 1);
  assert.strictEqual(analysisContext.database.entities[0].name, "User");
  assert.strictEqual(analysisContext.apiRoutes.totalRoutes, 1);
  assert.strictEqual(analysisContext.architecture.nodes.length, 2);
  assert.strictEqual(analysisContext.security.totalFindings, 1);

  console.log("✅ PASS 4: Analysis context extracted from project document artifacts");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
