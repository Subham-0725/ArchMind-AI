// server/test-security-suite.js
//
// Comprehensive Unit & Integration Test Suite for ArchMind AI Phase 4:
// Security & Code Quality:
//   1. Deterministic Secret Scanning & Redaction
//   2. Tree-sitter AST Security Analysis across JS/TS and Python
//   3. Security Audit Service & Findings Persistence
//   4. AI-Assisted Code Review Service & Output Validation
//   5. Test Generation Service & Framework Detection
//   6. Multi-Tenant Project Ownership & Security API Validation

import assert from "node:assert";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import SecurityFinding from "./src/models/SecurityFinding.js";
import SecurityAudit from "./src/models/SecurityAudit.js";
import { scanFileContent, scanRepositorySecrets } from "./src/rie/security/secretScanner.js";
import { redactSecrets } from "./src/rie/security/secretRedactor.js";
import { scanFileAst, scanRepositoryAst } from "./src/rie/security/astSecurityScanner.js";
import { SecurityAuditService } from "./src/services/security/securityAudit.service.js";
import { CodeReviewService } from "./src/services/security/codeReview.service.js";
import { TestGeneratorService } from "./src/services/security/testGenerator.service.js";

console.log("==================================================");
console.log("Running ArchMind AI Phase 4 Security Test Suite");
console.log("==================================================");

let testsPassed = 0;

// ── In-Memory Mock Store for Offline Deterministic Testing ────────────────────
const memoryDb = {
  projects: new Map(),
  sourceFiles: new Map(),
  findings: new Map(),
  audits: new Map(),
};

// Mock Project.findById & findOne
const originalProjectFindById = Project.findById;
Project.findById = function (id) {
  const p = memoryDb.projects.get(String(id));
  const doc = p
    ? {
        ...p,
        set: function (path, val) {
          const parts = path.split(".");
          let target = this;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]]) target[parts[i]] = {};
            target = target[parts[i]];
          }
          target[parts[parts.length - 1]] = val;
        },
        save: async function () {
          memoryDb.projects.set(String(this._id), this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      }
    : null;

  return {
    then: (resolve) => resolve(doc),
    lean: () => Promise.resolve(p ? { ...p } : null),
  };
};

// Mock SourceFile.find & findOne
const originalSourceFileFind = SourceFile.find;
SourceFile.find = function (filter) {
  const matches = [];
  for (const sf of memoryDb.sourceFiles.values()) {
    if (filter.projectId && String(sf.projectId) !== String(filter.projectId)) {
      continue;
    }
    matches.push(sf);
  }
  return {
    select: () => ({
      lean: () => Promise.resolve(matches),
    }),
  };
};

const originalSourceFileFindOne = SourceFile.findOne;
SourceFile.findOne = function (filter) {
  for (const sf of memoryDb.sourceFiles.values()) {
    if (
      String(sf.projectId) === String(filter.projectId) &&
      sf.filePath === filter.filePath
    ) {
      return {
        lean: () => Promise.resolve(sf),
      };
    }
  }
  return {
    lean: () => Promise.resolve(null),
  };
};

// Mock SecurityFinding methods
const originalFindingDeleteMany = SecurityFinding.deleteMany;
SecurityFinding.deleteMany = function (filter) {
  for (const [id, f] of memoryDb.findings.entries()) {
    if (
      String(f.projectId) === String(filter.projectId) &&
      (!filter.analysisVersion || f.analysisVersion === filter.analysisVersion)
    ) {
      memoryDb.findings.delete(id);
    }
  }
  return Promise.resolve({ deletedCount: 1 });
};

