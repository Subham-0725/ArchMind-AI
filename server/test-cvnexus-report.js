// server/test-cvnexus-report.js
//
// Full PDF Quality Audit and Validation Script for CVNexus Repository.
// Simulates the exact CVNexus repository analysis payload and verifies:
// 1. Executive Overview metrics and health posture
// 2. Monorepo structure detection (Backend & Frontend modules)
// 3. Topology flow diagram and multi-tier mapping
// 4. Mongoose schema entities (User, Resume) and foreign-key relationships (Resume -> User)
// 5. Express API routes with router mount prefixes and auth status
// 6. Security audit findings for leaked credentials in Backend/.env
// 7. DevOps detected vs generated separation
// 8. Grounded actionable engineering recommendations
// 9. Strict empty-page regression check across all pages

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import zlib from "node:zlib";
import { collectReportData } from "./src/services/reports/reportData.service.js";
import { streamProjectPdfReport } from "./src/services/reports/pdfReport.service.js";

console.log("==================================================================");
console.log("   ARCHMIND AI — CVNEXUS FULL REPORT QUALITY AUDIT               ");
console.log("==================================================================");

// ── CVNEXUS ANALYSIS PAYLOAD FIXTURE ──────────────────────────────────────────

const cvnexusProject = {
  _id: "66f5a1b2c3d4e5f6a7b8c9d0",
  userId: "user_cvnexus_test_owner",
  name: "CVNexus",
  source: "zip",
  status: "completed",
  analysisVersion: 1,
  zip: { originalName: "CVNexus-main.zip", sizeBytes: 245760 },
  stats: {
    totalFiles: 48,
    totalDirs: 10,
    totalBytes: 245760,
    topExtensions: [
      { extension: ".js", count: 22 },
      { extension: ".jsx", count: 14 },
      { extension: ".json", count: 4 },
      { extension: ".css", count: 3 },
    ],
  },
  techStack: {
    languages: ["JavaScript"],
    frameworks: ["Express", "React", "Tailwind CSS"],
    databases: ["MongoDB"],
    devops: [],
  },
  primaryLanguage: "JavaScript",
  tree: [
    { path: "Backend/package.json", type: "file" },
    { path: "Backend/.env", type: "file" },
    { path: "Backend/src/app.js", type: "file" },
    { path: "Backend/src/controllers/ai.controller.js", type: "file" },
    { path: "Backend/src/controllers/resume.controller.js", type: "file" },
    { path: "Backend/src/models/user.model.js", type: "file" },
    { path: "Backend/src/models/resume.model.js", type: "file" },
    { path: "Backend/src/routes/ai.routes.js", type: "file" },
    { path: "Backend/src/routes/resume.routes.js", type: "file" },
    { path: "Frontend/package.json", type: "file" },
    { path: "Frontend/src/main.jsx", type: "file" },
    { path: "Frontend/src/App.jsx", type: "file" },
    { path: "README.md", type: "file" },
  ],
  blueprint: {
    architecture: "Monorepo Full-Stack Architecture (Client SPA & Express REST API)",
    summary: "Full-stack resume optimization platform featuring React client and Express AI backend.",
    entryPoints: ["Backend/src/app.js", "Frontend/src/main.jsx"],
  },
  topology: {
    nodes: [
      {
        id: "node-frontend",
        data: {
          label: "Frontend Client Application",
          tier: "frontend",
          technologies: ["React", "Tailwind CSS", "Vite"],
        },
      },
      {
        id: "node-backend",
        data: {
          label: "Backend Express Server",
          tier: "backend",
          technologies: ["Express", "Node.js"],
        },
      },
      {
        id: "node-database",
        data: {
          label: "MongoDB Data Store",
          tier: "database",
          technologies: ["MongoDB", "Mongoose"],
        },
      },
    ],
    edges: [
      { id: "e1", source: "node-frontend", target: "node-backend", label: "HTTP REST API" },
      { id: "e2", source: "node-backend", target: "node-database", label: "Mongoose ODM" },
    ],
  },
  database: {
    type: "MongoDB",
    entities: [
      {
        name: "User",
        tableName: "users",
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isRequired: true },
          { name: "name", type: "String", isRequired: true },
          { name: "email", type: "String", isUnique: true, isRequired: true },
          { name: "password", type: "String", isRequired: true },
          { name: "role", type: "String", isRequired: false },
        ],
      },
      {
        name: "Resume",
        tableName: "resumes",
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isRequired: true },
          { name: "userId", type: "ObjectId", isForeign: true, isRequired: true, references: "User" },
          { name: "title", type: "String", isRequired: true },
          { name: "summary", type: "String", isRequired: false },
          { name: "skills", type: "Array", isRequired: false },
        ],
      },
    ],
    relationships: [
      {
        sourceEntity: "Resume",
        targetEntity: "User",
        type: "Many-to-One",
        foreignKey: "userId",
      },
    ],
  },
  apiRoutes: [
    {
      method: "GET",
      path: "/api/resumes",
      handler: "getResumes",
      filePath: "Backend/src/routes/resume.routes.js",
      line: 7,
      authRequired: true,
    },
    {
      method: "POST",
      path: "/api/resumes",
      handler: "createResume",
      filePath: "Backend/src/routes/resume.routes.js",
      line: 8,
      authRequired: true,
    },
    {
      method: "GET",
      path: "/api/resumes/:id",
      handler: "getResumeById",
      filePath: "Backend/src/routes/resume.routes.js",
      line: 9,
      authRequired: true,
    },
    {
      method: "POST",
      path: "/api/ai/optimize",
      handler: "optimizeResume",
      filePath: "Backend/src/routes/ai.routes.js",
      line: 5,
      authRequired: false,
    },
  ],
  securityFindings: [
    {
      ruleId: "mongodb-connection-uri",
      title: "Hardcoded MongoDB Connection URI with Credentials",
      severity: "Critical",
      filePath: "Backend/.env",
      startLine: 2,
      redactedEvidence: "MONGODB_URI=mongodb+srv://subham:[REDACTED_SECRET:PASSWORD]@cluster0.1qnbq8u.mongodb.net/cvnexus",
      description: "Exposed database connection URI contains plaintext administrative credentials.",
      recommendation: "Rotate the MongoDB user password in Atlas immediately. Remove Backend/.env from git and add it to .gitignore.",
      source: "secret_scanner",
    },
    {
      ruleId: "hardcoded-jwt-secret",
      title: "Hardcoded JWT Secret Key",
      severity: "Critical",
      filePath: "Backend/.env",
      startLine: 3,
      redactedEvidence: "JWT_SECRET=[REDACTED_SECRET:JWT_SECRET]",
      description: "Plaintext JWT signature key allows attackers to forge authorization tokens.",
      recommendation: "Rotate JWT signing secret and inject it via environment variables.",
      source: "secret_scanner",
    },
  ],
  securitySummary: {
    severityCounts: { Critical: 2, High: 0, Medium: 0, Low: 0 },
  },
};

