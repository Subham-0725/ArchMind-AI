// scratch/test-full-integration.js
import { buildTopology } from "../server/src/rie/topologyBuilder.js";
import { detectProjectLanguage } from "../server/src/services/languageDetector.js";

console.log("==========================================================");
console.log(" ArchMind AI — Project Workspace Full Integration Suite   ");
console.log("==========================================================");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASSED: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✕ FAILED: ${message}`);
    testsFailed++;
  }
}

// ── 1. TEST TOPOLOGY ACCURACY & FABRICATION DEFENSE ─────────────────────────
console.log("\n[TEST SECTION 1] Topology Accuracy & Fabrication Defense");

// Test 1A: Frontend-only project must NOT generate Backend or DB nodes
const frontendOnly = {
  name: "Frontend Only Site",
  primaryLanguage: "JavaScript",
  secondaryLanguages: [],
  techStack: { languages: ["JavaScript"], frameworks: ["React", "Vite"], databases: [], devops: [] },
  tree: [{ path: "src/App.jsx", type: "file", size: 500 }],
};
const topo1A = buildTopology(frontendOnly);
assert(topo1A.nodes.length === 1, "Frontend-only produces exactly 1 node");
assert(topo1A.nodes[0].id === "frontend", "Node is 'frontend'");
assert(!topo1A.nodes.some(n => n.id === "backend"), "No fabricated backend node");
assert(!topo1A.nodes.some(n => n.id === "database"), "No fabricated database node");

// Test 1B: Backend-only project must NOT generate Frontend or DB nodes
const backendOnly = {
  name: "Express Backend API",
  primaryLanguage: "JavaScript",
  secondaryLanguages: [],
  techStack: { languages: ["JavaScript"], frameworks: ["Express"], databases: [], devops: [] },
  tree: [{ path: "app.js", type: "file", size: 500 }],
};
const topo1B = buildTopology(backendOnly);
assert(topo1B.nodes.length === 1, "Backend-only produces exactly 1 node");
assert(topo1B.nodes[0].id === "backend", "Node is 'backend'");
assert(!topo1B.nodes.some(n => n.id === "frontend"), "No fabricated frontend node");
assert(!topo1B.nodes.some(n => n.id === "database"), "No fabricated database node");

// Test 1C: FullStack project produces connected graph
const fullStack = {
  name: "Fullstack App",
  primaryLanguage: "TypeScript",
  secondaryLanguages: ["JavaScript"],
  techStack: { languages: ["TypeScript", "JavaScript"], frameworks: ["React", "Express.js"], databases: ["MongoDB"], devops: ["Docker"] },
  tree: [{ path: "src/App.tsx", type: "file", size: 500 }],
};
const topo1C = buildTopology(fullStack);
assert(topo1C.nodes.length === 4, "Fullstack produces 4 nodes (DevOps, Frontend, Backend, Database)");
assert(topo1C.edges.length === 3, "Fullstack produces 3 edges connecting the tiers");

// ── 2. TEST CAPABILITIES DERIVATION LOGIC ────────────────────────────────────
console.log("\n[TEST SECTION 2] Workspace Capabilities Logic");

const calcCapabilities = (techStack, topology) => {
  const hasDb = (techStack.databases?.length || 0) > 0 || (topology.nodes || []).some(n => n.data?.tier === "Database");
  const hasDevops = (techStack.devops?.length || 0) > 0 || (topology.nodes || []).some(n => n.data?.tier === "DevOps");
  return {
    architecture: true,
    erd: hasDb,
    securityAudit: false,
    devops: hasDevops,
  };
};

const capFrontend = calcCapabilities(frontendOnly.techStack, topo1A);
assert(capFrontend.architecture === true, "Architecture tab enabled for Frontend");
assert(capFrontend.erd === false, "ERD disabled for Frontend-only project");
assert(capFrontend.devops === false, "DevOps disabled when no Docker/CI");

const capFull = calcCapabilities(fullStack.techStack, topo1C);
assert(capFull.erd === true, "ERD enabled when database detected");
assert(capFull.devops === true, "DevOps enabled when Docker/CI detected");

// ── 3. TEST LANGUAGE DETECTOR & EDGE CASES ───────────────────────────────────
console.log("\n[TEST SECTION 3] Language Detection & Non-Code Edge Cases");

const docsOnlyTree = [
  { path: "README.md", type: "file", size: 1000 },
  { path: "docs/guide.md", type: "file", size: 2000 },
];
const langDocs = detectProjectLanguage(docsOnlyTree, null);
assert(langDocs.primaryLanguage === null, "Docs-only repo has null primaryLanguage");
assert(langDocs.confidence === 0, "Docs-only repo has 0 confidence rating");

const tsTree = [
  { path: "package.json", type: "file", size: 400 },
  { path: "tsconfig.json", type: "file", size: 200 },
  { path: "src/main.ts", type: "file", size: 800 },
];
const langTs = detectProjectLanguage(tsTree, null);
assert(langTs.primaryLanguage === "TypeScript", "TypeScript detected with package.json + tsconfig.json");
assert(langTs.confidence >= 0.85, "TypeScript confidence >= 0.85");

// ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
console.log("\n==========================================================");
console.log(` SUMMARY: ${testsPassed} Passed | ${testsFailed} Failed`);
console.log("==========================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log("✅ ALL INTEGRATION CHECKS PASSED PERFECTLY!");
}
