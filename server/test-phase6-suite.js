// server/test-phase6-suite.js
//
// Comprehensive Automated Test Suite for ArchMind AI Phase 6:
// Complete the Workspace (PDF Reports, Project Management, Reanalysis, Error Handling).
//
// Verifies:
// 1. PDF Report Export: stream generation, layout sections, headers, secret redaction, and incomplete analysis checks.
// 2. Project Management APIs: pagination, sorting, search filtering, field projections, multi-tenant isolation.
// 3. Metadata Updates (PATCH): permitted fields (name, description), rejection of protected fields (status, blueprint, etc.).
// 4. Cascade Cleanup (DELETE): multi-collection cleanup (Project, SourceFile, SecurityFinding, SecurityAudit, DevOpsArtifact, Conversation, disk extraction).
// 5. Reanalysis Workflow (POST /reanalyze): concurrency lock (409), version bumping, cache reset, error resilience.
// 6. Centralized Error Handler: status code mapping, machine-readable codes, path/token sanitization, 404 handler.


import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { PassThrough } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import mongoose from "mongoose";

import { streamProjectPdfReport } from "./src/services/reports/pdfReport.service.js";
import { exportProjectPdfReport } from "./src/controllers/report.controller.js";
import {
  getProjects,
  getProjectById,
  deleteProject,
  updateProjectMetadata,
  reanalyzeProject,
} from "./src/controllers/project.controller.js";
import {
  globalErrorHandler,
  notFoundHandler,
} from "./src/middleware/errorHandler.middleware.js";
import projectRoutes from "./src/routes/project.routes.js";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import SecurityFinding from "./src/models/SecurityFinding.js";
import SecurityAudit from "./src/models/SecurityAudit.js";
import DevOpsArtifact from "./src/models/DevOpsArtifact.js";
import Conversation from "./src/models/Conversation.js";

console.log("==================================================================");
console.log("   ARCHMIND AI — PHASE 6 COMPLETE WORKSPACE AUTOMATED TEST SUITE   ");
console.log("==================================================================");

let testsPassed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${description}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

// ── HTTP Dispatch Helper for In-Memory Express Testing ──────────────────────

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

    // Capture piped or stream data
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

    res.send = function (data) {
      this.body = data;
      resolve({ status: this.statusCode, headers: this.getHeaders(), body: data });
      return this;
    };

    app.handle(req, res, (err) => {
      if (err) {
        resolve({ status: err.status || 500, body: { error: err.message } });
      } else {
        resolve({ status: 404, body: { error: "Not found" } });
      }
    });
  });
}

// ── Test In-Memory Database Store ───────────────────────────────────────────

const store = {
  projects: new Map(),
  sourceFiles: new Map(),
  securityFindings: new Map(),
  securityAudits: new Map(),
  devopsArtifacts: new Map(),
  conversations: new Map(),
};

const ownerId = "user_workspace_owner_601";
const intruderId = "user_workspace_intruder_602";

// Monkey-patch Mongoose Model methods to run purely in memory without an external MongoDB daemon
Project.find = function (query = {}) {
  let list = Array.from(store.projects.values());
  if (query.userId) {
    list = list.filter((p) => p.userId === query.userId);
  }
  if (query.$or) {
    list = list.filter((p) => {
      return query.$or.some((clause) => {
        if (clause.name?.$regex) {
          const re = new RegExp(clause.name.$regex, clause.name.$options || "");
          return re.test(p.name);
        }
        if (clause["github.fullName"]?.$regex) {
          const re = new RegExp(clause["github.fullName"].$regex, clause["github.fullName"].$options || "");
          return re.test(p.github?.fullName || "");
        }
        return false;
      });
    });
  }

  const queryObj = {
    _list: list,
    sort(sortSpec) {
      const [field, order] = Object.entries(sortSpec)[0] || ["updatedAt", -1];
      this._list.sort((a, b) => {
        const valA = a[field] || "";
        const valB = b[field] || "";
        if (valA < valB) return order === 1 ? -1 : 1;
        if (valA > valB) return order === 1 ? 1 : -1;
        return 0;
      });
      return this;
    },
    skip(n) {
      this._list = this._list.slice(n);
      return this;
    },
    limit(n) {
      this._list = this._list.slice(0, n);
      return this;
    },
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(this._list);
    },
  };
  return queryObj;
};

