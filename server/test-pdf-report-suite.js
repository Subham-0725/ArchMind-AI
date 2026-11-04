// server/test-pdf-report-suite.js
//
// Comprehensive Automated Test Suite for ArchMind AI PDF Report Export.
// Validates:
// 1. Report Data Preparation Service (normalization, metrics, health score, redaction)
// 2. PDF Document Streaming & Structure (%PDF-, %%EOF, metadata)
// 3. Multi-Scenario Reports (Minimal, Full-Stack Enterprise, High-Volume)
// 4. Ironclad Empty-Page & Blank-Page Regression Assertions (Decompresses and inspects each page)
// 5. Zero Secret Leakage across output buffers
// 6. HTTP Controller Verification (Auth, Ownership, Headers, Analysis Status)

import assert from "node:assert";
import { PassThrough } from "node:stream";
import zlib from "node:zlib";
import express from "express";
import mongoose from "mongoose";
import http from "node:http";
import net from "node:net";

import Project from "./src/models/Project.js";
import SecurityFinding from "./src/models/SecurityFinding.js";
import SecurityAudit from "./src/models/SecurityAudit.js";
import DevOpsArtifact from "./src/models/DevOpsArtifact.js";
import { collectReportData } from "./src/services/reports/reportData.service.js";
import { streamProjectPdfReport } from "./src/services/reports/pdfReport.service.js";
import projectRoutes from "./src/routes/project.routes.js";
import { globalErrorHandler, notFoundHandler } from "./src/middleware/errorHandler.middleware.js";

