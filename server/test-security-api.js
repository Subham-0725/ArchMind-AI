// server/test-security-api.js
//
// Controller & Route integration tests for ArchMind AI Phase 4 Security Endpoints:
//   - POST /api/projects/:projectId/security/scan
//   - GET /api/projects/:projectId/security
//   - GET /api/projects/:projectId/security/findings
//   - GET /api/projects/:projectId/security/findings/:findingId
//   - PATCH /api/projects/:projectId/security/findings/:findingId
//   - POST /api/projects/:projectId/code-review
//   - POST /api/projects/:projectId/tests/generate

import assert from "node:assert";
import mongoose from "mongoose";
import * as clerkExpress from "@clerk/express";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import SecurityFinding from "./src/models/SecurityFinding.js";
import SecurityAudit from "./src/models/SecurityAudit.js";
import {
  triggerSecurityScan,
  getSecuritySummary,
  getSecurityFindings,
  getFindingDetail,
  updateFindingStatus,
  triggerCodeReview,
  triggerTestGeneration,
} from "./src/controllers/security.controller.js";

console.log("==================================================");
console.log("Running Security Controller & HTTP API Tests");
console.log("==================================================");

let testsPassed = 0;

// Mock Response Helper
function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

// In-Memory store for mock database operations
const db = {
  projects: new Map(),
  findings: new Map(),
  audits: new Map(),
  sourceFiles: new Map(),
};

// Mock Clerk Auth
let currentAuthUser = "user_owner_123";

// Mock Project.findById
Project.findById = function (id) {
  const p = db.projects.get(String(id));
  if (!p) return Promise.resolve(null);
  return Promise.resolve({
    ...p,
    set: function (k, v) {
      this[k] = v;
    },
    save: async function () {
      db.projects.set(String(this._id), this);
      return this;
    },
  });
};

// Mock SourceFile
SourceFile.find = function () {
  return {
    select: () => ({
      lean: () => Promise.resolve([]),
    }),
  };
};

SourceFile.findOne = function (filter) {
  for (const sf of db.sourceFiles.values()) {
    if (String(sf.projectId) === String(filter.projectId) && sf.filePath === filter.filePath) {
      return { lean: () => Promise.resolve(sf) };
    }
  }
  return { lean: () => Promise.resolve(null) };
};

// Mock SecurityAudit
SecurityAudit.findOne = function (filter) {
  const a = db.audits.get(String(filter.projectId));
  const res = a
    ? {
        ...a,
        save: async function () {
          db.audits.set(String(this.projectId), this);
          return this;
        },
        toObject: () => ({ ...a }),
      }
    : null;
  return {
    then: (resolve) => resolve(res),
    sort: () => ({ lean: () => Promise.resolve(a || null) }),
  };
};
SecurityAudit.prototype.save = async function () {
  db.audits.set(String(this.projectId), this);
  return this;
};

