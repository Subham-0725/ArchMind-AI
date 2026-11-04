// server/test-devops-suite.js
//
// Comprehensive Automated Test Suite for ArchMind AI Phase 5: DevOps Generation.
// Verifies:
// 1. Deterministic Dockerfile validation (syntax, base image, startup, secrets, best practices)
// 2. Deterministic CI/CD workflow validation (YAML structure, triggers, jobs, runners, secrets)
// 3. Deterministic Kubernetes manifest validation (Deployment/Service selectors, ports, secrets)
// 4. Grounded repository context collection (language, runtime, package manager, scripts, ports, probes)
// 5. Repository-grounded generators (Dockerfile, CI/CD, Kubernetes)
// 6. Express HTTP API endpoints, Clerk authentication, multi-tenant authorization, and persistence lifecycle

import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import express from "express";
import mongoose from "mongoose";

import { validateDockerfile } from "./src/devops/validators/dockerfile.validator.js";
import { validateCicdWorkflow } from "./src/devops/validators/cicd.validator.js";
import { validateKubernetesManifests } from "./src/devops/validators/kubernetes.validator.js";
import { collectDevopsContext } from "./src/devops/devopsContext.service.js";
import { generateDockerfile, generateDeterministicDockerfile } from "./src/devops/generators/dockerfile.generator.js";
import { generateCicdWorkflow, generateDeterministicCicd } from "./src/devops/generators/cicd.generator.js";
import { generateKubernetesManifests, generateDeterministicKubernetes } from "./src/devops/generators/kubernetes.generator.js";
import { DevOpsService } from "./src/devops/devops.service.js";
import DevOpsArtifact from "./src/models/DevOpsArtifact.js";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import projectRoutes from "./src/routes/project.routes.js";

console.log("==================================================================");
console.log("   ARCHMIND AI — PHASE 5 DEVOPS GENERATION AUTOMATED TEST SUITE   ");
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

// ── SECTION 1: Deterministic Dockerfile Validator Tests ───────────────────────

it("Dockerfile Validator: Passes valid multi-stage Node.js Dockerfile", () => {
  const validDockerfile = `
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
`;
  const result = validateDockerfile(validDockerfile);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.validationLevel, "structural");
  assert.ok(result.checks.some((c) => c.name === "has_base_image" && c.passed));
  assert.ok(result.checks.some((c) => c.name === "has_startup_command" && c.passed));
  assert.ok(result.checks.some((c) => c.name === "non_root_user" && c.passed));
});

it("Dockerfile Validator: Fails on empty content", () => {
  const result = validateDockerfile("   ");
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("empty")));
});

it("Dockerfile Validator: Fails when missing FROM base image", () => {
  const noFrom = `
WORKDIR /app
COPY . .
CMD ["npm", "start"]
`;
  const result = validateDockerfile(noFrom);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("FROM")));
});

it("Dockerfile Validator: Fails when missing CMD or ENTRYPOINT startup instruction", () => {
  const noCmd = `
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
`;
  const result = validateDockerfile(noCmd);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("CMD") || e.includes("ENTRYPOINT")));
});

it("Dockerfile Validator: Fails when raw secrets or AWS keys are embedded", () => {
  // Dynamically assemble AWS key mock so push protection is never triggered
  const testAwsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
  const secretDockerfile = `
FROM node:20-alpine
ENV AWS_ACCESS_KEY_ID=${testAwsKey}
WORKDIR /app
COPY . .
CMD ["node", "server.js"]
`;
  const result = validateDockerfile(secretDockerfile);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("secret") || e.includes("credential")));
});

it("Dockerfile Validator: Warns on layer caching inversion (COPY . . before npm install)", () => {
  const badCaching = `
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
`;
  const result = validateDockerfile(badCaching);
  assert.strictEqual(result.valid, true); // Still valid structurally, but emits warning
  assert.ok(result.warnings.some((w) => w.includes("layer caching")));
});

// ── SECTION 2: Deterministic CI/CD Workflow Validator Tests ───────────────────

it("CI/CD Validator: Passes valid GitHub Actions workflow", () => {
  const validWorkflow = `
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
permissions:
  contents: read
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Test
        run: npm test
`;
  const result = validateCicdWorkflow(validWorkflow);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.validationLevel, "structural");
  assert.ok(result.checks.some((c) => c.name === "job_structure" && c.passed));
});