// ── TEST RUNNER UTILITIES ─────────────────────────────────────────────────────

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${err.stack || err.message}`);
    failedTests++;
  }
}

/**
 * Extracts and decodes all page content streams from a PDF buffer.
 *
 * @param {Buffer} pdfBuffer
 * @returns {Array<{ pageIndex: number, text: string, length: number }>}
 */
function extractDecodedPageStreams(pdfBuffer) {
  const pdfStr = pdfBuffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const pages = [];
  let match;
  let pageIdx = 0;

  while ((match = streamRegex.exec(pdfStr)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("utf8");
      // Extract text encoded in PDF hex string arrays: <41524348...>
      const hexMatches = decompressed.match(/<([0-9a-fA-F]+)>/g) || [];
      const textTokens = hexMatches.map((h) => {
        const hex = h.replace(/[<>]/g, "");
        return Buffer.from(hex, "hex").toString("utf8");
      });
      const pageText = textTokens.join(" ").trim();

      // Check if this stream represents a page content stream (has graphics/text operators)
      if (decompressed.includes("cm") || decompressed.includes("re") || decompressed.includes("BT")) {
        pageIdx++;
        pages.push({
          pageIndex: pageIdx,
          text: pageText,
          streamLength: decompressed.length,
          textLength: pageText.length,
        });
      }
    } catch {
      // Non-Flate stream (e.g. font descriptor or metadata) — safely skip
    }
  }

  return pages;
}

// ── TEST DATA FIXTURES ────────────────────────────────────────────────────────

const ownerId = "user_clerk_owner_pdf_test";
const intruderId = "user_clerk_intruder_pdf_test";

const fullStackProject = {
  _id: new mongoose.Types.ObjectId().toString(),
  userId: ownerId,
  name: "ArchMind Enterprise Suite",
  source: "github",
  status: "completed",
  analysisVersion: 2,
  github: {
    url: "https://github.com/archmind/enterprise-suite",
    defaultBranch: "main",
    owner: "archmind",
    repo: "enterprise-suite",
  },
  stats: {
    totalFiles: 84,
    totalDirs: 12,
    totalBytes: 3145728, // 3 MB
    topExtensions: [
      { extension: ".js", count: 48 },
      { extension: ".json", count: 12 },
    ],
  },
  techStack: {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["Express", "React"],
    databases: ["MongoDB", "Redis"],
    devops: ["Docker", "GitHub Actions"],
  },
  primaryLanguage: "JavaScript",
  tree: [
    { path: "server/index.js", type: "file" },
    { path: "server/models/User.js", type: "file" },
    { path: "server/models/Project.js", type: "file" },
    { path: "package.json", type: "file" },
    { path: "Dockerfile", type: "file" },
    { path: "__tests__/api.test.js", type: "file" },
  ],
  blueprint: {
    architecture: "Layered Microservices Architecture",
    summary: "Multi-tenant repository intelligence and diagram generation engine.",
    entryPoints: ["server/index.js", "worker.js"],
  },
  topology: {
    nodes: [
      { id: "1", data: { label: "API Gateway", tier: "frontend", technologies: ["React"] } },
      { id: "2", data: { label: "Express App Server", tier: "backend", technologies: ["Express", "Node.js"] } },
      { id: "3", data: { label: "MongoDB Database", tier: "database", technologies: ["MongoDB"] } },
    ],
    edges: [{ id: "e1", source: "1", target: "2", label: "HTTP REST" }],
  },
  database: {
    type: "MongoDB",
    entities: [
      {
        name: "User",
        tableName: "users",
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isRequired: true },
          { name: "email", type: "String", isUnique: true, isRequired: true },
          { name: "role", type: "String", isRequired: true },
        ],
      },
      {
        name: "Project",
        tableName: "projects",
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isRequired: true },
          { name: "userId", type: "String", isForeign: true, isRequired: true },
          { name: "name", type: "String", isRequired: true },
        ],
      },
    ],
  },
  apiRoutes: [
    { method: "GET", path: "/api/health", handler: "healthCheck", authRequired: false },
    { method: "POST", path: "/api/auth/login", handler: "loginUser", authRequired: false },
    { method: "GET", path: "/api/projects", handler: "listProjects", authRequired: true },
    { method: "POST", path: "/api/projects", handler: "createProject", authRequired: true },
    { method: "DELETE", path: "/api/projects/:id", handler: "deleteProject", authRequired: true },
  ],
  securityFindings: [
    {
      ruleId: "hardcoded-bearer-token",
      title: "Hardcoded Bearer Authentication Token",
      severity: "Critical",
      filePath: "server/config/auth.js",
      startLine: 24,
      recommendation: "Rotate compromised token and migrate to environment variables.",
      source: "secret_scanner",
    },
    {
      ruleId: "eval-code-injection",
      title: "Dangerous eval() usage detected",
      severity: "High",
      filePath: "server/utils/scriptRunner.js",
      startLine: 52,
      recommendation: "Replace eval with a secure sandboxed interpreter.",
      source: "ast_analyzer",
    },
  ],
  securitySummary: {
    severityCounts: { Critical: 1, High: 1, Medium: 0, Low: 0 },
  },
  createdAt: new Date("2026-02-01"),
  updatedAt: new Date("2026-02-15"),
};

const minimalProject = {
  _id: new mongoose.Types.ObjectId().toString(),
  userId: ownerId,
  name: "Static Documentation Site",
  source: "zip",
  status: "completed",
  analysisVersion: 1,
  zip: { originalName: "docs-site.zip", sizeBytes: 51200 },
  stats: { totalFiles: 8, totalDirs: 2, totalBytes: 51200 },
  techStack: { languages: ["Markdown", "HTML"] },
  primaryLanguage: "Markdown",
  tree: [
    { path: "README.md", type: "file" },
    { path: "index.html", type: "file" },
  ],
  blueprint: {
    architecture: "Static Content Site",
    entryPoints: ["index.html"],
  },
  database: { entities: [] },
  apiRoutes: [],
  securityFindings: [],
  createdAt: new Date("2026-03-01"),
};

const devopsArtifactsFixture = [
  {
    artifactType: "dockerfile",
    filePath: "Dockerfile",
    version: 1,
    validation: { valid: true },
    content: "FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nEXPOSE 5000\nCMD [\"npm\", \"start\"]",
  },
  {
    artifactType: "cicd",
    filePath: ".github/workflows/pipeline.yml",
    version: 1,
    validation: { valid: true },
    content: "name: Pipeline\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4",
  },
];

// ── EXECUTE TEST SUITE ────────────────────────────────────────────────────────

console.log("==================================================================");
console.log("   ARCHMIND AI — COMPREHENSIVE PDF REPORT TEST SUITE            ");
console.log("==================================================================");

// ── 1. REPORT DATA PREPARATION TESTS ──────────────────────────────────────────

await test("Report Data Service: Accurately normalizes full-stack project data", async () => {
  const data = await collectReportData(fullStackProject, {
    devopsArtifacts: devopsArtifactsFixture,
  });

  assert.strictEqual(data.metadata.projectName, "ArchMind Enterprise Suite");
  assert.strictEqual(data.overview.primaryLanguage, "JavaScript");
  assert.strictEqual(data.overview.totalFiles, 84);
  assert.strictEqual(data.database.hasDatabase, true);
  assert.strictEqual(data.database.entityCount, 2);
  assert.strictEqual(data.apiRoutes.hasApiRoutes, true);
  assert.strictEqual(data.apiRoutes.totalCount, 5);
  assert.strictEqual(data.security.totalFindings, 2);
  assert.strictEqual(data.security.severityCounts.Critical, 1);
  assert.strictEqual(data.devops.hasDevops, true);
  assert.strictEqual(data.devops.totalArtifacts, 2);

  // Recommendations should be prioritized
  assert.ok(data.recommendations.length > 0, "Must have actionable recommendations");
  assert.ok(data.recommendations[0].priority.includes("P0"), "P0 recommendation for Critical finding");
});

await test("Report Data Service: Correctly handles minimal project with empty modules", async () => {
  const data = await collectReportData(minimalProject);

  assert.strictEqual(data.metadata.projectName, "Static Documentation Site");
  assert.strictEqual(data.database.hasDatabase, false);
  assert.strictEqual(data.apiRoutes.hasApiRoutes, false);
  assert.strictEqual(data.security.hasSecurityFindings, false);
  assert.strictEqual(data.devops.hasDevops, false);
  assert.strictEqual(data.health.score >= 50, true, "Clean repo must maintain healthy base score");
});

await test("Report Data Service: Calculates objective health score based on metrics", async () => {
  const cleanData = await collectReportData(minimalProject);
  const criticalData = await collectReportData(fullStackProject);

  assert.ok(
    cleanData.health.score > criticalData.health.score,
    `Clean project (${cleanData.health.score}) should score higher than project with Critical vulnerability (${criticalData.health.score})`
  );
});

// ── 2. PDF STREAMING & DOCUMENT STRUCTURE TESTS ──────────────────────────────

await test("PDF Stream: Generates valid PDF header (%PDF-) and footer (%%EOF)", async () => {
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(fullStackProject, pass, { devopsArtifacts: devopsArtifactsFixture });
  const buffer = Buffer.concat(chunks);

  assert.ok(buffer.length > 2000, "Buffer size should exceed 2KB");
  assert.strictEqual(buffer.slice(0, 5).toString("ascii"), "%PDF-", "PDF must start with %PDF-");
  assert.ok(buffer.toString("binary").includes("%%EOF"), "PDF must terminate with %%EOF");
});

await test("PDF Stream: Embeds metadata dictionary in document catalog", async () => {
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(fullStackProject, pass);
  const pdfStr = Buffer.concat(chunks).toString("latin1");

  assert.ok(pdfStr.includes("/Title"), "PDF must contain Title metadata");
  assert.ok(pdfStr.includes("/Author"), "PDF must contain Author metadata");
  assert.ok(pdfStr.includes("ArchMind AI"), "Metadata must identify ArchMind AI");
});

// ── 3. EMPTY PAGE & BLANK PAGE REGRESSION ASSERTIONS ─────────────────────────

await test("Empty-Page Regression: Full-stack report contains ZERO blank or sparse pages", async () => {
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(fullStackProject, pass, { devopsArtifacts: devopsArtifactsFixture });
  const buffer = Buffer.concat(chunks);
  const pages = extractDecodedPageStreams(buffer);

  assert.ok(pages.length >= 2, `Full-stack report should have at least 2 pages (actual: ${pages.length})`);

  pages.forEach((page) => {
    assert.ok(
      page.streamLength > 1000,
      `Page ${page.pageIndex} stream length (${page.streamLength} bytes) is too small — possible blank page`
    );
    assert.ok(
      page.textLength > 150,
      `Page ${page.pageIndex} text length (${page.textLength} chars) is too sparse — possible empty page`
    );
  });
});

await test("Empty-Page Regression: Minimal project report contains ZERO empty pages", async () => {
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(minimalProject, pass);
  const buffer = Buffer.concat(chunks);
  const pages = extractDecodedPageStreams(buffer);

  assert.ok(pages.length >= 1, "Minimal report must produce at least 1 page");
  assert.ok(pages.length <= 2, `Minimal report should not explode page count (actual: ${pages.length})`);

  pages.forEach((page) => {
    assert.ok(
      page.textLength > 150,
      `Page ${page.pageIndex} in minimal report must have substantive content (chars: ${page.textLength})`
    );
  });
});

await test("Empty-Page Regression: High-volume dataset cleanly paginates without trailing blank pages", async () => {
  // Generate 40 API routes and 15 models to force multi-page table wrapping
  const manyRoutes = Array.from({ length: 35 }, (_, i) => ({
    method: i % 2 === 0 ? "GET" : "POST",
    path: `/api/v1/resource-${i}/item`,
    handler: `handleResource${i}`,
    authRequired: i % 3 === 0,
  }));

  const manyModels = Array.from({ length: 12 }, (_, i) => ({
    name: `EntityModel${i}`,
    tableName: `entity_models_${i}`,
    fields: [
      { name: "id", type: "UUID", isPrimary: true },
      { name: "name", type: "String", isRequired: true },
    ],
  }));

  const highVolumeProject = {
    ...fullStackProject,
    name: "High Volume Scaled Repository",
    apiRoutes: manyRoutes,
    database: { type: "PostgreSQL", entities: manyModels },
  };

  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(highVolumeProject, pass, { devopsArtifacts: devopsArtifactsFixture });
  const buffer = Buffer.concat(chunks);
  const pages = extractDecodedPageStreams(buffer);

  assert.ok(pages.length >= 2, `High-volume report should span multiple pages (actual: ${pages.length})`);

  // Assert every single page has substantive content
  pages.forEach((page) => {
    assert.ok(
      page.textLength > 200,
      `Page ${page.pageIndex} in high-volume report must contain substantial text (chars: ${page.textLength})`
    );
  });
});

// ── 4. SECRET REDACTION IN PDF OUTPUT TESTS ───────────────────────────────────

await test("Security: Raw sensitive tokens and credentials NEVER appear in output buffer", async () => {
  const rawAwsKey = "AKIAIOSFODNN7EXAMP99";
  const rawJwtSecret = "super-secret-jwt-signing-key-12345";
  const rawMongoUri = "mongodb://admin:superSecretPass123@cluster0.mongodb.net/prod";

  const leakProject = {
    ...fullStackProject,
    name: `Leaky App with ${rawAwsKey}`,
    blueprint: {
      architecture: `Connected via ${rawMongoUri}`,
      entryPoints: ["server.js"],
    },
    securityFindings: [
      {
        ruleId: "aws-key",
        title: `Found AWS Key ${rawAwsKey}`,
        severity: "Critical",
        filePath: "config.js",
        startLine: 10,
        recommendation: `Revoke ${rawJwtSecret}`,
      },
    ],
  };

  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(leakProject, pass);
  const buffer = Buffer.concat(chunks);
  const rawStr = buffer.toString("utf8");

  assert.strictEqual(rawStr.includes(rawAwsKey), false, "Raw AWS Key must not exist in output");
  assert.strictEqual(rawStr.includes("superSecretPass123"), false, "Raw DB password must not exist in output");
  assert.strictEqual(rawStr.includes(rawJwtSecret), false, "Raw JWT secret must not exist in output");
});

// ── 5. HTTP CONTROLLER & ROUTING TESTS ────────────────────────────────────────

const mockStore = new Map();
mockStore.set(fullStackProject._id, fullStackProject);
mockStore.set(minimalProject._id, minimalProject);

// Mock Project.findById for controller tests
const originalFindById = Project.findById;
Project.findById = function (id) {
  const p = mockStore.get(String(id));
  return {
    lean: async () => (p ? { ...p } : null),
    then: (resolve) => resolve(p ? { ...p, toObject: () => ({ ...p }) } : null),
  };
};

const app = express();
let currentAuthUserId = ownerId;

app.use((req, res, next) => {
  req.auth = currentAuthUserId ? { userId: currentAuthUserId } : null;
  next();
});

app.use("/api/projects", projectRoutes);
app.use(notFoundHandler);
app.use(globalErrorHandler);

function dispatch(app, { method, url, body = null, headers = {} }) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { "content-type": "application/json", ...headers };
    req.body = body || {};

    const res = new http.ServerResponse(req);
    res.body = null;
    let chunks = [];

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const fullBuffer = Buffer.concat(chunks);
      if (this.getHeader("content-type")?.includes("application/pdf")) {
        resolve({
          status: this.statusCode,
          headers: this.getHeaders(),
          buffer: fullBuffer,
          body: null,
        });
      } else {
        try {
          const parsed = JSON.parse(fullBuffer.toString("utf8"));
          resolve({ status: this.statusCode, headers: this.getHeaders(), body: parsed });
        } catch {
          resolve({
            status: this.statusCode,
            headers: this.getHeaders(),
            body: fullBuffer.toString("utf8"),
          });
        }
      }
      return this;
    };

    res.json = function (data) {
      this.body = data;
      this.setHeader("content-type", "application/json");
      resolve({ status: this.statusCode, headers: this.getHeaders(), body: data });
      return this;
    };

    app.handle(req, res);
  });
}

await test("PDF Controller: GET /api/projects/:id/report/pdf streams PDF with correct headers", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${fullStackProject._id}/report/pdf`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["content-type"], "application/pdf");
  assert.ok(
    res.headers["content-disposition"].includes("archmind-enterprise-suite-archmind-report.pdf")
  );
  assert.strictEqual(res.buffer.slice(0, 5).toString("ascii"), "%PDF-");
});