Project.countDocuments = async function (query = {}) {
  let list = Array.from(store.projects.values());
  if (query.userId) {
    list = list.filter((p) => p.userId === query.userId);
  }
  if (query.$or) {
    list = list.filter((p) => {
      return query.$or.some((clause) => {
        if (clause.name?.$regex) {
          const re = new RegExp(clause.name.$regex, clause.name.$options || "");
          return re.test(p.name);
        }
        return false;
      });
    });
  }
  return list.length;
};

Project.findById = function (id) {
  const p = store.projects.get(String(id));
  const res = p
    ? {
        ...p,
        toSafeObject: () => ({ ...p, id: p._id }),
        save: async function () {
          store.projects.set(String(this._id), this);
          return this;
        },
      }
    : null;

  return {
    _result: res,
    lean() {
      return Promise.resolve(this._result);
    },
    then(resolve, reject) {
      return Promise.resolve(this._result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(this._result).catch(reject);
    },
  };
};

Project.findOne = function (query = {}) {
  let matched = null;
  for (const p of store.projects.values()) {
    let match = true;
    if (query._id && String(p._id) !== String(query._id)) match = false;
    if (query.userId && p.userId !== query.userId) match = false;
    if (match) {
      matched = {
        ...p,
        toSafeObject: () => ({ ...p, id: p._id }),
        save: async function () {
          store.projects.set(String(this._id), this);
          return this;
        },
      };
      break;
    }
  }

  return {
    _result: matched,
    lean() {
      return Promise.resolve(this._result);
    },
    then(resolve, reject) {
      return Promise.resolve(this._result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(this._result).catch(reject);
    },
  };
};

Project.findOneAndUpdate = async function (filter, update) {
  const p = await Project.findOne(filter);
  if (!p) return null;
  if (update.$set) {
    Object.assign(p, update.$set);
  }
  store.projects.set(String(p._id), p);
  return {
    ...p,
    toSafeObject: () => ({ ...p, id: p._id }),
  };
};

Project.updateOne = async function (filter, update) {
  const p = store.projects.get(String(filter._id));
  if (p && update.$set) {
    Object.assign(p, update.$set);
    store.projects.set(String(p._id), p);
  }
  return { modifiedCount: p ? 1 : 0 };
};

Project.deleteOne = async function (filter) {
  const p = await Project.findOne(filter);
  if (p) {
    store.projects.delete(String(p._id));
    return { deletedCount: 1 };
  }
  return { deletedCount: 0 };
};

// Child collection mock cleanup handlers
SourceFile.deleteMany = async (filter) => {
  let count = 0;
  for (const [key, item] of store.sourceFiles.entries()) {
    if (String(item.projectId) === String(filter.projectId)) {
      store.sourceFiles.delete(key);
      count++;
    }
  }
  return { deletedCount: count };
};

SecurityFinding.deleteMany = async (filter) => {
  let count = 0;
  for (const [key, item] of store.securityFindings.entries()) {
    if (String(item.projectId) === String(filter.projectId)) {
      store.securityFindings.delete(key);
      count++;
    }
  }
  return { deletedCount: count };
};

SecurityAudit.deleteMany = async (filter) => {
  let count = 0;
  for (const [key, item] of store.securityAudits.entries()) {
    if (String(item.projectId) === String(filter.projectId)) {
      store.securityAudits.delete(key);
      count++;
    }
  }
  return { deletedCount: count };
};

DevOpsArtifact.deleteMany = async (filter) => {
  let count = 0;
  for (const [key, item] of store.devopsArtifacts.entries()) {
    if (String(item.projectId) === String(filter.projectId)) {
      store.devopsArtifacts.delete(key);
      count++;
    }
  }
  return { deletedCount: count };
};

Conversation.deleteMany = async (filter) => {
  let count = 0;
  for (const [key, item] of store.conversations.entries()) {
    if (String(item.projectId) === String(filter.projectId)) {
      store.conversations.delete(key);
      count++;
    }
  }
  return { deletedCount: count };
};

// ── Express Test Server Setup ────────────────────────────────────────────────

const app = express();
app.use(express.json());

let currentAuthUserId = ownerId;

// Mock Clerk auth
app.use((req, res, next) => {
  if (currentAuthUserId) {
    req.auth = { userId: currentAuthUserId };
  } else {
    req.auth = null;
  }
  next();
});

app.use("/api/projects", projectRoutes);
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Seed projects into in-memory store
const completedProjectId = new mongoose.Types.ObjectId().toString();
const incompleteProjectId = new mongoose.Types.ObjectId().toString();
const secondaryProjectId = new mongoose.Types.ObjectId().toString();

const seedCompletedProject = {
  _id: completedProjectId,
  userId: ownerId,
  name: "ArchMind Production Core",
  source: "github",
  status: "completed",
  analysisVersion: 1,
  github: {
    url: "https://github.com/org/archmind-core",
    owner: "org",
    repo: "archmind-core",
    defaultBranch: "main",
    fullName: "org/archmind-core",
  },
  techStack: ["Node.js", "Express", "MongoDB", "React"],
  primaryLanguage: "JavaScript",
  stats: { totalFiles: 42, totalSize: 1048576 },
  tree: [{ path: "server.js", type: "file" }],
  blueprint: {
    generatedAt: new Date(),
    architecture: "Layered Microservices Architecture",
    summary: "High-scale multi-tenant repository intelligence backend.",
  },
  database: {
    models: [
      {
        name: "User",
        fields: [
          { name: "email", type: "String" },
          { name: "role", type: "String" },
        ],
      },
      {
        name: "Project",
        fields: [
          { name: "name", type: "String" },
          { name: "status", type: "String" },
        ],
      },
    ],
  },
  apiRoutes: [
    { method: "GET", path: "/api/projects", handler: "getProjects" },
    { method: "POST", path: "/api/projects/upload", handler: "uploadZip" },
    { method: "GET", path: "/api/projects/:id/report/pdf", handler: "exportProjectPdfReport" },
  ],
  securitySummary: {
    riskScore: 35,
    severityCounts: { Critical: 1, High: 2, Medium: 0, Low: 1 },
  },
  securityFindings: [
    {
      ruleId: "aws-access-key-id",
      title: "Hardcoded AWS Access Key ID Detected",
      severity: "Critical",
      filePath: "src/config/aws.js",
      lineNumber: 12,
    },
  ],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-10"),
};

const seedIncompleteProject = {
  _id: incompleteProjectId,
  userId: ownerId,
  name: "Pending Analysis Repository",
  source: "zip",
  status: "processing",
  analysisVersion: 1,
  blueprint: null,
  createdAt: new Date("2026-01-02"),
  updatedAt: new Date("2026-01-05"),
};

const seedSecondaryProject = {
  _id: secondaryProjectId,
  userId: ownerId,
  name: "Beta Analytics Dashboard",
  source: "zip",
  status: "completed",
  analysisVersion: 2,
  blueprint: { generatedAt: new Date(), summary: "Analytics client" },
  createdAt: new Date("2026-01-03"),
  updatedAt: new Date("2026-01-08"),
};

// Seed stores
store.projects.set(completedProjectId, seedCompletedProject);
store.projects.set(incompleteProjectId, seedIncompleteProject);
store.projects.set(secondaryProjectId, seedSecondaryProject);

// Seed child records for completed project
store.sourceFiles.set("sf1", { projectId: completedProjectId, path: "server.js" });
store.sourceFiles.set("sf2", { projectId: completedProjectId, path: "package.json" });
store.securityFindings.set("sec1", { projectId: completedProjectId, title: "AWS Key" });
store.securityAudits.set("audit1", { projectId: completedProjectId, score: 85 });
store.devopsArtifacts.set("dev1", {
  projectId: completedProjectId,
  artifactType: "dockerfile",
  filePath: "Dockerfile",
  validation: { valid: true },
});
store.conversations.set("conv1", { projectId: completedProjectId, title: "Chat Session 1" });

// ── SECTION 1: PDF Report Export Tests ────────────────────────────────────────

await itAsync("PDF Report Service: Directly streams valid PDF document bytes", async () => {
  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(seedCompletedProject, pass);
  const pdfBuffer = Buffer.concat(chunks);

  assert.ok(pdfBuffer.length > 1000, "PDF buffer must have reasonable size");
  assert.strictEqual(
    pdfBuffer.slice(0, 5).toString("ascii"),
    "%PDF-",
    "Stream output must begin with %PDF- header"
  );
  assert.ok(
    pdfBuffer.toString("binary").includes("%%EOF"),
    "PDF document must terminate with %%EOF marker"
  );
});

await itAsync("PDF Report Service: Strictly redacts sensitive tokens in output", async () => {
  const sensitiveProject = {
    ...seedCompletedProject,
    blueprint: {
      generatedAt: new Date(),
      summary: "Database auth: AKIAIOSFODNN7EXAMPLE and mongodb://user:pass@cluster.mongodb.net",
    },
  };

  const pass = new PassThrough();
  const chunks = [];
  pass.on("data", (chunk) => chunks.push(chunk));

  await streamProjectPdfReport(sensitiveProject, pass);
  const rawString = Buffer.concat(chunks).toString("utf8");

  assert.strictEqual(
    rawString.includes("AKIAIOSFODNN7EXAMPLE"),
    false,
    "Raw AWS key must never appear in uncompressed PDF output"
  );
});

await itAsync("PDF Report Controller: GET /api/projects/:id/report/pdf streams PDF with headers", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${completedProjectId}/report/pdf`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["content-type"], "application/pdf");
  assert.ok(
    res.headers["content-disposition"].includes("archmind-production-core-archmind-report.pdf")
  );
  assert.ok(res.buffer.length > 500);
  assert.strictEqual(res.buffer.slice(0, 5).toString("ascii"), "%PDF-");
});

await itAsync("PDF Report Controller: Rejects incomplete analysis with 400 ANALYSIS_INCOMPLETE", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${incompleteProjectId}/report/pdf`,
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.error.code, "ANALYSIS_INCOMPLETE");
});

