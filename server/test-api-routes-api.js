// server/test-api-routes-api.js
import assert from "node:assert";
import mongoose from "mongoose";
import {
  getProjectApiRoutes,
  getProjectApiRouteDetail,
  getRouteSequenceDiagram,
} from "./src/controllers/apiRoute.controller.js";
import Project from "./src/models/Project.js";

console.log("==================================================");
console.log("Running API Routes & Explorer Endpoints Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Setup Mock Project in Memory
const mockUserId = "user_clerk_12345";
const otherUserId = "user_attacker_99999";
const mockProjectId = new mongoose.Types.ObjectId();

const mockRoutes = [
  {
    routeId: "route_get_users_1",
    method: "GET",
    path: "/api/users",
    framework: "express",
    sourceFile: "src/routes/user.routes.js",
    lineRange: { startLine: 10, endLine: 12 },
    handlerName: "getUsers",
    controllerName: "UserController",
    routerName: "userRouter",
    middleware: ["requireAuth"],
    params: [],
    isAuthProtected: true,
    confidence: "high",
  },
  {
    routeId: "route_post_users_2",
    method: "POST",
    path: "/api/users",
    framework: "express",
    sourceFile: "src/routes/user.routes.js",
    lineRange: { startLine: 14, endLine: 18 },
    handlerName: "createUser",
    controllerName: "UserController",
    routerName: "userRouter",
    middleware: ["requireAuth", "validateBody"],
    params: [],
    isAuthProtected: true,
    confidence: "high",
  },
  {
    routeId: "route_get_health_3",
    method: "GET",
    path: "/health",
    framework: "express",
    sourceFile: "src/routes/health.js",
    lineRange: { startLine: 4, endLine: 6 },
    handlerName: "healthCheck",
    controllerName: null,
    routerName: "app",
    middleware: [],
    params: [],
    isAuthProtected: false,
    confidence: "high",
  },
  {
    routeId: "route_get_items_4",
    method: "GET",
    path: "/items/{item_id}",
    framework: "fastapi",
    sourceFile: "backend/main.py",
    lineRange: { startLine: 20, endLine: 25 },
    handlerName: "read_item",
    controllerName: null,
    routerName: "router",
    middleware: [],
    params: ["item_id"],
    isAuthProtected: false,
    confidence: "high",
  },
];

const mockProjectDoc = {
  _id: mockProjectId,
  userId: mockUserId,
  name: "Test API Project",
  source: "github",
  analysisVersion: 2,
  lastAnalyzedAt: new Date("2026-03-01T12:00:00Z"),
  tree: [
    {
      path: "src/routes/user.routes.js",
      type: "file",
      content: `
router.get('/api/users', requireAuth, async (req, res) => {
  const users = await UserModel.find();
  res.json(users);
});
      `,
    },
  ],
  analysisResults: {
    apiRoutes: mockRoutes,
    apiSequences: {},
  },
  save: async function () { return this; },
  set: function (k, v) {
    const parts = k.split(".");
    let cur = this;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  },
};

// Mock Project.findOne
const origFindOne = Project.findOne;
Project.findOne = async ({ _id, userId }) => {
  if (String(_id) === String(mockProjectId) && userId === mockUserId) {
    return mockProjectDoc;
  }
  return null;
};

// Mock Response Helper
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

// Test 1: GET /api/projects/:id/api-routes — Full List
{
  const req = {
    auth: { userId: mockUserId },
    params: { id: String(mockProjectId) },
    query: {},
  };
  const res = createMockRes();

  await getProjectApiRoutes(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.routeCount, 4);
  assert.strictEqual(res.body.data.totalRoutes, 4);
  assert.deepStrictEqual(res.body.data.summary.byMethod, { GET: 3, POST: 1 });
  assert.strictEqual(res.body.data.summary.authProtectedCount, 2);

  console.log("✅ PASS: Route list endpoint returns all routes with method summaries");
  testsPassed++;
}

// Test 2: GET /api/projects/:id/api-routes — Filtering (method, framework, search, auth)
{
  // Filter by method: POST
  {
    const req = {
      auth: { userId: mockUserId },
      params: { id: String(mockProjectId) },
      query: { method: "POST" },
    };
    const res = createMockRes();
    await getProjectApiRoutes(req, res);
    assert.strictEqual(res.body.data.routeCount, 1);
    assert.strictEqual(res.body.data.routes[0].method, "POST");
  }

  // Filter by framework: fastapi
  {
    const req = {
      auth: { userId: mockUserId },
      params: { id: String(mockProjectId) },
      query: { framework: "fastapi" },
    };
    const res = createMockRes();
    await getProjectApiRoutes(req, res);
    assert.strictEqual(res.body.data.routeCount, 1);
    assert.strictEqual(res.body.data.routes[0].framework, "fastapi");
  }

  // Filter by search: "health"
  {
    const req = {
      auth: { userId: mockUserId },
      params: { id: String(mockProjectId) },
      query: { search: "health" },
    };
    const res = createMockRes();
    await getProjectApiRoutes(req, res);
    assert.strictEqual(res.body.data.routeCount, 1);
    assert.strictEqual(res.body.data.routes[0].path, "/health");
  }

  // Filter by auth: "true"
  {
    const req = {
      auth: { userId: mockUserId },
      params: { id: String(mockProjectId) },
      query: { auth: "true" },
    };
    const res = createMockRes();
    await getProjectApiRoutes(req, res);
    assert.strictEqual(res.body.data.routeCount, 2);
    assert(res.body.data.routes.every((r) => r.isAuthProtected === true));
  }

  console.log("✅ PASS: Route list query filtering (method, framework, search, auth)");
  testsPassed++;
}

// Test 3: GET /api/projects/:id/api-routes/:routeId — Route Detail with Source Citation
{
  const req = {
    auth: { userId: mockUserId },
    params: { id: String(mockProjectId), routeId: "route_get_users_1" },
  };
  const res = createMockRes();

  await getProjectApiRouteDetail(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.route.routeId, "route_get_users_1");
  assert.strictEqual(res.body.data.citation.sourceFile, "src/routes/user.routes.js");
  assert.strictEqual(res.body.data.citation.startLine, 10);
  assert.strictEqual(res.body.data.citation.endLine, 12);
  assert(res.body.data.citation.fileRetrievalUrl.includes("file?path="));

  console.log("✅ PASS: Route detail endpoint with line-level source citations");
  testsPassed++;
}

// Test 4: GET /api/projects/:id/api-routes/:routeId/sequence — Sequence Diagram Generation & Caching
{
  const req = {
    auth: { userId: mockUserId },
    params: { id: String(mockProjectId), routeId: "route_get_users_1" },
  };
  const res = createMockRes();

  // 1. Initial generation (cached: false)
  await getRouteSequenceDiagram(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.cached, false);
  assert(res.body.data.mermaid.includes("sequenceDiagram"));
  assert(res.body.data.participants.length >= 3);

  // 2. Second retrieval (cached: true)
  const resCached = createMockRes();
  await getRouteSequenceDiagram(req, resCached);
  assert.strictEqual(resCached.statusCode, 200);
  assert.strictEqual(resCached.body.data.cached, true);

  console.log("✅ PASS: Route sequence diagram generation and analysis-version caching");
  testsPassed++;
}

// Test 5: Multi-Tenant Project Ownership Isolation
{
  const req = {
    auth: { userId: otherUserId }, // Different user
    params: { id: String(mockProjectId) },
    query: {},
  };
  const res = createMockRes();

  await getProjectApiRoutes(req, res);
  assert.strictEqual(res.statusCode, 404, "Must deny unauthorized access and return 404");
  assert.strictEqual(res.body.success, false);

  console.log("✅ PASS: Multi-tenant ownership isolation prevents cross-tenant data access");
  testsPassed++;
}

// Test 6: Route Not Found Handling
{
  const req = {
    auth: { userId: mockUserId },
    params: { id: String(mockProjectId), routeId: "non_existent_route" },
  };
  const res = createMockRes();

  await getProjectApiRouteDetail(req, res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.code, "ROUTE_NOT_FOUND");

  console.log("✅ PASS: Graceful handling for missing route IDs");
  testsPassed++;
}

// Restore Project.findOne
Project.findOne = origFindOne;

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");