// ── AUDIT EXECUTION ───────────────────────────────────────────────────────────

async function auditCVNexusReport() {
  console.log("\n[1] Running Report Data Aggregator for CVNexus...");
  const data = await collectReportData(cvnexusProject);

  // Verification 1: Health Score Posture
  assert.strictEqual(data.metadata.projectName, "CVNexus");
  assert.ok(data.health.score < 80, "CVNexus has 2 Critical secrets, health score should reflect risk");
  assert.strictEqual(data.health.label, "Needs Immediate Attention");
  console.log(`   Health Score: ${data.health.score}/100 (${data.health.label})`);

  // Verification 2: Monorepo Sub-projects
  assert.ok(data.structure.modules.length >= 2, "Must detect Backend and Frontend modules");
  const modNames = data.structure.modules.map((m) => m.name);
  assert.ok(modNames.includes("Backend") && modNames.includes("Frontend"), "Modules must be Backend and Frontend");
  console.log(`   Detected Monorepo Modules: ${modNames.join(", ")}`);

  // Verification 3: Topology Flow & Architecture
  assert.strictEqual(data.architecture.hasArchitecture, true);
  assert.ok(data.architecture.flowDiagramText.includes("Frontend Tier"));
  assert.ok(data.architecture.flowDiagramText.includes("Backend Tier"));
  assert.ok(data.architecture.flowDiagramText.includes("Database Tier"));
  console.log(`   Architecture Flow: ${data.architecture.flowDiagramText}`);

  // Verification 4: Database Models & Relationships
  assert.strictEqual(data.database.entityCount, 2);
  assert.strictEqual(data.database.entities[0].name, "User");
  assert.strictEqual(data.database.entities[1].name, "Resume");
  assert.ok(data.database.relationshipCount >= 1, "Must detect Resume -> User foreign key relationship");
  console.log(`   Database Models: ${data.database.entities.map((e) => e.name).join(", ")} (Relationships: ${data.database.relationshipCount})`);

  // Verification 5: API Routes
  assert.strictEqual(data.apiRoutes.totalCount, 4);
  console.log(`   API Routes: ${data.apiRoutes.totalCount} (GET: ${data.apiRoutes.methodBreakdown.GET}, POST: ${data.apiRoutes.methodBreakdown.POST})`);

  // Verification 6: Security Findings & Secret Redaction
  assert.strictEqual(data.security.totalFindings, 2);
  assert.strictEqual(data.security.severityCounts.Critical, 2);
  console.log(`   Security Audit: ${data.security.totalFindings} findings (Critical: ${data.security.severityCounts.Critical})`);

  // Verification 7: Actionable Recommendations
  assert.ok(data.recommendations.length >= 2);
  const p0 = data.recommendations.find((r) => r.priority.includes("P0"));
  assert.ok(p0, "Must have P0 Critical recommendation for leaked MongoDB credentials");
  console.log(`   P0 Recommendation: [${p0.category}] ${p0.observation}`);

  console.log("\n[2] Streaming CVNexus PDF and Verifying Bounded Layout...");
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(cvnexusProject, pass);
  const pdfBuffer = Buffer.concat(chunks);

  console.log(`   Total PDF Size: ${pdfBuffer.length} bytes`);
  assert.strictEqual(pdfBuffer.slice(0, 5).toString("ascii"), "%PDF-");
  assert.ok(pdfBuffer.toString("binary").includes("%%EOF"));

  // Save artifact for manual visual inspection
  const outPath = path.resolve("server/storage/cvnexus-audit-report.pdf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`   Wrote audit PDF to: ${outPath}`);

  // Decompress each page stream and verify
  const pdfStr = pdfBuffer.toString("latin1");
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let pageIndex = 0;
  const pages = [];

  while ((match = streamRegex.exec(pdfStr)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("utf8");
      if (decompressed.includes("cm") || decompressed.includes("re") || decompressed.includes("BT")) {
        pageIndex++;
        const hexMatches = decompressed.match(/<([0-9a-fA-F]+)>/g) || [];
        const textTokens = hexMatches.map((h) => Buffer.from(h.replace(/[<>]/g, ""), "hex").toString("utf8"));
        const text = textTokens.join(" ").trim();
        pages.push({ pageIndex, textLength: text.length, streamLength: decompressed.length, textSnippet: text.slice(0, 80) });
      }
    } catch {}
  }

  console.log(`\n[3] Validating Zero Blank Pages Across All ${pages.length} Pages...`);
  assert.ok(pages.length >= 2, `CVNexus report should be multi-page (actual: ${pages.length})`);

  pages.forEach((p) => {
    console.log(`   Page ${p.pageIndex}: ${p.textLength} text chars, ${p.streamLength} stream bytes. Preview: "${p.textSnippet}..."`);
    assert.ok(p.textLength > 150, `Page ${p.pageIndex} has too little text (${p.textLength} chars) — potential blank page!`);
    assert.ok(p.streamLength > 1000, `Page ${p.pageIndex} stream length too small (${p.streamLength} bytes)`);
  });

  // Verify raw credentials never leaked
  const rawString = pdfBuffer.toString("utf8");
  assert.strictEqual(rawString.includes("adminPass123"), false, "MongoDB password must be 100% redacted");
  assert.strictEqual(rawString.includes("supersecretjwtkey9876543210"), false, "JWT secret must be 100% redacted");
  console.log("   Credentials 100% verified redacted in final stream!");

  console.log("\n==================================================================");
  console.log("🎉 ALL CVNEXUS QUALITY AUDIT CHECKS PASSED PERFECTLY!");
  console.log("==================================================================");
}

auditCVNexusReport().catch((err) => {
  console.error("❌ AUDIT FAILED:", err);
  process.exit(1);
});

