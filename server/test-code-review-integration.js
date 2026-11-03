// server/test-code-review-integration.js
//
// Integration test verifying Phase 4 AI Code Review routing, module validation,
// and end-to-end execution through the Express router without network sockets.

import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import express from "express";
import mongoose from "mongoose";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import projectRoutes from "./src/routes/project.routes.js";
import { defaultCodeReviewService } from "./src/services/security/codeReview.service.js";

console.log("==================================================");
console.log("Running Code Review Route & Integration Tests");
console.log("==================================================");

let testsPassed = 0;

// Setup test Express app with mock auth middleware injecting test user
const app = express();
app.use(express.json());

let currentAuthUserId = "user_owner_456";

// Mock auth middleware for testing
app.use((req, res, next) => {
  if (currentAuthUserId) {
    req.auth = { userId: currentAuthUserId };
  } else {
    req.auth = null;
  }
  next();
});

app.use("/api/projects", projectRoutes);

// Helper to simulate an Express HTTP request using app.handle
function dispatch(app, { method, url, body = null }) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      "content-type": "application/json",
    };
    req.body = body || {};

    const res = new http.ServerResponse(req);
    res.body = null;

    res.json = function (data) {
      this.body = data;
      resolve({ status: this.statusCode, body: data });
      return this;
    };

    res.send = function (data) {
      this.body = data;
      resolve({ status: this.statusCode, body: data });
      return this;
    };

    app.handle(req, res, () => {
      resolve({ status: 404, body: { error: "Not found" } });
    });
  });
}

// In-memory mock database
const db = {
  projects: new Map(),
  sourceFiles: new Map(),
};

const ownerId = "user_owner_456";
const intruderId = "user_intruder_789";
const projectId = new mongoose.Types.ObjectId().toString();

// Seed test project
db.projects.set(projectId, {
  _id: projectId,
  userId: ownerId,
  name: "Code Review Test Project",
  analysisVersion: 1,
  tree: [
    {
      path: "src/utils/math.js",
      type: "file",
      content: "function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };",
    },
    {
      path: "src/controllers/user.js",
      type: "file",
      content: "const key = 'AKIAIOSFODNN7EXAMPLE';\neval(req.query.cmd);",
    },
  ],
  capabilities: {
    hasDatabase: true,
    hasApis: true,
    hasSecuritySensitiveCode: true,
  },
});

// Seed source files
db.sourceFiles.set(`${projectId}:src/utils/math.js`, {
  _id: "sf-math",
  projectId,
  filePath: "src/utils/math.js",
  fileName: "math.js",
  language: "javascript",
  content: "function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };",
  lineCount: 4,
});

// Mock Mongoose models
Project.findById = function (id) {
  const p = db.projects.get(String(id));
  const res = p ? { ...p } : null;
  return {
    lean: () => Promise.resolve(res),
    then: (resolve, reject) => Promise.resolve(res).then(resolve, reject),
  };
};

Project.findOne = function (filter) {
  for (const p of db.projects.values()) {
    if (filter._id && String(p._id) !== String(filter._id)) continue;
    if (filter.userId && p.userId !== filter.userId) continue;
    return Promise.resolve({ ...p });
  }
  return Promise.resolve(null);
};

SourceFile.findOne = function (filter) {
  for (const sf of db.sourceFiles.values()) {
    if (String(sf.projectId) === String(filter.projectId) && sf.filePath === filter.filePath) {
      return { lean: () => Promise.resolve(sf) };
    }
  }
  return { lean: () => Promise.resolve(null) };
};