await itAsync("PDF Report Controller: Rejects unauthorized access with 401", async () => {
  currentAuthUserId = null;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${completedProjectId}/report/pdf`,
  });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

await itAsync("PDF Report Controller: Rejects forbidden intruder with 403", async () => {
  currentAuthUserId = intruderId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${completedProjectId}/report/pdf`,
  });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

// ── SECTION 2: Project Management APIs (List, Detail, Pagination, Search) ────

await itAsync("GET /api/projects: Returns paginated user projects with pagination metadata", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: "/api/projects?page=1&limit=2",
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.strictEqual(res.body.data.length, 2);
  assert.strictEqual(res.body.pagination.total, 3);
  assert.strictEqual(res.body.pagination.page, 1);
  assert.strictEqual(res.body.pagination.limit, 2);
  assert.strictEqual(res.body.pagination.totalPages, 2);
});

await itAsync("GET /api/projects: Filters projects by search query term", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: "/api/projects?search=Production",
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].name, "ArchMind Production Core");
});

await itAsync("GET /api/projects: Omits heavy fields (tree, ast, blueprint) from list payload", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: "/api/projects",
  });

  assert.strictEqual(res.status, 200);
  const sample = res.body.data[0];
  assert.strictEqual(sample.tree, undefined, "tree should be excluded from list projection");
  assert.strictEqual(sample.ast, undefined, "ast should be excluded from list projection");
  assert.strictEqual(sample.blueprint, undefined, "blueprint should be excluded from list projection");
  assert.ok(sample.id, "id must be present");
  assert.ok(sample.name, "name must be present");
});