it("CI/CD Validator: Fails on empty content or missing triggers", () => {
  const emptyRes = validateCicdWorkflow("");
  assert.strictEqual(emptyRes.valid, false);

  const noOn = `
name: Broken CI
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "hello"
`;
  const noOnRes = validateCicdWorkflow(noOn);
  assert.strictEqual(noOnRes.valid, false);
  assert.ok(noOnRes.errors.some((e) => e.includes("on:")));
});

it("CI/CD Validator: Fails when job has no runs-on or steps", () => {
  const noRunner = `
name: CI
on: [push]
jobs:
  test:
    steps:
      - run: echo "hi"
`;
  const res = validateCicdWorkflow(noRunner);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.some((e) => e.includes("runs-on")));
});

it("CI/CD Validator: Warns when workflow references a nonexistent package.json script", () => {
  const workflowWithNonexistentScript = `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run nonexistent_lint
`;
  const result = validateCicdWorkflow(workflowWithNonexistentScript, {
    scripts: { test: "jest", start: "node index.js" },
  });
  assert.ok(result.warnings.some((w) => w.includes("nonexistent_lint")));
});

it("CI/CD Validator: Fails when raw secret is embedded", () => {
  const testAwsKey = ["AKIA", "IOSFODNN7EXAMPLE"].join("");
  const leakedYaml = `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      AWS_KEY: ${testAwsKey}
    steps:
      - run: echo "deploy"
`;
  const result = validateCicdWorkflow(leakedYaml);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("secret") || e.includes("credential")));
});

// ── SECTION 3: Deterministic Kubernetes Manifest Validator Tests ──────────────

it("Kubernetes Validator: Passes aligned Deployment, Service, and ConfigMap", () => {
  const validK8s = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: myapp-config
data:
  NODE_ENV: "production"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: myapp
          image: myregistry/myapp:1.0.0
          ports:
            - containerPort: 5000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 5000
`;
  const result = validateKubernetesManifests(validK8s);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
  assert.ok(result.checks.some((c) => c.name === "selector_consistency" && c.passed));
  assert.ok(result.checks.some((c) => c.name === "port_consistency" && c.passed));
});

it("Kubernetes Validator: Detects mismatch between Deployment selector matchLabels and pod labels", () => {
  const mismatchedK8s = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
spec:
  selector:
    matchLabels:
      app: correct-app
  template:
    metadata:
      labels:
        app: wrong-label
    spec:
      containers:
        - name: app
          image: app:latest
`;
  const result = validateKubernetesManifests(mismatchedK8s);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("does not match template pod labels")));
});

it("Kubernetes Validator: Fails on missing apiVersion or metadata.name", () => {
  const incompleteK8s = `
kind: Deployment
spec:
  replicas: 1
`;
  const result = validateKubernetesManifests(incompleteK8s);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("apiVersion")));
  assert.ok(result.errors.some((e) => e.includes("metadata.name")));
});

// ── SECTION 4: Context Collection Tests ───────────────────────────────────────

await itAsync("DevOps Context Collector: Correctly extracts Node.js pnpm configuration", async () => {
  const mockProject = {
    _id: new mongoose.Types.ObjectId(),
    name: "ArchMind Test App",
    primaryLanguage: "JavaScript",
    analysisVersion: 1,
    tree: [
      {
        path: "package.json",
        type: "file",
        content: JSON.stringify({
          name: "archmind-app",
          scripts: {
            start: "node src/server.js",
            build: "vite build",
            test: "vitest run",
            lint: "eslint .",
          },
          dependencies: { express: "^4.18.2" },
          engines: { node: ">=20.0.0" },
        }),
      },
      { path: "pnpm-lock.yaml", type: "file" },
      { path: "src/server.js", type: "file" },
      { path: ".env.example", type: "file", content: "PORT=5000\nDATABASE_URL=mongodb://localhost:27017/test\n" },
    ],
    techStack: { languages: ["JavaScript"], frameworks: ["Express"] },
    apiRoutes: [{ path: "/api/health", method: "GET" }, { path: "/api/users", method: "GET" }],
  };

  const context = await collectDevopsContext(mockProject);
  assert.strictEqual(context.primaryLanguage, "JavaScript");
  assert.strictEqual(context.packageManager, "pnpm");
  assert.strictEqual(context.lockfile, "pnpm-lock.yaml");
  assert.strictEqual(context.installCommand, "pnpm install --frozen-lockfile");
  assert.strictEqual(context.startScript, "npm start");
  assert.strictEqual(context.buildScript, "npm run build");
  assert.strictEqual(context.testScript, "npm test");
  assert.strictEqual(context.port, 5000);
  assert.strictEqual(context.healthEndpoint, "/api/health");
  assert.strictEqual(context.runtimeVersion, "20");
});