async function runTests() {
  const baseUrl = `/api/projects`;

  // ── Test 1: POST /api/projects/:id/code-review is NOT rejected as invalid module
  const originalCompleteChat = defaultCodeReviewService.groqService.completeChat;
  defaultCodeReviewService.groqService.completeChat = async () => ({
    content: JSON.stringify({
      summary: "Code review clean and concise.",
      overallScore: 92,
      findings: [
        {
          category: "maintainability",
          title: "Prefer arrow function",
          severity: "Low",
          confidence: "High",
          startLine: 1,
          endLine: 3,
          explanation: "Use modern arrow syntax",
          suggestedImprovement: "const add = (a, b) => a + b;",
        },
      ],
    }),
    model: "openai/gpt-oss-120b",
  });

  const resReview = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/utils/math.js" },
  });

  assert.strictEqual(resReview.status, 200, `Expected 200 OK, got ${resReview.status}: ${JSON.stringify(resReview.body)}`);
  assert.strictEqual(resReview.body.success, true);
  assert.strictEqual(resReview.body.data.filePath, "src/utils/math.js");
  assert.strictEqual(resReview.body.data.overallScore, 92);
  assert.strictEqual(Array.isArray(resReview.body.data.findings), true);
  console.log("✅ PASS 1: POST /api/projects/:id/code-review successfully routes to triggerCodeReview and returns 200");
  testsPassed++;

  // ── Test 2: Custom review focus is safely passed and processed
  let capturedPrompt = "";
  defaultCodeReviewService.groqService.completeChat = async (messages) => {
    capturedPrompt = messages[1].content;
    return {
      content: JSON.stringify({
        summary: "Focused review completed.",
        overallScore: 88,
        findings: [],
      }),
      model: "openai/gpt-oss-120b",
    };
  };

  const resFocus = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: {
      filePath: "src/utils/math.js",
      customFocus: "Input sanitization and memory leaks",
    },
  });
  assert.strictEqual(resFocus.status, 200);
  assert.ok(capturedPrompt.includes("Input sanitization and memory leaks"), "Prompt must include customFocus");
  console.log("✅ PASS 2: Custom review focus is optional and safely passed to LLM prompt");
  testsPassed++;

  // ── Test 3: Path Traversal attempts are rejected with 400 INVALID_PATH
  const resTraversal = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "../../../etc/passwd" },
  });
  assert.strictEqual(resTraversal.status, 400);
  assert.strictEqual(resTraversal.body.code, "INVALID_PATH");
  console.log("✅ PASS 3: Path traversal attempt is strictly rejected with 400 INVALID_PATH");
  testsPassed++;

  // ── Test 4: Missing or unavailable file is rejected with 404 FILE_NOT_FOUND
  const resNotFound = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/nonexistent.js" },
  });
  assert.strictEqual(resNotFound.status, 404);
  assert.strictEqual(resNotFound.body.code, "FILE_NOT_FOUND");
  console.log("✅ PASS 4: Nonexistent source file returns 404 FILE_NOT_FOUND");
  testsPassed++;

  // ── Test 5: Fallback to project.tree content when not pre-indexed in SourceFile collection
  const resTreeFallback = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/controllers/user.js" },
  });
  assert.strictEqual(resTreeFallback.status, 200);
  assert.ok(!capturedPrompt.includes("AKIAIOSFODNN7EXAMPLE"), "Raw AWS secret must be redacted before sending to LLM");
  console.log("✅ PASS 5: Fallback to project tree content works and redacts secrets");
  testsPassed++;

  // ── Test 6: 401 Unauthorized when authentication is missing
  currentAuthUserId = null;
  const resUnauth = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/utils/math.js" },
  });
  assert.strictEqual(resUnauth.status, 401);
  console.log("✅ PASS 6: 401 Unauthorized enforced when auth token is missing");
  testsPassed++;

  // ── Test 7: 403 Forbidden when accessed by a non-owner
  currentAuthUserId = intruderId;
  const resForbidden = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/utils/math.js" },
  });
  assert.strictEqual(resForbidden.status, 403);
  console.log("✅ PASS 7: 403 Forbidden enforced when project belongs to another tenant");
  testsPassed++;

  // Reset auth to owner
  currentAuthUserId = ownerId;

  // ── Test 8: Invalid module name is still rejected with 400 and list of valid modules
  const resInvalidMod = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/invalid-module-name`,
    body: {},
  });
  assert.strictEqual(resInvalidMod.status, 400);
  assert.ok(resInvalidMod.body.error.includes("Valid modules: architecture, erd, api, security, devops"));
  console.log("✅ PASS 8: Generic module validation correctly rejects invalid modules with valid list");
  testsPassed++;

  // ── Test 9: Valid module (e.g. devops) reaches module validation without 400 invalid module
  const resValidMod = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/devops`,
    body: {},
  });
  // For devops, capability is not detected so expect 422 MODULE_NOT_RELEVANT, proving it passed module validation
  assert.strictEqual(resValidMod.status, 422);
  assert.strictEqual(resValidMod.body.code, "MODULE_NOT_RELEVANT");
  console.log("✅ PASS 9: Valid analysis modules (devops) pass module validation cleanly");
  testsPassed++;

  // ── Test 10: Groq failure returns meaningful HTTP error response
  defaultCodeReviewService.groqService.completeChat = async () => {
    const err = new Error("Groq API rate limit exceeded");
    err.status = 429;
    throw err;
  };

  const resGroqFail = await dispatch(app, {
    method: "POST",
    url: `${baseUrl}/${projectId}/code-review`,
    body: { filePath: "src/utils/math.js" },
  });
  assert.strictEqual(resGroqFail.status, 429);
  assert.strictEqual(resGroqFail.body.success, false);
  assert.ok(resGroqFail.body.error.includes("Groq API rate limit exceeded"));
  console.log("✅ PASS 10: Upstream Groq failures propagate with meaningful status and error");
  testsPassed++;

  // Restore original chat service
  defaultCodeReviewService.groqService.completeChat = originalCompleteChat;

  console.log("==================================================");
  console.log(`Test Results: ${testsPassed}/10 PASSED (100% SUCCESS)`);
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