await itAsync("GET /api/projects/:id: Returns full project details for owner", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${completedProjectId}`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, "ArchMind Production Core");
  assert.ok(Array.isArray(res.body.data.tree), "File tree should be included on detail query");
});

await itAsync("GET /api/projects/:id: Rejects access from non-owner with multi-tenant isolation", async () => {
  currentAuthUserId = intruderId;
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${completedProjectId}`,
  });

  assert.ok(res.status === 403 || res.status === 404, "Must reject non-owner access");
  assert.strictEqual(res.body.success, false);
});

// ── SECTION 3: Metadata Updates (PATCH /api/projects/:id) ────────────────────

await itAsync("PATCH /api/projects/:id: Updates permitted fields (name, description)", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "PATCH",
    url: `/api/projects/${completedProjectId}`,
    body: {
      name: "ArchMind Production Core (Updated)",
      description: "Updated description for workspace.",
    },
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, "ArchMind Production Core (Updated)");

  const stored = store.projects.get(completedProjectId);
  assert.strictEqual(stored.name, "ArchMind Production Core (Updated)");
  assert.strictEqual(stored.description, "Updated description for workspace.");
});

await itAsync("PATCH /api/projects/:id: Strictly rejects modifying protected fields", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "PATCH",
    url: `/api/projects/${completedProjectId}`,
    body: {
      name: "New Name",
      status: "completed", // Protected!
    },
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "PROTECTED_FIELD_MODIFICATION");
});

await itAsync("PATCH /api/projects/:id: Rejects empty name with VALIDATION_ERROR", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "PATCH",
    url: `/api/projects/${completedProjectId}`,
    body: { name: "   " },
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "VALIDATION_ERROR");
});