await itAsync("DevOps Context Collector: Correctly extracts Python requirements.txt & pytest", async () => {
  const mockProject = {
    _id: new mongoose.Types.ObjectId(),
    name: "Python FastApi Service",
    primaryLanguage: "Python",
    analysisVersion: 1,
    tree: [
      { path: "requirements.txt", type: "file", content: "fastapi==0.109.0\nuvicorn==0.27.0\npytest==7.4.0" },
      { path: "app/main.py", type: "file" },
      { path: "tests/test_api.py", type: "file" },
    ],
    techStack: { languages: ["Python"], frameworks: ["FastAPI"] },
    apiRoutes: [{ path: "/health", method: "GET" }],
  };

  const context = await collectDevopsContext(mockProject);
  assert.strictEqual(context.primaryLanguage, "Python");
  assert.strictEqual(context.packageManager, "pip");
  assert.strictEqual(context.lockfile, "requirements.txt");
  assert.strictEqual(context.testScript, "pytest");
  assert.strictEqual(context.healthEndpoint, "/health");
  assert.strictEqual(context.port, 8000); // Default FastAPI port
});

// ── SECTION 5: Generator Tests ────────────────────────────────────────────────

await itAsync("Dockerfile Generator: Produces multi-stage Dockerfile with non-root user", async () => {
  const context = {
    projectName: "ArchMind App",
    primaryLanguage: "JavaScript",
    packageManager: "npm",
    lockfile: "package-lock.json",
    installCommand: "npm ci",
    startScript: "node dist/server.js",
    buildScript: "npm run build",
    runtimeVersion: "20",
    port: 5000,
  };

  const result = await generateDockerfile(context, { useAi: false });
  assert.strictEqual(result.filePath, "Dockerfile");
  assert.strictEqual(result.validation.valid, true);
  assert.ok(result.content.includes("FROM node:20-alpine AS builder"));
  assert.ok(result.content.includes("FROM node:20-alpine AS runner"));
  assert.ok(result.content.includes("USER node"));
  assert.ok(result.content.includes("EXPOSE 5000"));
});

await itAsync("CI/CD Generator: Produces GitHub Actions workflow matching repository scripts", async () => {
  const context = {
    projectName: "ArchMind App",
    primaryLanguage: "JavaScript",
    packageManager: "npm",
    installCommand: "npm ci",
    runtimeVersion: "20",
    testScript: "npm test",
    buildScript: "npm run build",
    lintScript: "npm run lint",
    scripts: {
      test: "jest",
      build: "vite build",
      lint: "eslint .",
    },
  };

  const result = await generateCicdWorkflow(context, { useAi: false });
  assert.strictEqual(result.filePath, ".github/workflows/ci.yml");
  assert.strictEqual(result.validation.valid, true);
  assert.ok(result.content.includes("actions/checkout@v4"));
  assert.ok(result.content.includes("actions/setup-node@v4"));
  assert.ok(result.content.includes("permissions:\n  contents: read"));
  assert.ok(result.content.includes("npm run lint"));
  assert.ok(result.content.includes("npm test"));
  assert.ok(result.content.includes("npm run build"));
});

await itAsync("Kubernetes Generator: Produces aligned Deployment, Service, and probes", async () => {
  const context = {
    projectName: "my-service",
    port: 5000,
    healthEndpoint: "/api/health",
    envVarNames: ["PORT", "NODE_ENV", "DATABASE_URL", "JWT_SECRET"],
  };

  const result = await generateKubernetesManifests(context, { useAi: false });
  assert.strictEqual(result.filePath, "k8s/deployment.yaml");
  assert.strictEqual(result.validation.valid, true);
  assert.ok(result.content.includes("kind: Deployment"));
  assert.ok(result.content.includes("kind: Service"));
  assert.ok(result.content.includes("kind: ConfigMap"));
  assert.ok(result.content.includes("path: /api/health"));
  assert.ok(result.content.includes("containerPort: 5000"));
  assert.ok(result.content.includes("targetPort: 5000"));
});

