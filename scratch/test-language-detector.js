// scratch/test-language-detector.js
import { detectProjectLanguage } from "../server/src/services/languageDetector.js";

console.log("=== Testing Feature 08: Language & Framework Detection ===");

// 1. Single Primary Language (JavaScript / React project)
const jsReactTree = [
  { path: "package.json", type: "file", size: 450 },
  { path: "src/App.jsx", type: "file", size: 1200 },
  { path: "src/index.js", type: "file", size: 600 },
  { path: "src/components/Header.jsx", type: "file", size: 850 },
  { path: "public/index.html", type: "file", size: 500 },
  { path: "README.md", type: "file", size: 1000 },
];
const result1 = detectProjectLanguage(jsReactTree, null);
console.log("\n1. JS/React Tree Result:", JSON.stringify(result1, null, 2));

// 2. TypeScript / Next.js Project
const tsNextTree = [
  { path: "package.json", type: "file", size: 500 },
  { path: "tsconfig.json", type: "file", size: 300 },
  { path: "pages/index.tsx", type: "file", size: 1500 },
  { path: "pages/api/hello.ts", type: "file", size: 400 },
  { path: "styles/globals.css", type: "file", size: 800 },
];
const result2 = detectProjectLanguage(tsNextTree, null);
console.log("\n2. TS/Next Tree Result:", JSON.stringify(result2, null, 2));

// 3. Polyglot Project (Python + TypeScript)
const polyglotTree = [
  { path: "requirements.txt", type: "file", size: 120 },
  { path: "main.py", type: "file", size: 3000 },
  { path: "utils.py", type: "file", size: 2500 },
  { path: "models/db.py", type: "file", size: 4000 },
  { path: "frontend/package.json", type: "file", size: 400 },
  { path: "frontend/tsconfig.json", type: "file", size: 200 },
  { path: "frontend/src/App.tsx", type: "file", size: 1800 },
  { path: "frontend/src/index.tsx", type: "file", size: 900 },
];
const result3 = detectProjectLanguage(polyglotTree, null);
console.log("\n3. Polyglot Tree Result:", JSON.stringify(result3, null, 2));

// 4. Docs-only project
const docsOnlyTree = [
  { path: "README.md", type: "file", size: 1500 },
  { path: "docs/architecture.md", type: "file", size: 4500 },
  { path: "LICENSE", type: "file", size: 1100 },
];
const result4 = detectProjectLanguage(docsOnlyTree, null);
console.log("\n4. Docs-only Tree Result:", JSON.stringify(result4, null, 2));

// Assertions
if (result1.primaryLanguage !== "JavaScript") throw new Error("Test 1 failed: Expected JavaScript");
if (result2.primaryLanguage !== "TypeScript") throw new Error("Test 2 failed: Expected TypeScript");
if (!result3.primaryLanguage || result3.secondaryLanguages.length === 0) throw new Error("Test 3 failed: Expected polyglot secondary language");
if (result4.primaryLanguage !== null || result4.confidence !== 0) throw new Error("Test 4 failed: Expected null primary and 0 confidence for docs-only");

console.log("\n✅ ALL LANGUAGE DETECTOR TESTS PASSED SUCCESSFULLY!");
