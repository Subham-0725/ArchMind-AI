// server/test-api-route-extractor.js
import assert from "node:assert";
import {
  extractApiRoutes,
  extractPathParams,
  resolveStaticRoutePath,
  isRouteAuthProtected,
  generateRouteId,
  deduplicateRoutes,
} from "./src/rie/api/routeExtractor.js";

console.log("==================================================");
console.log("Running API Route Extractor Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Express Route Declarations & Parameter Parsing
{
  const expressCode = `
const express = require('express');
const router = express.Router();
const { requireAuth, validateId } = require('../middleware');

router.get('/users', listUsers);
router.get('/users/:id', requireAuth, validateId, getUserById);
router.post('/users', requireAuth, createUser);
router.delete('/users/:id', requireAuth, deleteUser);
`;

  const tree = [
    {
      path: "src/routes/user.routes.js",
      type: "file",
      content: expressCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 4, "Should extract 4 Express routes");

  const getUser = result.routes.find((r) => r.method === "GET" && r.path === "/users/:id");
  assert(getUser, "Should find GET /users/:id route");
  assert.strictEqual(getUser.handlerName, "getUserById");
  assert.deepStrictEqual(getUser.params, ["id"]);
  assert.deepStrictEqual(getUser.middleware, ["requireAuth", "validateId"]);
  assert.strictEqual(getUser.isAuthProtected, true);
  assert(getUser.lineRange.startLine >= 1);
  assert(getUser.lineRange.endLine >= getUser.lineRange.startLine);

  console.log("✅ PASS: Express route extraction, params, and middleware detection");
  testsPassed++;
}

// Test 2: Chained Express routes (router.route)
{
  const chainedCode = `
router.route('/items')
  .get(getItems)
  .post(createItem);
`;

  const tree = [
    {
      path: "src/routes/item.routes.js",
      type: "file",
      content: chainedCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 2, "Should extract 2 routes from chained declaration");
  const methods = result.routes.map((r) => r.method).sort();
  assert.deepStrictEqual(methods, ["GET", "POST"]);

  console.log("✅ PASS: Chained router.route().get().post() extraction");
  testsPassed++;
}

// Test 3: Constant Path Prefixes Resolution
{
  const constantsCode = `
const API_V1 = "/api/v1";
router.get(\`\${API_V1}/products\`, getProducts);
router.get(\`\${API_V1}/products/:sku\`, getProductBySku);
`;

  const tree = [
    {
      path: "src/routes/product.routes.js",
      type: "file",
      content: constantsCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 2, "Should extract 2 routes with resolved prefix");
  assert(result.routes.some((r) => r.path === "/api/v1/products"));
  assert(result.routes.some((r) => r.path === "/api/v1/products/:sku"));

  console.log("✅ PASS: Constant prefix resolution in route declarations");
  testsPassed++;
}

// Test 4: NestJS Decorators and Controllers
{
  const nestCode = `
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

@Controller('customers')
export class CustomerController {
  @Get()
  findAll() { return []; }

  @UseGuards(AuthGuard)
  @Get(':customerId')
  findOne() { return {}; }

  @Post()
  create() { return {}; }
}
`;

  const tree = [
    {
      path: "src/controllers/customer.controller.ts",
      type: "file",
      content: nestCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 3, "Should extract 3 NestJS decorator routes");
  const authRoute = result.routes.find((r) => r.path === "/customers/:customerId");
  assert(authRoute, "Should find /customers/:customerId");
  assert.strictEqual(authRoute.framework, "nestjs");
  assert.strictEqual(authRoute.controllerName, "CustomerController");
  assert.strictEqual(authRoute.isAuthProtected, true);
  assert.deepStrictEqual(authRoute.params, ["customerId"]);

  console.log("✅ PASS: NestJS controller and decorator routes extraction");
  testsPassed++;
}

// Test 5: FastAPI & Flask Python Route Extraction
{
  const pythonCode = `
from fastapi import FastAPI, Depends, APIRouter

app = FastAPI()
router = APIRouter()

@app.get("/api/health")
def health():
    return {"status": "ok"}

@router.post("/items/{item_id}")
async def create_item(item_id: int):
    return {"item_id": item_id}
`;

  const tree = [
    {
      path: "backend/main.py",
      type: "file",
      content: pythonCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 2, "Should extract 2 Python routes");
  const itemRoute = result.routes.find((r) => r.method === "POST" && r.path === "/items/{item_id}");
  assert(itemRoute, "Should find FastAPI /items/{item_id} route");
  assert.strictEqual(itemRoute.framework, "fastapi");
  assert.deepStrictEqual(itemRoute.params, ["item_id"]);
  assert.strictEqual(itemRoute.handlerName, "create_item");

  console.log("✅ PASS: FastAPI and Flask Python route extraction");
  testsPassed++;
}

// Test 6: Django URL Patterns
{
  const djangoCode = `
from django.urls import path
from . import views

urlpatterns = [
    path('articles/', views.article_list, name='article_list'),
    path('articles/<int:article_id>/', views.article_detail, name='article_detail'),
]
`;

  const tree = [
    {
      path: "myproject/urls.py",
      type: "file",
      content: djangoCode,
    },
  ];

  const result = await extractApiRoutes(tree);
  assert.strictEqual(result.totalCount, 2, "Should extract 2 Django routes");
  const detailRoute = result.routes.find((r) => r.path === "/articles/<int:article_id>/");
  assert(detailRoute);
  assert.strictEqual(detailRoute.framework, "django");
  assert.deepStrictEqual(detailRoute.params, ["article_id"]);

  console.log("✅ PASS: Django urlpatterns extraction");
  testsPassed++;
}

// Test 7: Route Deduplication and ID Stability
{
  const id1 = generateRouteId("GET", "/users", "src/routes.js", 10);
  const id2 = generateRouteId("GET", "/users", "src/routes.js", 10);
  assert.strictEqual(id1, id2, "Route IDs must be deterministic and stable");

  const duplicates = [
    { method: "GET", path: "/users", sourceFile: "routes.js", lineRange: { startLine: 5 }, handlerName: "list" },
    { method: "GET", path: "/users", sourceFile: "routes.js", lineRange: { startLine: 5 }, handlerName: "list" },
    { method: "POST", path: "/users", sourceFile: "routes.js", lineRange: { startLine: 12 }, handlerName: "create" },
  ];

  const deduped = deduplicateRoutes(duplicates);
  assert.strictEqual(deduped.length, 2, "Deduplication must eliminate duplicate entries");

  console.log("✅ PASS: Deterministic route IDs and deduplication");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");

