// server/test-ast-parser.js
//
// Comprehensive unit & integration test suite for Tree-sitter AST Parsing (Feature 12)

import { parseFile, parseRepository } from "./src/rie/astParser.js";

async function runTests() {
  console.log("=========================================");
  console.log("Running Feature 12 AST Parser Test Suite");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. JavaScript Parsing Test
  console.log("--- 1. JavaScript Parsing Test ---");
  const jsCode = `
    import express from 'express';
    import { UserService } from './services/UserService.js';
    import mongoose from 'mongoose';

    const app = express();

    export async function getUser(req, res) {
      const user = await UserService.findById(req.params.id);
      res.json(user);
    }

    app.get('/api/users/:id', getUser);

    export default app;
  `;

  const jsAst = parseFile("src/controllers/userController.js", jsCode);
  assert(jsAst.language === "javascript", "Detected JS language");
  assert(jsAst.imports.length >= 3, `Extracted ${jsAst.imports.length} JS imports`);
  assert(jsAst.imports.some((i) => i.source === "express" && !i.isInternal), "Identified external import 'express'");
  assert(jsAst.imports.some((i) => i.source === "./services/UserService.js" && i.isInternal), "Identified internal import './services/UserService.js'");
  assert(jsAst.functions.some((f) => f.name === "getUser" && f.isAsync), "Extracted async function 'getUser'");
  assert(jsAst.routes.some((r) => r.method === "GET" && r.path === "/api/users/:id"), "Extracted Express route GET /api/users/:id");
  assert(jsAst.exports.some((e) => e.isDefault), "Extracted default export");

  // 2. TypeScript Class & Models Test
  console.log("\n--- 2. TypeScript Class & Models Test ---");
  const tsCode = `
    import { Schema, model } from 'mongoose';
    import { BaseEntity } from '../core/BaseEntity';

    export interface IUser {
      id: string;
      name: string;
    }

    export class UserModel extends BaseEntity {
      async saveUser(): Promise<void> {
        console.log('saving user');
      }
    }

    const UserSchema = new Schema({ name: String });
    export const User = mongoose.model('User', UserSchema);
  `;

  const tsAst = parseFile("src/models/User.ts", tsCode);
  assert(tsAst.language === "typescript", "Detected TS language");
  assert(tsAst.classes.some((c) => c.name === "UserModel" && c.superClass === "BaseEntity"), "Extracted TS class extending BaseEntity");
  assert(tsAst.classes[0]?.methods.includes("saveUser"), "Extracted method 'saveUser' from class");
  assert(tsAst.models.some((m) => m.name === "User" && m.framework === "mongoose"), "Extracted Mongoose model 'User'");

  // 3. Python FastAPI & Models Test
  console.log("\n--- 3. Python FastAPI & Models Test ---");
  const pyCode = `
import os
from fastapi import FastAPI, Depends
from app.models import User
from sqlalchemy.orm import Session

app = FastAPI()

class UserResponse(BaseModel):
    id: int
    username: str

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}

class DBUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
  `;

  const pyAst = parseFile("app/main.py", pyCode);
  assert(pyAst.language === "python", "Detected Python language");
  assert(pyAst.imports.some((i) => i.source === "os" && !i.isInternal), "Extracted external Python import 'os'");
  assert(pyAst.imports.some((i) => i.source === "app.models" && i.isInternal), "Extracted internal Python import 'app.models'");
  assert(pyAst.routes.some((r) => r.method === "GET" && r.path === "/items/{item_id}"), "Extracted FastAPI route GET /items/{item_id}");
  assert(pyAst.classes.some((c) => c.name === "DBUser" && c.superClass === "Base"), "Extracted Python class DBUser");
  assert(pyAst.models.some((m) => m.name === "DBUser"), "Extracted ORM model DBUser");
  assert(pyAst.entryPoints.some((e) => e.type === "python-app"), "Identified main.py as Python entry point");

  // 4. Repository Aggregator & Error Isolation Test
  console.log("\n--- 4. Repository Aggregator & Error Isolation Test ---");
  const repoFiles = [
    { path: "src/index.js", content: "import express from 'express'; const app = express(); app.listen(3000);" },
    { path: "src/utils.js", content: "export function add(a, b) { return a + b; }" },
    { path: "src/bad.js", content: "function badSyntax ( {{ { ;;" }, // Malformed JS - Tree sitter parses defensively
    { path: "node_modules/express/index.js", content: "module.exports = {};" }, // Should be skipped
    { path: "docs/readme.txt", content: "This is documentation" }, // Should be skipped
    { path: "scripts/run.py", content: "import os\ndef run():\n    pass\n" },
  ];

  const repoAst = await parseRepository(repoFiles);

  assert(repoAst.summary.totalFilesParsed === 4, `Parsed ${repoAst.summary.totalFilesParsed} files (index.js, utils.js, bad.js, run.py)`);
  assert(repoAst.summary.totalFilesSkipped >= 2, `Skipped ${repoAst.summary.totalFilesSkipped} noise/unsupported files`);
  assert(repoAst.dependencies.external.some((d) => d.package === "express"), "Dependencies aggregated external package 'express'");
  assert(repoAst.entryPoints.some((e) => e.file === "src/index.js"), "Aggregated entry point 'src/index.js'");

  console.log("\n=========================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
