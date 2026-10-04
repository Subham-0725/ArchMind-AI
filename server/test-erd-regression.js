// server/test-erd-regression.js
//
// Regression test suite for ERD Generation & Database Schema Extraction
// Verifies that projects containing Mongoose model files (e.g., Document, Resume, ResumeContent, Template, User)
// produce EXACT model names and fields, and NEVER generic placeholders (Entity2..Entity5, table_2..table_5).

import { extractDatabaseSchema } from "./src/rie/dbSchemaExtractor.js";
import { generateERD, mockERD, parseAndValidateJson } from "./src/services/llmService.js";

async function runRegressionSuite() {
  console.log("==========================================================");
  console.log("ERD Model Extraction & Regression Test Suite");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const dbCapabilities = {
    hasDatabase: true,
    details: { databases: ["MongoDB"] },
  };

  // ─────────────────────────────────────────────────────────
  // TEST A: Five Mongoose Models (Document, Resume, ResumeContent, Template, User)
  // ─────────────────────────────────────────────────────────
  console.log("--- Test A: Real 5-Model Project Extraction ---");

  const documentCode = `
import mongoose from 'mongoose';

// Document schema definition
const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: Object,
  },
}, { timestamps: true });

export default mongoose.model('Document', documentSchema);
`;

  const resumeCode = `
const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
  },
  status: {
    type: String,
    default: 'draft',
  },
}, { timestamps: true });

module.exports = mongoose.model('Resume', resumeSchema);
`;

  const resumeContentCode = `
import mongoose from 'mongoose';

const resumeContentSchema = new mongoose.Schema({
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true,
  },
  personalInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
  },
  summary: String,
  experience: [
    {
      company: String,
      position: String,
      startDate: String,
      endDate: String,
    }
  ],
  skills: [String],
});

export const ResumeContent = mongoose.model('ResumeContent', resumeContentSchema);
`;

  const templateCode = `
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  thumbnail: String,
  category: {
    type: String,
    default: 'professional',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model('Template', templateSchema);
`;

  const userCode = `
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  displayName: String,
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
`;

  const fiveModelFiles = [
    { path: "models/Document.js", type: "file", size: 400, content: documentCode },
    { path: "models/Resume.js", type: "file", size: 500, content: resumeCode },
    { path: "models/ResumeContent.js", type: "file", size: 600, content: resumeContentCode },
    { path: "models/Template.js", type: "file", size: 350, content: templateCode },
    { path: "models/User.js", type: "file", size: 450, content: userCode },
  ];

  const resultA = extractDatabaseSchema(fiveModelFiles, dbCapabilities, { databases: ["MongoDB"] }, null);

  assert(resultA.type === "MongoDB", "Extracts MongoDB type");
  assert(resultA.entities.length === 5, `Extracted exactly 5 entities (got ${resultA.entities.length})`);

  const entityNamesA = resultA.entities.map((e) => e.name).sort();
  assert(
    JSON.stringify(entityNamesA) === JSON.stringify(["Document", "Resume", "ResumeContent", "Template", "User"]),
    `Entity names match source models: [${entityNamesA.join(", ")}]`
  );

  // Check no generic entity names exist anywhere
  const hasGenericNames = resultA.entities.some((e) => /^Entity\d+$/i.test(e.name) || /^table_\d+$/i.test(e.name));
  assert(!hasGenericNames, "Zero generic Entity placeholders in extraction output");

  // Check Document fields
  const docEnt = resultA.entities.find((e) => e.name === "Document");
  assert(docEnt && docEnt.fields.some((f) => f.name === "userId" && f.isForeign), "Document has foreign key userId");
  assert(docEnt && docEnt.fields.some((f) => f.name === "title" && f.isRequired), "Document has required title");

  // Check Resume fields & relationships
  const resumeEnt = resultA.entities.find((e) => e.name === "Resume");
  assert(resumeEnt && resumeEnt.fields.some((f) => f.name === "templateId"), "Resume has templateId field");

  // Check User fields
  const userEnt = resultA.entities.find((e) => e.name === "User");
  assert(userEnt && userEnt.fields.some((f) => f.name === "clerkId" && f.isUnique), "User has unique clerkId");
  assert(userEnt && userEnt.fields.some((f) => f.name === "email"), "User has email field");

  // Check extracted relationships
  assert(resultA.relationships.length >= 2, `Extracted relationships count >= 2 (got ${resultA.relationships.length})`);
  assert(resultA.relationships.some((r) => r.from === "Document" && r.to === "User"), "Detected Document -> User relationship");
  assert(resultA.relationships.some((r) => r.from === "Resume" && r.to === "User"), "Detected Resume -> User relationship");
  assert(resultA.relationships.some((r) => r.from === "Resume" && r.to === "Template"), "Detected Resume -> Template relationship");

  // ─────────────────────────────────────────────────────────
  // TEST B: Model with mongoose.model() inline schema export
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test B: Inline mongoose.model() export ---");

  const inlineModelCode = `
const mongoose = require('mongoose');

module.exports = mongoose.model('Category', {
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: String,
});
`;
  const resultB = extractDatabaseSchema(
    [{ path: "src/models/Category.js", type: "file", size: 300, content: inlineModelCode }],
    dbCapabilities,
    {},
    null
  );
  assert(resultB.entities.length === 1, "Extracted 1 entity from inline model definition");
  assert(resultB.entities[0]?.name === "Category", "Entity name is 'Category'");
  assert(resultB.entities[0]?.fields.some((f) => f.name === "name" && f.isRequired), "Category has required name");
  assert(resultB.entities[0]?.fields.some((f) => f.name === "slug" && f.isUnique), "Category has unique slug");

  // ─────────────────────────────────────────────────────────
  // TEST C: CommonJS export with Schema instance
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test C: CommonJS export with Schema instance ---");

  const cjsCode = `
const { Schema, model } = require('mongoose');

const orderSchema = new Schema({
  orderNumber: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
});

module.exports = model('Order', orderSchema);
`;
  const resultC = extractDatabaseSchema(
    [{ path: "models/Order.js", type: "file", size: 300, content: cjsCode }],
    dbCapabilities,
    {},
    null
  );
  assert(resultC.entities.length === 1, "Extracted 1 entity from CommonJS model");
  assert(resultC.entities[0]?.name === "Order", "Entity name is 'Order'");
  assert(resultC.entities[0]?.fields.some((f) => f.name === "orderNumber"), "Has orderNumber field");

  // ─────────────────────────────────────────────────────────
  // TEST D: ES Module export with Schema instance & generic
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test D: ES Module export with TypeScript generic ---");

  const esmTsCode = `
import mongoose, { Schema } from 'mongoose';

const productSchema = new Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  inStock: { type: Boolean, default: true },
});

export const Product = mongoose.model('Product', productSchema);
export default Product;
`;
  const resultD = extractDatabaseSchema(
    [{ path: "src/models/Product.ts", type: "file", size: 300, content: esmTsCode }],
    dbCapabilities,
    {},
    null
  );
  assert(resultD.entities.length === 1, "Extracted 1 entity from ES Module TypeScript model");
  assert(resultD.entities[0]?.name === "Product", "Entity name is 'Product'");
  assert(resultD.entities[0]?.fields.some((f) => f.name === "price"), "Has price field");

  // ─────────────────────────────────────────────────────────
  // TEST E: Schema fields with references and array types
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test E: Schema with references and array types ---");

  const refCode = `
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  content: { type: String, required: true },
  tags: [String],
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

export default mongoose.model('Comment', commentSchema);
`;
  const resultE = extractDatabaseSchema(
    [{ path: "models/Comment.js", type: "file", size: 400, content: refCode }],
    dbCapabilities,
    {},
    null
  );
  assert(resultE.entities.length === 1, "Extracted 1 entity from reference schema");
  assert(resultE.entities[0]?.name === "Comment", "Entity name is 'Comment'");
  const mentionsField = resultE.entities[0]?.fields.find((f) => f.name === "mentions");
  assert(Boolean(mentionsField), "Found 'mentions' field");
  assert(resultE.relationships.some((r) => r.from === "Comment" && r.to === "User"), "Comment -> User relationship extracted");
  assert(resultE.relationships.some((r) => r.from === "Comment" && r.to === "Post"), "Comment -> Post relationship extracted");

  // ─────────────────────────────────────────────────────────
  // TEST F: Database detected but no models found → Honest empty state
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test F: No models in database repository ---");

  const resultF = extractDatabaseSchema(
    [{ path: "server.js", type: "file", size: 200, content: "console.log('hello');" }],
    { hasDatabase: true, details: { databases: ["PostgreSQL"] } },
    {},
    null
  );
  assert(resultF.entities.length === 0, "Returns empty entities array when no model files exist (no placeholders)");
  assert(resultF.relationships.length === 0, "Returns empty relationships array");

  // ─────────────────────────────────────────────────────────
  // TEST G: Mock ERD Generator with 5-Model Blueprint
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test G: Mock ERD generation with 5 models ---");

  const blueprintWith5 = {
    metadata: { name: "ResumeBuilder", primaryLanguage: "JavaScript" },
    capabilities: { hasDatabase: true, details: { databases: ["MongoDB"] } },
    models: [
      { name: "Document", file: "models/Document.js" },
      { name: "Resume", file: "models/Resume.js" },
      { name: "ResumeContent", file: "models/ResumeContent.js" },
      { name: "Template", file: "models/Template.js" },
      { name: "User", file: "models/User.js" },
    ],
    database: resultA,
  };

  const mockResult = mockERD(blueprintWith5);
  assert(mockResult.entities.length === 5, `Mock ERD produces exactly 5 entities (got ${mockResult.entities.length})`);

  const mockNames = mockResult.entities.map((e) => e.name).sort();
  assert(
    JSON.stringify(mockNames) === JSON.stringify(["Document", "Resume", "ResumeContent", "Template", "User"]),
    `Mock ERD entity names match actual models: [${mockNames.join(", ")}]`
  );

  const mockHasFakeNames = mockResult.entities.some((e) => /^Entity\d+$/i.test(e.name) || /^table_\d+$/i.test(e.name));
  assert(!mockHasFakeNames, "Mock ERD contains ZERO Entity1..Entity5 or table_2..table_5 names");

  // ─────────────────────────────────────────────────────────
  // TEST H: Validation layer removes hallucinated placeholders
  // ─────────────────────────────────────────────────────────
  console.log("\n--- Test H: Validation Layer Rejects Hallucinated Placeholders ---");

  const fakeLlmOutput = JSON.stringify({
    entities: [
      { id: "entity-user", name: "User", tableName: "users", fields: [{ name: "_id", type: "ObjectId" }] },
      { id: "entity-2", name: "Entity2", tableName: "table_2", fields: [] },
      { id: "entity-3", name: "Entity3", tableName: "table_3", fields: [] },
      { id: "entity-4", name: "Entity4", tableName: "table_4", fields: [] },
      { id: "entity-5", name: "Entity5", tableName: "table_5", fields: [] },
    ],
    relationships: [],
  });

  const validated = parseAndValidateJson(fakeLlmOutput, "erd", blueprintWith5);

  const validatedNames = validated.entities.map((e) => e.name);
  const containsEntity2 = validatedNames.some((n) => /^Entity[2-5]$/i.test(n) || /^table_[2-5]$/i.test(n));
  assert(!containsEntity2, "validateErdSchema successfully prevented Entity2..Entity5 from being emitted");

  console.log("\n==========================================================");
  console.log(`Regression Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