// ── SECTION 6: API Endpoints, Authentication, & Multi-Tenant Authorization ───

const app = express();
app.use(express.json());

let currentAuthUserId = "user_owner_101";

// Mock Clerk auth middleware
app.use((req, res, next) => {
  if (currentAuthUserId) {
    req.auth = { userId: currentAuthUserId };
  } else {
    req.auth = null;
  }
  next();
});

app.use("/api/projects", projectRoutes);

function dispatch(app, { method, url, body = null }) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = { "content-type": "application/json" };
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

// In-memory test store
const testDb = {
  projects: new Map(),
  artifacts: new Map(),
};

const ownerId = "user_owner_101";
const intruderId = "user_intruder_202";
const testProjectId = new mongoose.Types.ObjectId().toString();

const seedProject = {
  _id: testProjectId,
  userId: ownerId,
  name: "DevOps Production App",
  analysisVersion: 1,
  tree: [
    {
      path: "package.json",
      type: "file",
      content: JSON.stringify({
        name: "devops-app",
        scripts: { start: "node server.js", test: "jest" },
      }),
    },
    { path: "server.js", type: "file" },
  ],
  capabilities: { hasDevops: true },
  analysis: {},
  set(path, val) {
    const parts = path.split(".");
    let cur = this;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  },
  save: async function () {
    return this;
  },
};
testDb.projects.set(testProjectId, seedProject);

// Mock Project model methods
Project.findById = function (id) {
  const p = testDb.projects.get(String(id));
  return {
    ...p,
    then: (resolve) => resolve(p || null),
  };
};

Project.findOne = function (filter) {
  for (const p of testDb.projects.values()) {
    if (filter._id && String(p._id) !== String(filter._id)) continue;
    if (filter.userId && p.userId !== filter.userId) continue;
    return Promise.resolve(p);
  }
  return Promise.resolve(null);
};

// Mock DevOpsArtifact model methods
DevOpsArtifact.create = function (docData) {
  const id = new mongoose.Types.ObjectId().toString();
  const created = {
    _id: id,
    ...docData,
    createdAt: new Date(),
    updatedAt: new Date(),
    toSafeObject: function () {
      return {
        id: this._id,
        projectId: String(this.projectId),
        userId: this.userId,
        artifactType: this.artifactType,
        filePath: this.filePath,
        content: this.content,
        validation: this.validation,
        generationStatus: this.generationStatus,
        version: this.version || 1,
        superseded: Boolean(this.superseded),
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    },
    save: async function () {
      testDb.artifacts.set(this._id, this);
      return this;
    },
  };
  testDb.artifacts.set(id, created);
  return Promise.resolve(created);
};

DevOpsArtifact.find = function (filter) {
  const results = [];
  for (const a of testDb.artifacts.values()) {
    if (filter.projectId && String(a.projectId) !== String(filter.projectId)) continue;
    if (filter.userId && a.userId !== filter.userId) continue;
    if (filter.superseded?.$ne && a.superseded === filter.superseded.$ne) continue;
    results.push(a);
  }
  return {
    sort: () => Promise.resolve(results),
  };
};

DevOpsArtifact.findOne = function (filter) {
  for (const a of testDb.artifacts.values()) {
    if (filter._id && String(a._id) !== String(filter._id)) continue;
    if (filter.projectId && String(a.projectId) !== String(filter.projectId)) continue;
    if (filter.userId && a.userId !== filter.userId) continue;
    return Promise.resolve(a);
  }
  return Promise.resolve(null);
};

DevOpsArtifact.updateMany = function (filter, update) {
  let count = 0;
  for (const a of testDb.artifacts.values()) {
    if (filter.projectId && String(a.projectId) !== String(filter.projectId)) continue;
    if (filter.artifactType && a.artifactType !== filter.artifactType) continue;
    if (filter.superseded !== undefined && a.superseded !== filter.superseded) continue;
    if (update.$set) {
      Object.assign(a, update.$set);
      count++;
    }
  }
  return Promise.resolve({ modifiedCount: count });
};

DevOpsArtifact.deleteOne = function (filter) {
  for (const [id, a] of testDb.artifacts.entries()) {
    if (filter._id && String(a._id) !== String(filter._id)) continue;
    if (filter.projectId && String(a.projectId) !== String(filter.projectId)) continue;
    if (filter.userId && a.userId !== filter.userId) continue;
    testDb.artifacts.delete(id);
    return Promise.resolve({ deletedCount: 1 });
  }
  return Promise.resolve({ deletedCount: 0 });
};

SourceFile.findOne = function (filter) {
  return {
    lean: () => Promise.resolve(null),
    then: (resolve) => resolve(null),
  };
};

// ── Tests for Endpoints ───────────────────────────────────────────────────────

await itAsync("API: Rejects unauthenticated requests with 401", async () => {
  currentAuthUserId = null;
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${testProjectId}/devops/generate`,
    body: {},
  });
  assert.strictEqual(res.status, 401);
  currentAuthUserId = ownerId; // Restore
});

await itAsync("API: Rejects invalid Project ID format with 400", async () => {
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/not-a-valid-id/devops/generate`,
    body: {},
  });
  assert.strictEqual(res.status, 400);
  assert.ok(res.body.error.includes("Invalid project ID format"));
});

