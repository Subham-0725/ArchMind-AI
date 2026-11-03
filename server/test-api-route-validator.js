// server/test-api-route-validator.js
import assert from "node:assert";
import { validateRouteRecord, validateRouteCollection } from "./src/rie/api/routeValidator.js";

console.log("==================================================");
console.log("Running API Route Validator Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Valid Route Record
{
  const validRoute = {
    routeId: "route_get_users_1234",
    method: "GET",
    path: "/api/users",
    framework: "express",
    sourceFile: "src/routes/users.js",
    lineRange: { startLine: 10, endLine: 15 },
    handlerName: "getUsers",
    controllerName: null,
    routerName: "router",
    middleware: ["requireAuth"],
    params: [],
    queryParams: [],
    requestBodySchema: null,
    responseInfo: null,
    isAuthProtected: true,
    confidence: "high",
    notes: null,
  };

  const result = validateRouteRecord(validRoute);
  assert.strictEqual(result.isValid, true, "Valid route record should pass validation");
  assert.strictEqual(result.errors.length, 0);

  console.log("✅ PASS: Accepts valid route records");
  testsPassed++;
}

// Test 2: Rejects Path Traversal in Source File
{
  const invalidPathRoute = {
    routeId: "route_1",
    method: "POST",
    path: "/login",
    framework: "express",
    sourceFile: "../../../etc/passwd",
    lineRange: { startLine: 1, endLine: 2 },
  };

  const result = validateRouteRecord(invalidPathRoute);
  assert.strictEqual(result.isValid, false, "Must reject path traversal in sourceFile");
  assert(result.errors.some((e) => e.includes("path safety constraints")));

  console.log("✅ PASS: Rejects path traversal and dangerous source file paths");
  testsPassed++;
}

// Test 3: Rejects Non-integer or Inverted Line Ranges
{
  const invalidLineRoute = {
    routeId: "route_2",
    method: "DELETE",
    path: "/users/:id",
    framework: "express",
    sourceFile: "routes/user.js",
    lineRange: { startLine: 50, endLine: 20 }, // inverted: endLine < startLine
  };

  const result = validateRouteRecord(invalidLineRoute);
  assert.strictEqual(result.isValid, false, "Must reject inverted line ranges");
  assert(result.errors.some((e) => e.includes("startLine")));

  console.log("✅ PASS: Rejects non-integer or inverted line ranges");
  testsPassed++;
}

// Test 4: Rejects Invalid HTTP Method
{
  const invalidMethodRoute = {
    routeId: "route_3",
    method: "INVALID_VERB",
    path: "/users",
    framework: "express",
    sourceFile: "routes/user.js",
    lineRange: { startLine: 5, endLine: 6 },
  };

  const result = validateRouteRecord(invalidMethodRoute);
  assert.strictEqual(result.isValid, false, "Must reject unsupported HTTP methods");
  assert(result.errors.some((e) => e.includes("Invalid HTTP method")));

  console.log("✅ PASS: Rejects unsupported HTTP methods");
  testsPassed++;
}

// Test 5: Collection Validation and Rejection Accounting
{
  const collection = [
    {
      routeId: "route_valid",
      method: "GET",
      path: "/ok",
      framework: "express",
      sourceFile: "routes/ok.js",
      lineRange: { startLine: 1, endLine: 2 },
    },
    {
      routeId: "route_bad",
      method: "FOO",
      path: "/bad",
      framework: "express",
      sourceFile: "routes/bad.js",
      lineRange: { startLine: 1, endLine: 2 },
    },
  ];

  const colResult = validateRouteCollection(collection);
  assert.strictEqual(colResult.isValid, false);
  assert.strictEqual(colResult.validRoutes.length, 1);
  assert.strictEqual(colResult.rejectedCount, 1);

  console.log("✅ PASS: Collection validation filters invalid routes cleanly");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");

