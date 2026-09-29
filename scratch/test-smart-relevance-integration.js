// scratch/test-smart-relevance-integration.js
import { detectCapabilities } from "../server/src/rie/relevanceDetector.js";
import { WORKSPACE_TABS, isTabEnabled, getTabDetails } from "../client/src/constants/workspaceTabs.js";

console.log("=================================================================");
console.log(" ArchMind AI — Smart Relevance Detection Full Integration Suite");
console.log("=================================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAILED: ${message}`);
    failedCount++;
  }
}

// ── 1. RIE PIPELINE TEST ───────────────────────────────────────────────────────
console.log("[1] Testing RIE Relevance Detection Pipeline Flow");
const mockTree = [
  { path: "src/server.js", type: "file" },
  { path: "src/models/User.js", type: "file" },
  { path: "src/routes/api.js", type: "file" },
  { path: "Dockerfile", type: "file" },
];
const mockTech = {
  languages: ["JavaScript"],
  frameworks: ["Express.js"],
  databases: ["MongoDB"],
  devops: ["Docker"],
};

const capabilities = detectCapabilities(mockTree, mockTech, null);

assert(capabilities.hasDatabase === true, "hasDatabase populated in pipeline output");
assert(capabilities.hasApis === true, "hasApis populated in pipeline output");
assert(capabilities.hasDevops === true, "hasDevops populated in pipeline output");
assert(capabilities.hasSecuritySensitiveCode === true, "hasSecuritySensitiveCode populated in pipeline output");
assert(Array.isArray(capabilities.details.databases), "details.databases is array");

// ── 2. DATABASE RELEVANCE TEST ────────────────────────────────────────────────
console.log("\n[2] Testing Database Signals (Mongoose, Prisma, Models, SQL)");

const testDbMongoose = detectCapabilities([], { databases: ["MongoDB"] });
assert(testDbMongoose.hasDatabase === true, "Database detected via techStack (MongoDB)");

const testDbPrisma = detectCapabilities([{ path: "prisma/schema.prisma" }], {});
assert(testDbPrisma.hasDatabase === true, "Database detected via prisma/schema.prisma");

const testDbModels = detectCapabilities([{ path: "src/models/User.js" }], {});
assert(testDbModels.hasDatabase === true, "Database detected via models/ directory");

const testDbSql = detectCapabilities([{ path: "db/migrations/001_init.sql" }], {});
assert(testDbSql.hasDatabase === true, "Database detected via .sql migration files");

// ── 3. NO DATABASE TEST ───────────────────────────────────────────────────────
console.log("\n[3] Testing Frontend-Only Repo (No Database)");
const frontendTree = [
  { path: "src/App.jsx" },
  { path: "src/components/Header.jsx" },
  { path: "src/index.css" },
  { path: "package.json" },
];
const noDbCaps = detectCapabilities(frontendTree, { languages: ["JavaScript"], frameworks: ["React"] });
assert(noDbCaps.hasDatabase === false, "hasDatabase is false for frontend-only repo");

// ── 4. API TEST ───────────────────────────────────────────────────────────────
console.log("\n[4] Testing API Signals (Express, routes/, controllers/)");
const apiTree = [{ path: "routes/user.js" }, { path: "controllers/userController.js" }];
const apiCaps = detectCapabilities(apiTree, { frameworks: ["Express.js"] });
assert(apiCaps.hasApis === true, "hasApis is true for Express + routes/controllers");

// ── 5. NO API TEST ────────────────────────────────────────────────────────────
console.log("\n[5] Testing Static Website (No API Routes/Frameworks)");
const staticSiteTree = [{ path: "index.html" }, { path: "styles.css" }, { path: "main.js" }];
const noApiCaps = detectCapabilities(staticSiteTree, { languages: ["HTML", "CSS", "JavaScript"] });
assert(noApiCaps.hasApis === false, "hasApis is false for static website");

// ── 6. DEVOPS TEST ────────────────────────────────────────────────────────────
console.log("\n[6] Testing DevOps Signals (Dockerfile, Workflows, K8s, Helm, Terraform)");
const devopsTree = [
  { path: "Dockerfile" },
  { path: ".github/workflows/ci.yml" },
  { path: "k8s/deployment.yaml" },
];
const devopsCaps = detectCapabilities(devopsTree, {});
assert(devopsCaps.hasDevops === true, "hasDevops is true for Dockerfile + workflows + k8s");
assert(devopsCaps.details.devops.includes("Docker"), "details.devops contains Docker");
assert(devopsCaps.details.devops.includes("GitHub Actions"), "details.devops contains GitHub Actions");
assert(devopsCaps.details.devops.includes("Kubernetes"), "details.devops contains Kubernetes");