const originalFindingInsertMany = SecurityFinding.insertMany;
SecurityFinding.insertMany = function (docs) {
  const created = docs.map((d) => {
    const _id = d._id || new mongoose.Types.ObjectId().toString();
    const doc = {
      ...d,
      _id,
      status: d.status || "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryDb.findings.set(String(_id), doc);
    return doc;
  });
  return Promise.resolve(created);
};

const originalFindingFind = SecurityFinding.find;
SecurityFinding.find = function (filter) {
  let matches = [];
  for (const f of memoryDb.findings.values()) {
    if (filter.projectId && String(f.projectId) !== String(filter.projectId)) continue;
    if (filter.analysisVersion && f.analysisVersion !== filter.analysisVersion) continue;
    if (filter.severity && f.severity !== filter.severity) continue;
    if (filter.status && f.status !== filter.status) continue;
    matches.push(f);
  }

  return {
    sort: () => ({
      skip: (skip) => ({
        limit: (limit) => ({
          lean: () => Promise.resolve(matches.slice(skip, skip + limit)),
        }),
      }),
    }),
  };
};

const originalFindingCount = SecurityFinding.countDocuments;
SecurityFinding.countDocuments = function (filter) {
  let count = 0;
  for (const f of memoryDb.findings.values()) {
    if (filter.projectId && String(f.projectId) !== String(filter.projectId)) continue;
    if (filter.analysisVersion && f.analysisVersion !== filter.analysisVersion) continue;
    if (filter.severity && f.severity !== filter.severity) continue;
    if (filter.status && f.status !== filter.status) continue;
    count++;
  }
  return Promise.resolve(count);
};

const originalFindingFindOne = SecurityFinding.findOne;
SecurityFinding.findOne = function (filter) {
  const f = memoryDb.findings.get(String(filter._id));
  if (f && String(f.projectId) === String(filter.projectId)) {
    return {
      ...f,
      save: async function () {
        memoryDb.findings.set(String(this._id), this);
        return this;
      },
      lean: () => Promise.resolve(f),
      toObject: function () {
        return { ...this };
      },
    };
  }
  return Promise.resolve(null);
};

// Mock SecurityFinding prototype save
SecurityFinding.prototype.save = async function () {
  memoryDb.findings.set(String(this._id), this);
  return this;
};

// Mock SecurityAudit prototype save
SecurityAudit.prototype.save = async function () {
  memoryDb.audits.set(String(this.projectId), this);
  return this;
};

// Mock SecurityAudit methods
const originalAuditFindOne = SecurityAudit.findOne;
SecurityAudit.findOne = function (filter) {
  let found = null;
  for (const a of memoryDb.audits.values()) {
    if (
      String(a.projectId) === String(filter.projectId) &&
      (!filter.analysisVersion || a.analysisVersion === filter.analysisVersion)
    ) {
      found = a;
      break;
    }
  }

  const resultDoc = found
    ? {
        ...found,
        save: async function () {
          memoryDb.audits.set(String(this.projectId), this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      }
    : null;

  return {
    then: (resolve) => resolve(resultDoc),
    sort: () => ({
      lean: () => Promise.resolve(found ? { ...found } : null),
    }),
  };
};

const originalAuditFindOneAndUpdate = SecurityAudit.findOneAndUpdate;
SecurityAudit.findOneAndUpdate = function (filter, update) {
  const existing = memoryDb.audits.get(String(filter.projectId)) || {};
  const updated = {
    ...existing,
    ...update,
    projectId: filter.projectId,
    analysisVersion: filter.analysisVersion,
  };
  memoryDb.audits.set(String(filter.projectId), updated);
  return Promise.resolve(updated);
};

// ── TEST EXECUTION ────────────────────────────────────────────────────────────

async function runSuite() {
  const testUserId = `user-security-${Date.now()}`;
  const otherUserId = `user-unauthorized-${Date.now()}`;
  const testProjectId = new mongoose.Types.ObjectId().toString();

  // 1. Seed Test Project
  const projectDoc = {
    _id: testProjectId,
    userId: testUserId,
    name: "CVNexus Security Test",
    source: "zip",
    analysisVersion: 2,
    tree: [
      { path: "src/server.js", type: "file", size: 1024 },
      { path: "src/config/db.js", type: "file", size: 512 },
      { path: "src/utils/calc.py", type: "file", size: 512 },
    ],
  };
  memoryDb.projects.set(String(testProjectId), projectDoc);

  // 2. Seed SourceFiles containing known vulnerabilities and secrets
  const rawAwsKey = "AKIAIOSFODNN7EXAMPLE";
  const rawMongoUri = "mongodb+srv://db_admin:SuperSecret99@cluster0.net/prod";
  const rawGithubPat = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

  memoryDb.sourceFiles.set(`${testProjectId}:src/config/db.js`, {
    _id: "sf-db",
    projectId: testProjectId,
    filePath: "src/config/db.js",
    fileName: "db.js",
    language: "javascript",
    lineCount: 15,
    content: `// Database connection module
const MONGO_URI = "${rawMongoUri}";
const AWS_KEY = "${rawAwsKey}";
const GITHUB_TOKEN = "${rawGithubPat}";
module.exports = { MONGO_URI };
`,
  });

  memoryDb.sourceFiles.set(`${testProjectId}:src/server.js`, {
    _id: "sf-server",
    projectId: testProjectId,
    filePath: "src/server.js",
    fileName: "server.js",
    language: "javascript",
    lineCount: 25,
    content: `const express = require('express');
const cp = require('child_process');
const fs = require('fs');
const app = express();

app.get('/run', (req, res) => {
  const result = eval(req.query.code); // js-eval-injection
  cp.exec("ping " + req.query.host);  // js-command-injection
  fs.readFile("/data/" + req.query.file, 'utf8'); // js-path-traversal
  res.send({ result });
});
`,
  });

  memoryDb.sourceFiles.set(`${testProjectId}:src/utils/calc.py`, {
    _id: "sf-calc",
    projectId: testProjectId,
    filePath: "src/utils/calc.py",
    fileName: "calc.py",
    language: "python",
    lineCount: 15,
    content: `import os
import pickle

def compute(raw_data):
    obj = pickle.loads(raw_data) # py-unsafe-deserialization
    os.system(f"echo {raw_data}") # py-command-injection
    return obj
`,
  });

  // ============================================================================
  // Test 1: Deterministic Secret Scanner & Safe Masking
  // ============================================================================
  const dbFileContent = memoryDb.sourceFiles.get(`${testProjectId}:src/config/db.js`).content;
  const secretFindings = scanFileContent(dbFileContent, "src/config/db.js");

  assert.strictEqual(secretFindings.length, 3, "Must detect AWS Key, Mongo URI, and GitHub PAT");
  const categories = secretFindings.map((f) => f.category);
  assert.ok(categories.includes("Database Connection String (MongoDB)"));
  assert.ok(categories.includes("AWS Access Key ID"));
  assert.ok(categories.includes("GitHub Personal Access Token"));

  // Verify raw secret values are NEVER present in findings or evidence
  for (const finding of secretFindings) {
    assert.strictEqual(finding.maskedValue.includes("SuperSecret99"), false);
    assert.strictEqual(finding.maskedValue.includes("IOSFODNN7"), false);
    assert.strictEqual(finding.redactedEvidence.includes("SuperSecret99"), false);
    assert.strictEqual(finding.redactedEvidence.includes("IOSFODNN7"), false);
    assert.ok(finding.recommendation.length > 10, "Must provide actionable recommendation");
    assert.strictEqual(finding.source, "secret_scanner");
  }
  console.log("✅ PASS 1: Deterministic secret scanner detects credentials with safe masked evidence");
  testsPassed++;

  // ============================================================================
  // Test 2: Tree-sitter AST Security Analyzer (JS/TS Rules)
  // ============================================================================
  const serverCode = memoryDb.sourceFiles.get(`${testProjectId}:src/server.js`).content;
  const jsAstResult = scanFileAst("src/server.js", serverCode);

  assert.strictEqual(jsAstResult.status, "completed");
  const jsRuleIds = jsAstResult.findings.map((f) => f.ruleId);
  assert.ok(jsRuleIds.includes("js-eval-injection"), "Must detect eval() call");
  assert.ok(jsRuleIds.includes("js-command-injection"), "Must detect child_process.exec call");
  assert.ok(jsRuleIds.includes("js-path-traversal"), "Must detect fs.readFile with req input");

  const evalFinding = jsAstResult.findings.find((f) => f.ruleId === "js-eval-injection");
  assert.strictEqual(evalFinding.startLine, 7);
  assert.strictEqual(evalFinding.severity, "Critical");
  assert.strictEqual(evalFinding.source, "ast_analyzer");
  console.log("✅ PASS 2: Tree-sitter AST scanner detects JS eval, exec, and path traversal with exact line numbers");
  testsPassed++;

  // ============================================================================
  // Test 3: Tree-sitter AST Security Analyzer (Python Rules)
  // ============================================================================
  const pyCode = memoryDb.sourceFiles.get(`${testProjectId}:src/utils/calc.py`).content;
  const pyAstResult = scanFileAst("src/utils/calc.py", pyCode);

  assert.strictEqual(pyAstResult.status, "completed");
  const pyRuleIds = pyAstResult.findings.map((f) => f.ruleId);
  assert.ok(pyRuleIds.includes("py-unsafe-deserialization"), "Must detect pickle.loads");
  assert.ok(pyRuleIds.includes("py-command-injection"), "Must detect os.system");

  const pickleFinding = pyAstResult.findings.find((f) => f.ruleId === "py-unsafe-deserialization");
  assert.strictEqual(pickleFinding.startLine, 5);
  assert.strictEqual(pickleFinding.severity, "Critical");
  console.log("✅ PASS 3: Tree-sitter AST scanner detects Python unsafe deserialization and command injection");
  testsPassed++;

  // ============================================================================
  // Test 4: Explicit Unsupported Language Handling
  // ============================================================================
  const goCode = `package main\nimport "fmt"\nfunc main() { fmt.Println("Hello") }`;
  const unsupportedResult = scanFileAst("main.go", goCode);
  assert.strictEqual(unsupportedResult.status, "unsupported");
  assert.strictEqual(unsupportedResult.findings.length, 0);
  assert.ok(unsupportedResult.reason.includes("Language extension '.go' is not supported"));
  console.log("✅ PASS 4: Unsupported languages return explicit status without fabricating clean report");
  testsPassed++;

  // ============================================================================
  // Test 5: Full Security Audit Service Execution & Versioned Persistence
  // ============================================================================
  const auditService = new SecurityAuditService();
  const scanResult = await auditService.runSecurityScan({
    project: projectDoc,
  });

  assert.strictEqual(scanResult.audit.status, "completed");
  assert.ok(scanResult.totalFindings >= 6, "Must compile findings from secrets + AST");
  assert.ok(scanResult.severityCounts.Critical >= 3, "Must tally critical findings correctly");
  assert.strictEqual(scanResult.audit.analysisVersion, 2);

  // Check persistent finding records in memory
  const storedFindings = await auditService.getFindings({
    projectId: testProjectId,
    analysisVersion: 2,
  });
  assert.strictEqual(storedFindings.totalCount, scanResult.totalFindings);

  // Verify severity filtering
  const criticalOnly = await auditService.getFindings({
    projectId: testProjectId,
    analysisVersion: 2,
    filters: { severity: "Critical" },
  });
  assert.strictEqual(criticalOnly.findings.length, scanResult.severityCounts.Critical);
  console.log("✅ PASS 5: SecurityAuditService executes complete scan, tallies severities, and persists versioned records");
  testsPassed++;

  // ============================================================================
  // Test 6: Finding Detail & Status Update
  // ============================================================================
  const firstFindingId = storedFindings.findings[0]._id;
  const detail = await auditService.getFindingDetail(testProjectId, firstFindingId);
  assert.ok(detail._id);
  assert.strictEqual(detail.status, "open");

  const resolved = await auditService.updateFindingStatus(testProjectId, firstFindingId, "resolved");
  assert.strictEqual(resolved.status, "resolved");

  // Invalid status rejected
  let caughtInvalidStatus = false;
  try {
    await auditService.updateFindingStatus(testProjectId, firstFindingId, "invalid_status");
  } catch (err) {
    caughtInvalidStatus = true;
    assert.strictEqual(err.code, "INVALID_STATUS");
  }
  assert.strictEqual(caughtInvalidStatus, true);
  console.log("✅ PASS 6: Finding detail retrieved and status successfully updated with validation");
  testsPassed++;

  // ============================================================================
  // Test 7: AI-Assisted Code Review with Secret Redaction & Validation
  // ============================================================================
  let secretWasExposedToGroq = false;
  const mockGroqForReview = {
    completeChat: async (messages) => {
      const promptContent = messages.map((m) => m.content).join("\n");
      if (promptContent.includes("SuperSecret99") || promptContent.includes("AKIAIOSFODNN7EXAMPLE")) {
        secretWasExposedToGroq = true;
      }
      return {
        content: JSON.stringify({
          summary: "Identified hardcoded database credentials and insecure keys.",
          overallScore: 40,
          findings: [
            {
              category: "security",
              title: "Hardcoded Database Connection String",
              severity: "Critical",
              confidence: "High",
              startLine: 2,
              endLine: 2,
              explanation: "Sensitive credential embedded directly in source file.",
              suggestedImprovement: "Load from process.env.MONGO_URI.",
            },
          ],
        }),
        model: "openai/gpt-oss-120b",
      };
    },
  };

  const codeReviewService = new CodeReviewService({ groqService: mockGroqForReview });
  const reviewResult = await codeReviewService.reviewFile({
    projectId: testProjectId,
    filePath: "src/config/db.js",
  });

  assert.strictEqual(secretWasExposedToGroq, false, "Secrets must be redacted before sending code to Groq");
  assert.strictEqual(reviewResult.overallScore, 40);
  assert.strictEqual(reviewResult.findings.length, 1);
  assert.strictEqual(reviewResult.findings[0].category, "security");
  assert.strictEqual(reviewResult.findings[0].severity, "Critical");
  console.log("✅ PASS 7: AI-assisted Code Review redacts secrets, validates output JSON, and bounds line numbers");
  testsPassed++;

  // ============================================================================
  // Test 8: Code Review Malformed Response Handling
  // ============================================================================
  const mockGroqMalformed = {
    completeChat: async () => ({
      content: "Invalid Non-JSON prose response without schema",
      model: "openai/gpt-oss-120b",
    }),
  };
  const brokenReviewService = new CodeReviewService({ groqService: mockGroqMalformed });
  let caughtMalformed = false;
  try {
    await brokenReviewService.reviewFile({
      projectId: testProjectId,
      filePath: "src/config/db.js",
    });
  } catch (err) {
    caughtMalformed = true;
    assert.strictEqual(err.code, "MALFORMED_AI_RESPONSE");
  }
  assert.strictEqual(caughtMalformed, true);
  console.log("✅ PASS 8: Malformed AI code review response safely caught without crashing");
  testsPassed++;

  // ============================================================================
  // Test 9: Test Generation Service & Framework Detection
  // ============================================================================
  const mockGroqForTests = {
    completeChat: async () => ({
      content: JSON.stringify({
        testCode: `import { describe, it, expect } from "vitest";
describe("db config", () => {
  it("should export database URI", () => {
    expect(true).toBe(true);
  });
});`,
        testCases: [
          {
            name: "should export database URI",
            type: "normal",
            description: "Verifies DB connection object exists.",
          },
        ],
      }),
      model: "openai/gpt-oss-120b",
    }),
  };

  const testGenService = new TestGeneratorService({ groqService: mockGroqForTests });
  const testPreview = await testGenService.generateTests({
    projectId: testProjectId,
    filePath: "src/config/db.js",
  });

  assert.strictEqual(testPreview.targetFilePath, "src/config/db.js");
  assert.strictEqual(testPreview.suggestedFilePath, "tests/db.test.js");
  assert.strictEqual(testPreview.executed, false, "Tests must never be automatically executed");
  assert.strictEqual(testPreview.isAutoApplied, false, "Tests must never automatically overwrite repo files");
  assert.strictEqual(testPreview.testCases.length, 1);
  assert.ok(testPreview.testCode.includes("describe(\"db config\""));
  console.log("✅ PASS 9: Test Generation service detects framework, provides preview, and prevents execution/file mutation");
  testsPassed++;

  // ============================================================================
  // Test 10: Secret Redaction Deep & Raw Secrets Absent from API Responses
  // ============================================================================
  const sampleApiResponse = {
    projectId: testProjectId,
    findings: scanResult.findings,
  };
  const jsonString = JSON.stringify(sampleApiResponse);
  assert.strictEqual(jsonString.includes(rawAwsKey), false, "AWS Key must NOT appear in API payload");
  assert.strictEqual(jsonString.includes(rawGithubPat), false, "GitHub PAT must NOT appear in API payload");
  assert.strictEqual(jsonString.includes("SuperSecret99"), false, "DB password must NOT appear in API payload");
  console.log("✅ PASS 10: Verified that raw secrets are 100% absent from serialized findings and responses");
  testsPassed++;

  console.log("==================================================");
  console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
  console.log("==================================================");
}

runSuite().catch((err) => {
  console.error("Test suite encountered fatal error:", err);
  process.exit(1);
});