// Mock SecurityFinding
SecurityFinding.deleteMany = () => Promise.resolve({ deletedCount: 0 });
SecurityFinding.insertMany = (docs) => {
  docs.forEach((d) => {
    const id = d._id || new mongoose.Types.ObjectId().toString();
    db.findings.set(String(id), { ...d, _id: id });
  });
  return Promise.resolve(docs);
};
SecurityFinding.find = (filter) => {
  const list = Array.from(db.findings.values()).filter((f) => {
    if (filter.projectId && String(f.projectId) !== String(filter.projectId)) return false;
    if (filter.severity && f.severity !== filter.severity) return false;
    return true;
  });
  return {
    sort: () => ({
      skip: () => ({
        limit: () => ({ lean: () => Promise.resolve(list) }),
      }),
    }),
  };
};
SecurityFinding.countDocuments = () => Promise.resolve(db.findings.size);
SecurityFinding.findOne = (filter) => {
  const f = db.findings.get(String(filter._id));
  const doc = f
    ? {
        ...f,
        save: async function () {
          db.findings.set(String(this._id), this);
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      }
    : null;

  return {
    then: (resolve) => resolve(doc),
    lean: () => Promise.resolve(f ? { ...f } : null),
  };
};

async function runApiTests() {
  const ownerId = "user_owner_123";
  const intruderId = "user_attacker_666";
  const projectId = new mongoose.Types.ObjectId().toString();

  // Seed project owned by ownerId
  db.projects.set(projectId, {
    _id: projectId,
    userId: ownerId,
    name: "API Test Project",
    analysisVersion: 1,
    tree: [
      {
        path: "src/app.js",
        type: "file",
        content: "const key = 'AKIAIOSFODNN7EXAMPLE';\neval(req.query.cmd);",
      },
    ],
  });

  // Seed source file for code review & test gen
  db.sourceFiles.set(`${projectId}:src/app.js`, {
    _id: "sf-1",
    projectId,
    filePath: "src/app.js",
    fileName: "app.js",
    language: "javascript",
    content: "const x = 1;\nmodule.exports = { x };",
    lineCount: 2,
  });

  // Test 1: 401 Unauthorized when userId is missing
  currentAuthUser = null;
  const reqUnauth = { params: { projectId }, auth: null };
  const resUnauth = createMockRes();
  await triggerSecurityScan(reqUnauth, resUnauth);
  assert.strictEqual(resUnauth.statusCode, 401);
  assert.strictEqual(resUnauth.body.code, "UNAUTHORIZED");
  console.log("✅ PASS 1: 401 Unauthorized enforced when Clerk auth token is missing");
  testsPassed++;

  // Test 2: 403 Forbidden when user does not own project
  currentAuthUser = intruderId;
  const reqForbidden = { params: { projectId }, auth: { userId: intruderId } };
  const resForbidden = createMockRes();
  await triggerSecurityScan(reqForbidden, resForbidden);
  assert.strictEqual(resForbidden.statusCode, 403);
  assert.strictEqual(resForbidden.body.code, "FORBIDDEN");
  console.log("✅ PASS 2: 403 Forbidden enforced when project belongs to another tenant");
  testsPassed++;

  // Test 3: 400 Bad Request on invalid ObjectId format
  currentAuthUser = ownerId;
  const reqInvalidId = { params: { projectId: "not-an-objectid" }, auth: { userId: ownerId } };
  const resInvalidId = createMockRes();
  await triggerSecurityScan(reqInvalidId, resInvalidId);
  assert.strictEqual(resInvalidId.statusCode, 400);
  assert.strictEqual(resInvalidId.body.code, "INVALID_PROJECT_ID");
  console.log("✅ PASS 3: 400 Bad Request returned on malformed project ID");
  testsPassed++;

  // Test 4: POST /api/projects/:id/security/scan (Authorized owner)
  currentAuthUser = ownerId;
  const reqScan = { params: { projectId }, auth: { userId: ownerId } };
  const resScan = createMockRes();
  await triggerSecurityScan(reqScan, resScan);
  assert.strictEqual(resScan.statusCode, 200);
  assert.strictEqual(resScan.body.success, true);
  assert.strictEqual(resScan.body.data.status, "completed");
  assert.ok(resScan.body.data.totalFindings >= 2);
  console.log("✅ PASS 4: POST /security/scan runs audit and returns summary and finding counts");
  testsPassed++;

  // Test 5: GET /api/projects/:id/security
  const reqSummary = { params: { projectId }, auth: { userId: ownerId } };
  const resSummary = createMockRes();
  await getSecuritySummary(reqSummary, resSummary);
  assert.strictEqual(resSummary.statusCode, 200);
  assert.strictEqual(resSummary.body.success, true);
  assert.strictEqual(resSummary.body.data.status, "completed");
  console.log("✅ PASS 5: GET /security returns scan status and severity tallies");
  testsPassed++;

  // Test 6: GET /api/projects/:id/security/findings
  const reqFindings = {
    params: { projectId },
    query: { severity: "Critical", page: "1", limit: "10" },
    auth: { userId: ownerId },
  };
  const resFindings = createMockRes();
  await getSecurityFindings(reqFindings, resFindings);
  assert.strictEqual(resFindings.statusCode, 200);
  assert.strictEqual(resFindings.body.success, true);
  assert.ok(Array.isArray(resFindings.body.data));
  assert.ok(resFindings.body.pagination);
  console.log("✅ PASS 6: GET /security/findings returns paginated, filtered findings");
  testsPassed++;

  // Test 7: GET /api/projects/:id/security/findings/:findingId & PATCH
  const sampleFinding = Array.from(db.findings.values())[0];
  assert.ok(sampleFinding);
  const reqDetail = {
    params: { projectId, findingId: sampleFinding._id },
    auth: { userId: ownerId },
  };
  const resDetail = createMockRes();
  await getFindingDetail(reqDetail, resDetail);
  assert.strictEqual(resDetail.statusCode, 200);
  assert.strictEqual(resDetail.body.data._id, sampleFinding._id);

  // Status update
  const reqPatch = {
    params: { projectId, findingId: sampleFinding._id },
    body: { status: "ignored" },
    auth: { userId: ownerId },
  };
  const resPatch = createMockRes();
  await updateFindingStatus(reqPatch, resPatch);
  assert.strictEqual(resPatch.statusCode, 200);
  assert.strictEqual(resPatch.body.data.status, "ignored");
  console.log("✅ PASS 7: GET and PATCH on /security/findings/:findingId updates finding status");
  testsPassed++;

  // Test 8: POST /api/projects/:id/code-review validation
  const reqReviewMissing = { params: { projectId }, body: {}, auth: { userId: ownerId } };
  const resReviewMissing = createMockRes();
  await triggerCodeReview(reqReviewMissing, resReviewMissing);
  assert.strictEqual(resReviewMissing.statusCode, 400);
  assert.strictEqual(resReviewMissing.body.code, "MISSING_FILE_PATH");
  console.log("✅ PASS 8: POST /code-review rejects missing filePath with 400 error");
  testsPassed++;

  // Test 9: POST /api/projects/:id/tests/generate validation
  const reqTestMissing = { params: { projectId }, body: {}, auth: { userId: ownerId } };
  const resTestMissing = createMockRes();
  await triggerTestGeneration(reqTestMissing, resTestMissing);
  assert.strictEqual(resTestMissing.statusCode, 400);
  assert.strictEqual(resTestMissing.body.code, "MISSING_FILE_PATH");
  console.log("✅ PASS 9: POST /tests/generate rejects missing filePath with 400 error");
  testsPassed++;

  console.log("==================================================");
  console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
  console.log("==================================================");
}

runApiTests().catch((err) => {
  console.error("API test suite failed:", err);
  process.exit(1);
});