// ── 7. SECURITY TEST ──────────────────────────────────────────────────────────
console.log("\n[7] Testing Security Signals (Auth Middleware, ENV, JWT)");
const secTree = [{ path: "src/middleware/auth.js" }, { path: ".env.example" }];
const secCaps = detectCapabilities(secTree, { frameworks: ["Express"] });
assert(secCaps.hasSecuritySensitiveCode === true, "hasSecuritySensitiveCode is true for auth middleware");

// ── 8. COMBINATION TEST ───────────────────────────────────────────────────────
console.log("\n[8] Testing Full-Stack Project (All Capabilities Active)");
const fullStackTree = [
  { path: "src/App.jsx" },
  { path: "src/models/User.js" },
  { path: "src/routes/api.js" },
  { path: "src/middleware/auth.js" },
  { path: "Dockerfile" },
];
const fullStackTech = {
  languages: ["JavaScript"],
  frameworks: ["React", "Express.js"],
  databases: ["MongoDB"],
  devops: ["Docker"],
};
const fullCaps = detectCapabilities(fullStackTree, fullStackTech);
assert(fullCaps.hasDatabase === true, "Fullstack hasDatabase is true");
assert(fullCaps.hasApis === true, "Fullstack hasApis is true");
assert(fullCaps.hasDevops === true, "Fullstack hasDevops is true");
assert(fullCaps.hasSecuritySensitiveCode === true, "Fullstack hasSecuritySensitiveCode is true");

// ── 9. FALSE-POSITIVE TEST ────────────────────────────────────────────────────
console.log("\n[9] Testing False-Positive Defense (Documentation & Notes Only)");
const docOnlyTree = [
  { path: "docs/models/architecture-guide.md" },
  { path: "documentation/api/routes-explanation.txt" },
  { path: "docs/docker/setup-notes.md" },
  { path: "docs/security/auth-policy.pdf" },
];
const docCaps = detectCapabilities(docOnlyTree, {});
assert(docCaps.hasDatabase === false, "Documentation does NOT trigger hasDatabase");
assert(docCaps.hasApis === false, "Documentation does NOT trigger hasApis");
assert(docCaps.hasDevops === false, "Documentation does NOT trigger hasDevops");
assert(docCaps.hasSecuritySensitiveCode === false, "Documentation does NOT trigger hasSecuritySensitiveCode");

// ── 10. BACKWARD COMPATIBILITY TEST ───────────────────────────────────────────
console.log("\n[10] Testing Existing Project Compatibility (Missing Capabilities)");
const legacyProject = { capabilities: null };
const topologyTab = WORKSPACE_TABS.find((t) => t.id === "topology");
const erdTab = WORKSPACE_TABS.find((t) => t.id === "erd");

assert(isTabEnabled(topologyTab, legacyProject.capabilities) === true, "Topology tab is always enabled even if capabilities missing");
assert(isTabEnabled(erdTab, legacyProject.capabilities) === false, "ERD tab gracefully defaults to disabled when capabilities missing");

// ── 11. FRONTEND TAB MATRIX VALIDATION ────────────────────────────────────────
console.log("\n[11] Testing Frontend Tab Matrix Configuration");
const sampleCaps = {
  hasDatabase: true,
  hasApis: true,
  hasDevops: false,
  hasSecuritySensitiveCode: true,
};

const apisTab = WORKSPACE_TABS.find((t) => t.id === "apis");
const devopsTab = WORKSPACE_TABS.find((t) => t.id === "devops");
const secTab = WORKSPACE_TABS.find((t) => t.id === "security");

assert(isTabEnabled(erdTab, sampleCaps) === true, "ERD tab enabled for hasDatabase = true");
assert(isTabEnabled(apisTab, sampleCaps) === true, "API tab enabled for hasApis = true");
assert(isTabEnabled(devopsTab, sampleCaps) === false, "DevOps tab disabled for hasDevops = false");
assert(isTabEnabled(secTab, sampleCaps) === true, "Security tab enabled for hasSecuritySensitiveCode = true");

// ── 12. PERFORMANCE INVARIANT TEST ────────────────────────────────────────────
console.log("\n[12] Testing Performance Invariant (Lightweight Heuristic Execution)");
const startTime = performance.now();
for (let i = 0; i < 1000; i++) {
  detectCapabilities(fullStackTree, fullStackTech);
}
const elapsedMs = performance.now() - startTime;
console.log(`  ℹ 1,000 relevance detection cycles completed in ${elapsedMs.toFixed(2)} ms (${(elapsedMs / 1000).toFixed(4)} ms/op)`);
assert(elapsedMs < 100, "1,000 detection operations execute in < 100ms (deterministic invariant)");

// ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
console.log("\n=================================================================");
console.log(` SUMMARY: ${passedCount} Passed | ${failedCount} Failed`);
console.log("=================================================================");

if (failedCount > 0) {
  console.error("❌ INTEGRATION TESTS FAILED!");
  process.exit(1);
} else {
  console.log("✅ ALL SMART RELEVANCE DETECTION INTEGRATION TESTS PASSED!");
}