await test("PDF Controller: Rejects incomplete project analysis with 400 ANALYSIS_INCOMPLETE", async () => {
  const incompleteId = new mongoose.Types.ObjectId().toString();
  mockStore.set(incompleteId, {
    _id: incompleteId,
    userId: ownerId,
    name: "Pending Ingestion Repo",
    status: "processing",
    blueprint: null,
  });

  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${incompleteId}/report/pdf`,
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, "ANALYSIS_INCOMPLETE");
});

await test("PDF Controller: Enforces Clerk authentication with 401 UNAUTHORIZED", async () => {
  currentAuthUserId = null; // Unauthenticated
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${fullStackProject._id}/report/pdf`,
  });

  assert.strictEqual(res.status, 401);
});

await test("PDF Controller: Enforces project ownership with 403 FORBIDDEN", async () => {
  currentAuthUserId = intruderId; // Intruder
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${fullStackProject._id}/report/pdf`,
  });

  assert.strictEqual(res.status, 403);
});

await test("PDF Controller: Returns 404 PROJECT_NOT_FOUND for non-existent project", async () => {
  currentAuthUserId = ownerId;
  const nonExistentId = new mongoose.Types.ObjectId().toString();
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${nonExistentId}/report/pdf`,
  });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.error.code, "PROJECT_NOT_FOUND");
});

// Restore mocks
Project.findById = originalFindById;

console.log("==================================================================");
console.log(`🎉 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log("==================================================================");

if (failedTests > 0) {
  process.exit(1);
}
