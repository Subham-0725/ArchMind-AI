// server/test-rie-pipeline.js
import assert from "assert";
import { executeRiePipeline } from "./src/rie/pipeline/analysisPipeline.js";

console.log("==================================================");
console.log("Running Unified RIE Pipeline Integration Test Suite");
console.log("==================================================");

let passed = 0;

async function it(desc, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function runTests() {
  // Test 1: Full Pipeline on MERN Stack Codebase with Secrets
  await it("Executes complete unified RIE pipeline and produces validated blueprint", async () => {
    const mockTree = [
      {
        path: "package.json",
        type: "file",
        size: 500,
        content: JSON.stringify({
          name: "e-commerce-api",
          dependencies: {
            express: "^4.18.2",
            mongoose: "^7.0.0",
            dotenv: "^16.0.0",
          },
        }),
      },
      {
        path: "src/server.js",
        type: "file",
        size: 800,
        content: `
          const express = require('express');
          const mongoose = require('mongoose');
          const app = express();
          const port = 3000;

          // Leaked GitHub token in code
          const GITHUB_TOKEN = "ghp_1234567890ABCDEFGHIJKLMNOPQRSTUV1234";

          app.get('/api/products', (req, res) => res.json([]));
          app.post('/api/products', (req, res) => res.json({ created: true }));

          app.listen(port, () => console.log('Listening on ' + port));
        `,
      },
      {
        path: "src/models/Product.js",
        type: "file",
        size: 600,
        content: `
          const mongoose = require('mongoose');
          const productSchema = new mongoose.Schema({
            title: { type: String, required: true },
            price: { type: Number, required: true },
            category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
          });
          module.exports = mongoose.model('Product', productSchema);
        `,
      },
      {
        path: "src/models/Category.js",
        type: "file",
        size: 400,
        content: `
          const mongoose = require('mongoose');
          const categorySchema = new mongoose.Schema({
            name: { type: String, required: true, unique: true }
          });
          module.exports = mongoose.model('Category', categorySchema);
        `,
      },
      {
        path: "Dockerfile",
        type: "file",
        size: 200,
        content: "FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD [\"node\", \"src/server.js\"]",
      },
    ];

    const result = await executeRiePipeline({
      name: "E-Commerce API",
      source: "github",
      userId: "user_test_123",
      tree: mockTree,
      stats: { totalFiles: 5, totalDirs: 2, totalBytes: 2500, topExtensions: [{ extension: ".js", count: 3 }] },
      sourceFingerprint: "sha_mock_fingerprint_abc123",
      analysisVersion: 1,
      extraMetadata: { repositoryUrl: "https://github.com/test/e-commerce-api", branch: "main" },
    });

    // 1. Secret Scanning Verification
    assert.strictEqual(result.securityFindings.length, 1);
    assert.strictEqual(result.securityFindings[0].category, "GitHub Personal Access Token");
    assert.strictEqual(result.securityFindings[0].filePath, "src/server.js");
    assert.ok(!result.securityFindings[0].maskedValue.includes("ABCDEFGHIJK"));

    // 2. Language & Framework Detection
    assert.strictEqual(result.primaryLanguage, "JavaScript");
    assert.ok(result.techStack.frameworks.includes("Express"));

    // 3. Capability Matrix Detection
    assert.strictEqual(result.capabilities.hasDatabase, true);
    assert.strictEqual(result.capabilities.hasApis, true);
    assert.strictEqual(result.capabilities.hasDevops, true);

    // 4. AST Extraction
    assert.strictEqual(result.ast.summary.totalFilesParsed >= 3, true);
    assert.ok(result.ast.routes.some((r) => r.path === "/api/products"));
    assert.ok(result.ast.models.some((m) => m.name === "Product"));

    // 5. Database Schema Extraction
    assert.strictEqual(result.database.type, "MongoDB");
    assert.strictEqual(result.database.entities.length, 2);
    const entityNames = result.database.entities.map((e) => e.name);
    assert.ok(entityNames.includes("Product"));
    assert.ok(entityNames.includes("Category"));

    // 6. Validated Blueprint Verification
    assert.strictEqual(result.blueprint.version, 1);
    assert.strictEqual(result.blueprint.metadata.name, "E-Commerce API");
    assert.strictEqual(result.blueprint.metadata.commitSha, "sha_mock_fingerprint_abc123");
    assert.strictEqual(result.blueprint.api.routes.length >= 2, true);
    assert.strictEqual(result.blueprint.security.totalFindings, 1);

    // 7. Versioning & Fingerprint
    assert.strictEqual(result.sourceFingerprint, "sha_mock_fingerprint_abc123");
    assert.strictEqual(result.analysisVersion, 1);
    assert.ok(result.lastAnalyzedAt instanceof Date);
  });

  // Test 2: Pipeline on Python Django/FastAPI repository
  await it("Executes pipeline on Python repository and parses models and routes", async () => {
    const mockTree = [
      {
        path: "requirements.txt",
        type: "file",
        size: 100,
        content: "fastapi==0.100.0\nuvicorn==0.22.0\nsqlalchemy==2.0.0\n",
      },
      {
        path: "main.py",
        type: "file",
        size: 400,
        content: `
from fastapi import FastAPI
app = FastAPI()

@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id}
        `,
      },
      {
        path: "models.py",
        type: "file",
        size: 500,
        content: `
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    title = Column(String)
        `,
      },
    ];

    const result = await executeRiePipeline({
      name: "FastAPI App",
      source: "zip",
      userId: "user_test_456",
      tree: mockTree,
      stats: { totalFiles: 3, totalDirs: 1, totalBytes: 1000, topExtensions: [{ extension: ".py", count: 2 }] },
      sourceFingerprint: "zip_hash_fastapi_999",
      analysisVersion: 2,
    });

    assert.strictEqual(result.primaryLanguage, "Python");
    assert.strictEqual(result.capabilities.hasApis, true);
    assert.strictEqual(result.capabilities.hasDatabase, true);
    assert.strictEqual(result.blueprint.version, 1);
    assert.strictEqual(result.analysisVersion, 2);
  });

  console.log("==================================================");
  console.log(`Test Results: ${passed} PASSED, 0 FAILED`);
  console.log("==================================================");
}

runTests();

