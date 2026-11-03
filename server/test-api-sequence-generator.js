// server/test-api-sequence-generator.js
import assert from "node:assert";
import { generateRouteSequence, generateMermaidDiagram } from "./src/rie/api/sequenceGenerator.js";

console.log("==================================================");
console.log("Running API Request Sequence Generator Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Full Request Flow (Client -> Router -> Middleware -> Controller -> DB -> Client)
{
  const route = {
    routeId: "route_get_users_1",
    method: "GET",
    path: "/api/users/:id",
    framework: "express",
    sourceFile: "src/routes/user.routes.js",
    lineRange: { startLine: 10, endLine: 12 },
    handlerName: "getUser",
    controllerName: "UserController",
    routerName: "userRouter",
    middleware: ["requireAuth", "validateId"],
    isAuthProtected: true,
  };

  const project = {
    analysisVersion: 2,
    tree: [
      {
        path: "src/routes/user.routes.js",
        type: "file",
        content: `
router.get('/api/users/:id', requireAuth, validateId, async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  res.status(200).json(user);
});
        `,
      },
    ],
  };

  const sequence = generateRouteSequence(route, project);

  assert.strictEqual(sequence.routeId, "route_get_users_1");
  assert.strictEqual(sequence.analysisVersion, 2);
  assert(sequence.participants.length >= 4, "Should have Client, Router, Middleware, and Controller participants");

  // Verify all message participant references exist
  const participantIds = new Set(sequence.participants.map((p) => p.id));
  for (const msg of sequence.messages) {
    assert(participantIds.has(msg.from), `Message from '${msg.from}' must be in participants`);
    assert(participantIds.has(msg.to), `Message to '${msg.to}' must be in participants`);
    assert(msg.source, "Message must have source citation");
    assert.strictEqual(typeof msg.source.startLine, "number");
  }

  // Verify Mermaid output
  assert(sequence.mermaid.includes("sequenceDiagram"), "Mermaid must start with sequenceDiagram");
  assert(sequence.mermaid.includes("actor client as Client"));
  assert(sequence.mermaid.includes("userrouter"));

  console.log("✅ PASS: Generates complete sequence diagram with participants, citations, and Mermaid");
  testsPassed++;
}

// Test 2: Downstream Service and Database Call Tracing
{
  const route = {
    routeId: "route_post_orders_2",
    method: "POST",
    path: "/orders",
    framework: "express",
    sourceFile: "src/routes/order.routes.js",
    lineRange: { startLine: 2, endLine: 6 },
    handlerName: "createOrder",
    controllerName: "OrderController",
    routerName: "orderRouter",
    middleware: ["requireAuth"],
  };

  const project = {
    analysisVersion: 1,
    tree: [
      {
        path: "src/routes/order.routes.js",
        type: "file",
        content: `
router.post('/orders', requireAuth, async (req, res) => {
  const result = await orderService.createOrder(req.body);
  const record = await OrderModel.create(result);
  res.status(201).json(record);
});
        `,
      },
    ],
  };

  const sequence = generateRouteSequence(route, project);
  const kinds = sequence.messages.map((m) => m.kind);
  assert(kinds.includes("service"), "Should trace service call");
  assert(kinds.includes("db"), "Should trace database call");
  assert(kinds.includes("response"), "Should trace response completion");

  console.log("✅ PASS: Traces service and database calls with line citations");
  testsPassed++;
}

// Test 3: Bounding Limits Enforcement (Prevent runaway loops)
{
  const route = {
    routeId: "route_loop",
    method: "GET",
    path: "/deep",
    framework: "express",
    sourceFile: "src/deep.js",
    lineRange: { startLine: 1, endLine: 5 },
    // Many middlewares
    middleware: Array.from({ length: 15 }, (_, i) => `mw_${i}`),
  };

  const project = {
    analysisVersion: 1,
    tree: [{ path: "src/deep.js", content: "" }],
  };

  const sequence = generateRouteSequence(route, project);
  assert(sequence.participants.length <= 10, "Must not exceed MAX_PARTICIPANTS");
  assert(sequence.messages.length <= 25, "Must not exceed MAX_MESSAGES");
  assert(sequence.warnings.length > 0, "Should record warnings when bounds are hit");

  console.log("✅ PASS: Enforces safety bounds (MAX_PARTICIPANTS, MAX_MESSAGES)");
  testsPassed++;
}

// Test 4: Mermaid Syntax Validation
{
  const participants = [
    { id: "client", name: "Client", type: "client" },
    { id: "router", name: "Router", type: "router" },
  ];
  const messages = [
    { from: "client", to: "router", label: "GET /api", kind: "call" },
    { from: "router", to: "client", label: "200 OK", kind: "response" },
  ];

  const mermaidStr = generateMermaidDiagram(participants, messages);
  assert.strictEqual(
    mermaidStr.trim(),
    `sequenceDiagram
    autonumber
    actor client as Client
    participant router as Router
    client->>router: GET /api
    router-->>client: 200 OK`
  );

  console.log("✅ PASS: Generates clean, standard Mermaid sequence syntax");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
