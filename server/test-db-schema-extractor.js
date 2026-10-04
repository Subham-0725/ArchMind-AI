// server/test-db-schema-extractor.js
//
// Unit test suite for Feature 15 — Database Schema Extractor
// Tests: Mongoose, Prisma, SQLAlchemy/Django, SQL CREATE TABLE, and edge cases.

import { extractDatabaseSchema } from "./src/rie/dbSchemaExtractor.js";

async function runTests() {
  console.log("==============================================");
  console.log("Feature 15 — Database Schema Extractor Tests");
  console.log("==============================================\n");

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

  const noDbCapabilities = { hasDatabase: false };
  const dbCapabilities = { hasDatabase: true, details: { databases: ["MongoDB"] } };

  // ─────────────────────────────────────────────
  // 1. No-DB fast path
  // ─────────────────────────────────────────────
  console.log("--- 1. No-Database Fast Path ---");
  const noDb = extractDatabaseSchema([], noDbCapabilities, {}, null);
  assert(noDb.type === "None", "Returns type=None when hasDatabase=false");
  assert(noDb.entities.length === 0, "Returns empty entities when hasDatabase=false");
  assert(noDb.relationships.length === 0, "Returns empty relationships when hasDatabase=false");

  // ─────────────────────────────────────────────
  // 2. Mongoose Schema — Basic
  // ─────────────────────────────────────────────
  console.log("\n--- 2. Mongoose Schema — Basic User Model ---");

  const mongooseUserCode = `
const mongoose = require('mongoose');

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, default: 'user' },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

const User = mongoose.model('User', userSchema);
module.exports = User;
`;

  const mongooseFiles = [
    { path: "src/models/User.js", type: "file", size: 400, content: mongooseUserCode }
  ];

  const mongooseResult = extractDatabaseSchema(mongooseFiles, dbCapabilities, { databases: ["MongoDB"] }, null);
  assert(mongooseResult.type === "MongoDB", "Detected MongoDB type from capabilities");
  assert(mongooseResult.entities.length >= 1, "Extracted at least 1 entity from Mongoose schema");

  const userEntity = mongooseResult.entities.find((e) => e.name === "User");
  assert(Boolean(userEntity), "Extracted 'User' entity by name");
  assert(userEntity && userEntity.fields.some((f) => f.name === "_id" && f.isPrimary), "Has _id as primary key");
  assert(userEntity && userEntity.fields.some((f) => f.name === "email"), "Has 'email' field");
  assert(userEntity && userEntity.fields.some((f) => f.name === "email" && f.isUnique), "email is unique");
  assert(userEntity && userEntity.fields.some((f) => f.name === "email" && f.isRequired), "email is required");
  assert(userEntity && userEntity.fields.some((f) => f.name === "name"), "Has 'name' field");
  assert(userEntity && userEntity.fields.some((f) => f.name === "role"), "Has 'role' field");
  assert(userEntity && userEntity.fields.some((f) => f.name === "isActive"), "Has 'isActive' field");

  // ─────────────────────────────────────────────
  // 3. Mongoose — Foreign Key / Ref Detection
  // ─────────────────────────────────────────────
  console.log("\n--- 3. Mongoose — Foreign Key Reference ---");

  const mongooseProjectCode = `
const projectSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
});

const Project = mongoose.model('Project', projectSchema);
`;

  const projectFiles = [
    { path: "src/models/Project.js", type: "file", size: 300, content: mongooseProjectCode }
  ];

  const projectResult = extractDatabaseSchema(projectFiles, dbCapabilities, { databases: ["MongoDB"] }, null);
  const projectEntity = projectResult.entities.find((e) => e.name === "Project");
  assert(Boolean(projectEntity), "Extracted 'Project' entity");

  const userIdField = projectEntity?.fields.find((f) => f.name === "userId");
  assert(Boolean(userIdField), "Has 'userId' field");
  assert(userIdField && userIdField.isForeign === true, "userId is marked as foreign key");
  assert(userIdField && userIdField.references?.entity === "User", "userId references User entity");

  const tasksField = projectEntity?.fields.find((f) => f.name === "tasks");
  assert(Boolean(tasksField), "Has 'tasks' array field");
  assert(projectResult.relationships.length >= 1, "At least 1 relationship recorded");

  const userRel = projectResult.relationships.find((r) => r.from === "Project" && r.to === "User");
  assert(Boolean(userRel), "Relationship: Project -> User exists");

  // ─────────────────────────────────────────────
  // 4. Prisma Schema
  // ─────────────────────────────────────────────
  console.log("\n--- 4. Prisma Schema Extraction ---");

  const prismaCode = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String?
  authorId  Int
  author    User    @relation(fields: [authorId], references: [id])
  published Boolean @default(false)
}
`;

  const prismaFiles = [
    { path: "prisma/schema.prisma", type: "file", size: 500, content: prismaCode }
  ];

  const prismaResult = extractDatabaseSchema(
    prismaFiles,
    { hasDatabase: true, details: { databases: ["Prisma"] } },
    { databases: ["Prisma"] },
    null
  );

  assert(prismaResult.entities.length >= 2, "Extracted at least 2 Prisma model entities");

  const prismaUser = prismaResult.entities.find((e) => e.name === "User");
  assert(Boolean(prismaUser), "Extracted User model from Prisma");
  assert(prismaUser?.fields.some((f) => f.name === "id" && f.isPrimary), "User.id is primary key");
  assert(prismaUser?.fields.some((f) => f.name === "email" && f.isUnique), "User.email is unique");

  const prismaPost = prismaResult.entities.find((e) => e.name === "Post");
  assert(Boolean(prismaPost), "Extracted Post model from Prisma");
  assert(prismaPost?.fields.some((f) => f.name === "title"), "Post has title field");

  // ─────────────────────────────────────────────
  // 5. SQLAlchemy
  // ─────────────────────────────────────────────
  console.log("\n--- 5. SQLAlchemy Model Extraction ---");

  const sqlAlchemyCode = `
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False, unique=True)
    username = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = 'posts'

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
`;

  const sqlaFiles = [
    { path: "app/models.py", type: "file", size: 400, content: sqlAlchemyCode }
  ];

  const sqlaResult = extractDatabaseSchema(
    sqlaFiles,
    { hasDatabase: true, details: { databases: ["PostgreSQL"] } },
    { databases: ["PostgreSQL"] },
    null
  );

  assert(sqlaResult.entities.length >= 2, "Extracted at least 2 SQLAlchemy entities");

  const sqlaUser = sqlaResult.entities.find((e) => e.name === "User");
  assert(Boolean(sqlaUser), "Extracted User class");
  assert(sqlaUser?.fields.some((f) => f.isPrimary), "User has primary key");
  assert(sqlaUser?.fields.some((f) => f.name === "email"), "User has email field");

  const sqlaPost = sqlaResult.entities.find((e) => e.name === "Post");
  assert(Boolean(sqlaPost), "Extracted Post class");
  const userIdSqla = sqlaPost?.fields.find((f) => f.name === "user_id");
  assert(Boolean(userIdSqla) && userIdSqla.isForeign, "Post.user_id is foreign key");
  assert(userIdSqla?.references?.entity === "Users", "user_id references Users entity");

  // ─────────────────────────────────────────────
  // 6. SQL CREATE TABLE
  // ─────────────────────────────────────────────
  console.log("\n--- 6. SQL CREATE TABLE Extraction ---");

  const sqlCode = `
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

  const sqlFiles = [
    { path: "migrations/001_init.sql", type: "file", size: 300, content: sqlCode }
  ];

  const sqlResult = extractDatabaseSchema(
    sqlFiles,
    { hasDatabase: true, details: { databases: ["PostgreSQL"] } },
    { databases: ["PostgreSQL"] },
    null
  );

  assert(sqlResult.entities.length >= 2, "Extracted at least 2 SQL entities");
  const sqlUsers = sqlResult.entities.find((e) => e.name.toLowerCase().includes("user") || e.name.toLowerCase() === "users");
  assert(Boolean(sqlUsers), "Extracted users table");
  assert(sqlUsers?.fields.some((f) => f.isPrimary), "users table has primary key");

  // ─────────────────────────────────────────────
  // 7. No schema files in models directory
  // ─────────────────────────────────────────────
  console.log("\n--- 7. No Extractable Schema (Graceful Degradation) ---");

  const nonSchemaFiles = [
    { path: "src/models/User.js", type: "file", size: 200, content: "// This is a plain helper file\nconst users = [];\nmodule.exports = users;" }
  ];

  const noSchemaResult = extractDatabaseSchema(nonSchemaFiles, dbCapabilities, { databases: ["MongoDB"] }, null);
  // Should not crash, should return empty entities
  assert(Array.isArray(noSchemaResult.entities), "Returns valid entities array even with no schema");
  assert(noSchemaResult.entities.length === 0, "Returns 0 entities when no schema detected");
  assert(Array.isArray(noSchemaResult.relationships), "Returns valid relationships array");

  // ─────────────────────────────────────────────
  // Results
  // ─────────────────────────────────────────────
  console.log("\n==============================================");
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log("==============================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test fatal error:", err);
  process.exit(1);
});