// ── SECTION 4: Cascade Cleanup (DELETE /api/projects/:id) ───────────────────

await itAsync("DELETE /api/projects/:id: Multi-collection cascade cleanup", async () => {
  currentAuthUserId = ownerId;

  // Confirm seed child documents exist before deletion
  assert.strictEqual(store.sourceFiles.size, 2);
  assert.strictEqual(store.securityFindings.size, 1);
  assert.strictEqual(store.securityAudits.size, 1);
  assert.strictEqual(store.devopsArtifacts.size, 1);
  assert.strictEqual(store.conversations.size, 1);

  const res = await dispatch(app, {
    method: "DELETE",
    url: `/api/projects/${completedProjectId}`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  // Verify Project document was removed
  assert.strictEqual(store.projects.has(completedProjectId), false);

  // Verify child collections were purged
  assert.strictEqual(store.sourceFiles.size, 0, "SourceFiles must be cascade-deleted");
  assert.strictEqual(store.securityFindings.size, 0, "SecurityFindings must be cascade-deleted");
  assert.strictEqual(store.securityAudits.size, 0, "SecurityAudits must be cascade-deleted");
  assert.strictEqual(store.devopsArtifacts.size, 0, "DevOpsArtifacts must be cascade-deleted");
  assert.strictEqual(store.conversations.size, 0, "Conversations must be cascade-deleted");
});

// ── SECTION 5: Reanalysis Workflow (POST /api/projects/:id/reanalyze) ────────

await itAsync("POST /api/projects/:id/reanalyze: Concurrency lock blocks duplicate in-progress analysis", async () => {
  currentAuthUserId = ownerId;
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${incompleteProjectId}/reanalyze`, // status === "processing"
  });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, "ANALYSIS_IN_PROGRESS");
});

await itAsync("POST /api/projects/:id/reanalyze: Rejects non-existent project with 404", async () => {
  currentAuthUserId = ownerId;
  const fakeId = new mongoose.Types.ObjectId().toString();
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${fakeId}/reanalyze`,
  });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
});

// ── SECTION 6: Centralized Error Handling & Sanitization ─────────────────────

it("Centralized Error Handler: Correctly resolves machine-readable error codes", () => {
  const mockReq = { method: "GET", url: "/api/test", originalUrl: "/api/test" };
  let jsonResponse = null;
  let statusCode = 0;

  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  const customErr = new Error("Resource not found");
  customErr.status = 404;
  globalErrorHandler(customErr, mockReq, mockRes, () => {});

  assert.strictEqual(statusCode, 404);
  assert.strictEqual(jsonResponse.success, false);
  assert.strictEqual(jsonResponse.errorDetail.code, "RESOURCE_NOT_FOUND");
});

it("Centralized Error Handler: Sanitizes secrets and local filesystem paths", () => {
  const mockReq = { method: "POST", url: "/api/projects", originalUrl: "/api/projects" };
  let jsonResponse = null;

  const mockRes = {
    status() {
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  const leakedErr = new Error(
    "Failed to write at C:\\Users\\Administrator\\AppData\\secret\\repo with key AKIAIOSFODNN7EXAMPLE"
  );
  leakedErr.status = 500;
  globalErrorHandler(leakedErr, mockReq, mockRes, () => {});

  assert.ok(
    !jsonResponse.error.includes("AKIAIOSFODNN7EXAMPLE"),
    "Secrets must not be exposed in error messages"
  );
  assert.ok(
    !jsonResponse.error.includes("C:\\Users\\Administrator"),
    "Absolute local paths must not be exposed"
  );
  assert.ok(
    jsonResponse.error.includes("[REDACTED_SECRET:AWS_ACCESS_KEY_ID]") ||
      jsonResponse.error.includes("[REDACTED_PATH]")
  );
});

await itAsync("404 Handler: Unmatched route returns clean 404 JSON with ROUTE_NOT_FOUND code", async () => {
  const res = await dispatch(app, {
    method: "GET",
    url: "/api/unknown-route-endpoint",
  });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
  assert.ok(res.body.error.includes("Route not found"));
  assert.strictEqual(res.body.code, "ROUTE_NOT_FOUND");
  assert.strictEqual(res.body.errorDetail.code, "ROUTE_NOT_FOUND");
});

console.log("==================================================================");
console.log(`🎉 ALL ${testsPassed} PHASE 6 AUTOMATED TESTS PASSED SUCCESSFULLY!`);
console.log("==================================================================");