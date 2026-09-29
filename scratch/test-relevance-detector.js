// scratch/test-relevance-detector.js
import { detectCapabilities } from "../server/src/rie/relevanceDetector.js";

console.log("==========================================================");
console.log(" ArchMind AI — Smart Relevance Detector Unit & Integration");
console.log("==========================================================");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ PASSED: ${msg}`);
    passed++;
  } else {
    console.error(`  ✕ FAILED: ${msg}`);
    failed++;
  }
}

// ── 1. TEST DATABASE DETECTION ───────────────────────────────────────────────
console.log("\n[1] Testing Database & ERD Detection");

const dbTree = [
  { path: "server/src/models/User.js", type: "file" },
  { path: "prisma/schema.prisma", type: "file" },
];
const dbTechStack = { languages: ["JavaScript"], frameworks: ["Express"], databases: ["MongoDB"], devops: [] };
const resDb = detectCapabilities(dbTree, dbTechStack, null);

assert(resDb.hasDatabase === true, "hasDatabase is true when MongoDB & models/ exist");
assert(resDb.details.databases.includes("MongoDB"), "details.databases includes MongoDB");

// ── 2. TEST API & REQUEST FLOW DETECTION ─────────────────────────────────────
console.log("\n[2] Testing API & Request Flow Detection");

const apiTree = [
  { path: "routes/auth.js", type: "file" },
  { path: "controllers/userController.js", type: "file" },
];
const apiTechStack = { languages: ["JavaScript"], frameworks: ["Express.js"], databases: [], devops: [] };
const resApi = detectCapabilities(apiTree, apiTechStack, null);

assert(resApi.hasApis === true, "hasApis is true when routes/ and Express are present");

// ── 3. TEST DEVOPS & INFRASTRUCTURE DETECTION ────────────────────────────────
console.log("\n[3] Testing DevOps & Infrastructure Detection");

const devopsTree = [
  { path: "Dockerfile", type: "file" },
  { path: ".github/workflows/ci.yml", type: "file" },
];
const devopsTechStack = { languages: ["TypeScript"], frameworks: [], databases: [], devops: ["Docker", "GitHub Actions"] };
const resDevops = detectCapabilities(devopsTree, devopsTechStack, null);

assert(resDevops.hasDevops === true, "hasDevops is true when Dockerfile and workflows exist");
assert(resDevops.details.devops.includes("Docker"), "details.devops includes Docker");

// ── 4. TEST SECURITY RELEVANCE DETECTION ──────────────────────────────────────
console.log("\n[4] Testing Security-Sensitive Code Detection");

const secTree = [
  { path: "middleware/authMiddleware.js", type: "file" },
  { path: ".env.example", type: "file" },
];
const secTechStack = { languages: ["JavaScript"], frameworks: ["Express"], databases: [], devops: [] };
const resSec = detectCapabilities(secTree, secTechStack, null);

assert(resSec.hasSecuritySensitiveCode === true, "hasSecuritySensitiveCode is true for auth middleware & APIs");

// ── 5. TEST FALSE POSITIVE PREVENTION ────────────────────────────────────────
console.log("\n[5] Testing False Positive Defense");

const docTree = [
  { path: "documentation/guide.md", type: "file" },
  { path: "docs/architecture.md", type: "file" },
  { path: "src/utils/math.js", type: "file" },
];
const docTechStack = { languages: ["JavaScript"], frameworks: [], databases: [], devops: [] };
const resDoc = detectCapabilities(docTree, docTechStack, null);

assert(resDoc.hasDatabase === false, "documentation/ directory does NOT trigger hasDatabase");
assert(resDoc.hasDevops === false, "Documentation does NOT trigger hasDevops");
assert(resDoc.hasApis === false, "Documentation does NOT trigger hasApis");

// ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
console.log("\n==========================================================");
console.log(` SUMMARY: ${passed} Passed | ${failed} Failed`);
console.log("==========================================================");

if (failed > 0) process.exit(1);
else console.log("✅ ALL SMART RELEVANCE DETECTOR TESTS PASSED!");
