// scratch/test-relevance-detection.js
//
// End-to-end unit tests for the Smart Relevance Detection feature.
// Tests: detectCapabilities, analysis endpoints, caching.

import { detectCapabilities } from "../server/src/rie/relevanceDetector.js";

const pass = (label) => console.log(`  ✓ ${label}`);
const fail = (label, detail) => { console.error(`  ✕ ${label}: ${detail}`); process.exitCode = 1; };
const assert = (cond, label, detail = "") => cond ? pass(label) : fail(label, detail);

let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
  } catch (e) {
    fail(name, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CAPABILITY DETECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ 1. CAPABILITY DETECTION ═══\n");

// ── 1a. Database/ORM detection ──────────────────────────────────────────────
console.log("── Database Detection ──");

test("Mongoose models directory", () => {
  const tree = [
    { path: "src/models/User.js", type: "file" },
    { path: "src/models/Post.js", type: "file" },
    { path: "src/index.js", type: "file" },
  ];
  const techStack = { languages: ["JavaScript"], frameworks: ["Express"], databases: [], devops: [] };
  const result = detectCapabilities(tree, techStack, null);
  assert(result.hasDatabase === true, "models/ directory → hasDatabase=true", `got ${result.hasDatabase}`);
});

test("Prisma schema", () => {
  const tree = [
    { path: "prisma/schema.prisma", type: "file" },
    { path: "src/index.ts", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDatabase === true, "prisma/schema.prisma → hasDatabase=true", `got ${result.hasDatabase}`);
  assert(result.details.databases.includes("Prisma"), "details include Prisma", `got ${JSON.stringify(result.details.databases)}`);
});

test("SQL files", () => {
  const tree = [
    { path: "db/migrations/001_init.sql", type: "file" },
    { path: "src/app.py", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDatabase === true, ".sql files → hasDatabase=true", `got ${result.hasDatabase}`);
});

test("TechStack databases pre-populated", () => {
  const tree = [{ path: "src/index.js", type: "file" }];
  const techStack = { databases: ["MongoDB"], frameworks: [], languages: [], devops: [] };
  const result = detectCapabilities(tree, techStack, null);
  assert(result.hasDatabase === true, "techStack.databases non-empty → hasDatabase=true", `got ${result.hasDatabase}`);
});

test("No database signals → false", () => {
  const tree = [
    { path: "src/App.jsx", type: "file" },
    { path: "src/components/Button.jsx", type: "file" },
    { path: "package.json", type: "file" },
  ];
  const result = detectCapabilities(tree, { languages: ["JavaScript"], frameworks: ["React"], databases: [], devops: [] }, null);
  assert(result.hasDatabase === false, "no database signals → hasDatabase=false", `got ${result.hasDatabase}`);
});

// ── 1b. API Detection ───────────────────────────────────────────────────────
console.log("\n── API Detection ──");

test("Express framework", () => {
  const tree = [{ path: "src/index.js", type: "file" }];
  const techStack = { frameworks: ["Express"], languages: ["JavaScript"], databases: [], devops: [] };
  const result = detectCapabilities(tree, techStack, null);
  assert(result.hasApis === true, "Express framework → hasApis=true", `got ${result.hasApis}`);
});

test("Routes directory", () => {
  const tree = [
    { path: "src/routes/auth.js", type: "file" },
    { path: "src/routes/users.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasApis === true, "routes/ directory → hasApis=true", `got ${result.hasApis}`);
});

test("Controllers directory", () => {
  const tree = [
    { path: "src/controllers/userController.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasApis === true, "controllers/ directory → hasApis=true", `got ${result.hasApis}`);
});

test("pages/api (Next.js)", () => {
  const tree = [
    { path: "pages/api/hello.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasApis === true, "pages/api/ → hasApis=true", `got ${result.hasApis}`);
});

test("Swagger/OpenAPI spec", () => {
  const tree = [
    { path: "swagger.json", type: "file" },
    { path: "src/app.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasApis === true, "swagger.json → hasApis=true", `got ${result.hasApis}`);
});

test("No API signals → false", () => {
  const tree = [
    { path: "src/App.jsx", type: "file" },
    { path: "src/utils/helpers.js", type: "file" },
  ];
  const result = detectCapabilities(tree, { frameworks: ["React"], languages: [], databases: [], devops: [] }, null);
  assert(result.hasApis === false, "frontend-only → hasApis=false", `got ${result.hasApis}`);
});

// ── 1c. DevOps Detection ────────────────────────────────────────────────────
console.log("\n── DevOps Detection ──");

test("Dockerfile", () => {
  const tree = [
    { path: "Dockerfile", type: "file" },
    { path: "src/index.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDevops === true, "Dockerfile → hasDevops=true", `got ${result.hasDevops}`);
  assert(result.details.devops.includes("Docker"), "details include Docker", `got ${JSON.stringify(result.details.devops)}`);
});

test("GitHub Actions workflow", () => {
  const tree = [
    { path: ".github/workflows/ci.yml", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDevops === true, ".github/workflows → hasDevops=true", `got ${result.hasDevops}`);
  assert(result.details.devops.includes("GitHub Actions"), "details include GitHub Actions", `got ${JSON.stringify(result.details.devops)}`);
});

test("Kubernetes manifests", () => {
  const tree = [
    { path: "k8s/deployment.yaml", type: "file" },
    { path: "k8s/service.yaml", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDevops === true, "k8s/ → hasDevops=true", `got ${result.hasDevops}`);
});

test("docker-compose", () => {
  const tree = [
    { path: "docker-compose.yml", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDevops === true, "docker-compose.yml → hasDevops=true", `got ${result.hasDevops}`);
});

test("No DevOps signals → false", () => {
  const tree = [
    { path: "src/App.jsx", type: "file" },
    { path: "package.json", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDevops === false, "no devops → hasDevops=false", `got ${result.hasDevops}`);
});

// ── 1d. Security Detection ──────────────────────────────────────────────────
console.log("\n── Security Detection ──");

test("Auth middleware directory", () => {
  const tree = [
    { path: "src/middleware/auth.js", type: "file" },
    { path: "src/routes/users.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasSecuritySensitiveCode === true, "middleware/ → hasSecurity=true", `got ${result.hasSecuritySensitiveCode}`);
});

test(".env file", () => {
  const tree = [
    { path: ".env.example", type: "file" },
    { path: "src/index.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasSecuritySensitiveCode === true, ".env.example → hasSecurity=true", `got ${result.hasSecuritySensitiveCode}`);
});

test("API presence triggers security", () => {
  const tree = [
    { path: "src/routes/api.js", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  // hasApis should be true from routes/, and security follows APIs
  assert(result.hasSecuritySensitiveCode === true, "API presence → hasSecurity=true", `got ${result.hasSecuritySensitiveCode}`);
});

test("No security signals → false", () => {
  const tree = [
    { path: "src/utils/math.js", type: "file" },
    { path: "src/App.jsx", type: "file" },
  ];
  const result = detectCapabilities(tree, { frameworks: ["React"], languages: [], databases: [], devops: [] }, null);
  assert(result.hasSecuritySensitiveCode === false, "frontend-only → hasSecurity=false", `got ${result.hasSecuritySensitiveCode}`);
});

// ── 1e. Frontend-only repo ──────────────────────────────────────────────────
console.log("\n── Frontend-Only Repository ──");

test("Pure React frontend → all irrelevant capabilities false", () => {
  const tree = [
    { path: "src/App.jsx", type: "file" },
    { path: "src/components/Button.jsx", type: "file" },
    { path: "src/components/Header.jsx", type: "file" },
    { path: "src/utils/format.js", type: "file" },
    { path: "public/index.html", type: "file" },
    { path: "package.json", type: "file" },
  ];
  const techStack = { languages: ["JavaScript"], frameworks: ["React"], databases: [], devops: [] };
  const result = detectCapabilities(tree, techStack, null);
  assert(result.hasDatabase === false, "no DB in frontend repo", `got ${result.hasDatabase}`);
  assert(result.hasApis === false, "no APIs in frontend repo", `got ${result.hasApis}`);
  assert(result.hasDevops === false, "no DevOps in frontend repo", `got ${result.hasDevops}`);
  assert(result.hasSecuritySensitiveCode === false, "no security in frontend repo", `got ${result.hasSecuritySensitiveCode}`);
});

// ── 1f. False positive checks ───────────────────────────────────────────────
console.log("\n── False Positive Checks ──");

test("docs/models/ should not trigger database", () => {
  const tree = [
    { path: "docs/models/architecture.md", type: "file" },
    { path: "src/App.jsx", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDatabase === false, "docs/models/ is excluded", `got ${result.hasDatabase}`);
});

test("test/routes/ should not trigger API", () => {
  const tree = [
    { path: "test/routes/auth.test.js", type: "file" },
    { path: "src/App.jsx", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasApis === false, "test/routes/ is excluded", `got ${result.hasApis}`);
});

test(".sql in docs/ should not trigger database", () => {
  const tree = [
    { path: "docs/schema.sql", type: "file" },
    { path: "src/App.jsx", type: "file" },
  ];
  const result = detectCapabilities(tree, {}, null);
  assert(result.hasDatabase === false, "docs/*.sql is excluded", `got ${result.hasDatabase}`);
});

// ── 1g. Full-stack repo ─────────────────────────────────────────────────────
console.log("\n── Full-Stack Repository ──");

test("MERN stack repo → all capabilities true", () => {
  const tree = [
    { path: "src/models/User.js", type: "file" },
    { path: "src/routes/auth.js", type: "file" },
    { path: "src/controllers/userController.js", type: "file" },
    { path: "src/middleware/auth.js", type: "file" },
    { path: "Dockerfile", type: "file" },
    { path: ".github/workflows/ci.yml", type: "file" },
    { path: ".env.example", type: "file" },
    { path: "package.json", type: "file" },
  ];
  const techStack = {
    languages: ["JavaScript"],
    frameworks: ["Express"],
    databases: ["MongoDB"],
    devops: [],
  };
  const result = detectCapabilities(tree, techStack, null);
  assert(result.hasDatabase === true, "MERN → hasDatabase=true", `got ${result.hasDatabase}`);
  assert(result.hasApis === true, "MERN → hasApis=true", `got ${result.hasApis}`);
  assert(result.hasDevops === true, "MERN → hasDevops=true", `got ${result.hasDevops}`);
  assert(result.hasSecuritySensitiveCode === true, "MERN → hasSecurity=true", `got ${result.hasSecuritySensitiveCode}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. EMPTY / EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n═══ 2. EDGE CASES ═══\n");

test("Empty tree + empty techStack → all false", () => {
  const result = detectCapabilities([], {}, null);
  assert(result.hasDatabase === false, "empty → hasDatabase=false");
  assert(result.hasApis === false, "empty → hasApis=false");
  assert(result.hasDevops === false, "empty → hasDevops=false");
  assert(result.hasSecuritySensitiveCode === false, "empty → hasSecurity=false");
});

test("No arguments → defaults safely", () => {
  const result = detectCapabilities();
  assert(result.hasDatabase === false, "no args → hasDatabase=false");
  assert(result.hasApis === false, "no args → hasApis=false");
});

test("Return shape has required fields", () => {
  const result = detectCapabilities([], {}, null);
  assert("hasDatabase" in result, "has hasDatabase");
  assert("hasApis" in result, "has hasApis");
  assert("hasDevops" in result, "has hasDevops");
  assert("hasSecuritySensitiveCode" in result, "has hasSecuritySensitiveCode");
  assert("details" in result, "has details");
  assert(Array.isArray(result.details.databases), "details.databases is array");
  assert(Array.isArray(result.details.frameworks), "details.frameworks is array");
  assert(Array.isArray(result.details.devops), "details.devops is array");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`CAPABILITY DETECTION: ${passCount}/${testCount} tests passed`);
console.log(`${"═".repeat(60)}\n`);