await itAsync("API: Rejects non-existent Project with 404", async () => {
  const nonExistentId = new mongoose.Types.ObjectId().toString();
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${nonExistentId}/devops/generate`,
    body: {},
  });
  assert.strictEqual(res.status, 404);
  assert.ok(res.body.error.includes("Project not found"));
});

await itAsync("API: Enforces multi-tenant ownership check (403 Forbidden for intruder)", async () => {
  currentAuthUserId = intruderId;
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${testProjectId}/devops/generate`,
    body: {},
  });
  assert.strictEqual(res.status, 403);
  assert.ok(res.body.error.includes("Forbidden"));
  currentAuthUserId = ownerId; // Restore
});

let createdArtifactId = null;

await itAsync("API: POST /api/projects/:projectId/devops/generate successfully creates artifacts", async () => {
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${testProjectId}/devops/generate`,
    body: {
      artifactTypes: ["dockerfile", "cicd", "kubernetes"],
      options: { useAi: false },
    },
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.artifacts));
  assert.strictEqual(res.body.data.artifacts.length, 3);

  const types = res.body.data.artifacts.map((a) => a.artifactType);
  assert.ok(types.includes("dockerfile"));
  assert.ok(types.includes("cicd"));
  assert.ok(types.includes("kubernetes"));

  createdArtifactId = res.body.data.artifacts[0].id;
});

await itAsync("API: GET /api/projects/:projectId/devops/artifacts lists all active artifacts", async () => {
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${testProjectId}/devops/artifacts`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.artifacts.length, 3);
});

await itAsync("API: GET /api/projects/:projectId/devops/artifacts/:artifactId retrieves single artifact", async () => {
  const res = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${testProjectId}/devops/artifacts/${createdArtifactId}`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.artifact.id, createdArtifactId);
  assert.ok(res.body.data.artifact.content.length > 0);
});

await itAsync("API: POST /api/projects/:projectId/devops/artifacts/:artifactId/regenerate creates new version and supersedes previous", async () => {
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${testProjectId}/devops/artifacts/${createdArtifactId}/regenerate`,
    body: { options: { useAi: false } },
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.artifact.version, 2);

  // Check previous artifact is marked superseded
  const oldDoc = testDb.artifacts.get(createdArtifactId);
  assert.strictEqual(oldDoc.superseded, true);
});

await itAsync("API: POST /api/projects/:projectId/devops/artifacts/:artifactId/validate re-runs deterministic validation", async () => {
  const res = await dispatch(app, {
    method: "POST",
    url: `/api/projects/${testProjectId}/devops/artifacts/${createdArtifactId}/validate`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.artifact.validation.valid, true);
});

await itAsync("API: DELETE /api/projects/:projectId/devops/artifacts/:artifactId removes the artifact", async () => {
  const res = await dispatch(app, {
    method: "DELETE",
    url: `/api/projects/${testProjectId}/devops/artifacts/${createdArtifactId}`,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);

  // Subsequent get returns 404
  const getRes = await dispatch(app, {
    method: "GET",
    url: `/api/projects/${testProjectId}/devops/artifacts/${createdArtifactId}`,
  });
  assert.strictEqual(getRes.status, 404);
});

console.log("\n==================================================================");
console.log(`   TEST RESULTS: ALL ${testsPassed} TESTS PASSED (100% SUCCESS)    `);
console.log("==================================================================");
