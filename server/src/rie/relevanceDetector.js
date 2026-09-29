// server/src/rie/relevanceDetector.js
//
// Repository Intelligence Engine — Smart Relevance & Capability Detector
//
// Identifies which analysis capabilities (Database/ERD, APIs/Routes, DevOps/Infra, Security)
// are relevant to an ingested codebase based on static repository evidence.
// Does NOT execute code or call LLM APIs (100% static & deterministic invariant).

import fs from "fs";
import path from "path";

// ── Dependency Sets ───────────────────────────────────────────────────────────

const DATABASE_DEPS = new Set([
  "mongoose",
  "mongodb",
  "@prisma/client",
  "prisma",
  "drizzle-orm",
  "sequelize",
  "typeorm",
  "sqlalchemy",
  "pg",
  "postgres",
  "mysql",
  "mysql2",
  "sqlite3",
  "better-sqlite3",
  "redis",
  "ioredis",
  "gorm",
  "diesel",
  "sqlx",
  "doctrine/orm",
  "mongoid",
  "psycopg2",
  "pymongo",
]);

const API_FRAMEWORKS = new Set([
  "express",
  "express.js",
  "fastify",
  "nestjs",
  "fastapi",
  "flask",
  "django",
  "gin",
  "echo",
  "fiber",
  "chi",
  "actix",
  "axum",
  "rocket",
  "koa",
  "hono",
  "laravel",
  "symfony",
  "slim",
  "rails",
  "sinatra",
  "asp.net",
  "spring boot",
  "quarkus",
  "ktor",
]);

const SECURITY_DEPS = new Set([
  "jsonwebtoken",
  "jwt-decode",
  "bcrypt",
  "bcryptjs",
  "passport",
  "helmet",
  "cors",
  "@clerk/express",
  "@clerk/clerk-react",
  "@clerk/nextjs",
  "argon2",
  "auth0",
  "crypto",
  "jose",
  "pyjwt",
  "passlib",
  "oauth2",
  "spring-security",
]);

const DEVOPS_FILES = new Set([
  "dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "containerfile",
  "jenkinsfile",
  ".gitlab-ci.yml",
  ".travis.yml",
  "procfile",
  "fly.toml",
  "render.yaml",
]);

const API_SPEC_FILES = new Set([
  "swagger.json",
  "openapi.yaml",
  "openapi.yml",
  "swagger.yaml",
]);

/**
 * Checks if a path belongs to documentation, tests, or non-code assets to prevent false positives.
 * @param {string} p
 * @returns {boolean}
 */
const isDocOrTestPath = (p) => {
  return (
    p.startsWith("docs/") ||
    p.startsWith("documentation/") ||
    p.startsWith("site/") ||
    p.startsWith("test/") ||
    p.startsWith("tests/") ||
    p.startsWith("__tests__/") ||
    p.startsWith("fixtures/") ||
    p.startsWith("examples/") ||
    p.startsWith("tutorials/") ||
    p.startsWith("paper/") ||
    p.startsWith("slides/") ||
    p.endsWith(".md") ||
    p.endsWith(".txt") ||
    p.endsWith(".pdf") ||
    p.endsWith(".rst")
  );
};

/**
 * Safely reads and parses a JSON file from disk if repoRoot is provided.
 * @param {string} filePath
 * @returns {Object|null}
 */
const safeReadJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};

/**
 * Detects relevant capabilities for a repository using file tree, techStack, and package signals.
 *
 * @param {Array<{ path: string, type?: string, size?: number }>} [fileTree=[]]
 * @param {Object} [techStack={}]
 * @param {Array} [techStack.languages=[]]
 * @param {Array} [techStack.frameworks=[]]
 * @param {Array} [techStack.databases=[]]
 * @param {Array} [techStack.devops=[]]
 * @param {string|null} [repoRoot=null]
 * @returns {{
 *   hasDatabase: boolean,
 *   hasApis: boolean,
 *   hasDevops: boolean,
 *   hasSecuritySensitiveCode: boolean,
 *   details: {
 *     databases: string[],
 *     frameworks: string[],
 *     devops: string[]
 *   }
 * }}
 */
export const detectCapabilities = (fileTree = [], techStack = {}, repoRoot = null) => {
  const normalizedTree = fileTree.map((node) => ({
    path: (node.path || "").toLowerCase().replace(/\\/g, "/"),
    type: node.type || "file",
  }));

  const pathSet = new Set(normalizedTree.map((n) => n.path));
  const filenameSet = new Set(normalizedTree.map((n) => n.path.split("/").pop()));

  const detectedDbs = new Set(techStack.databases || []);
  const detectedFws = new Set(techStack.frameworks || []);
  const detectedDevops = new Set(techStack.devops || []);

  // ── SIGNAL 1: Manifest Inspection (if repoRoot available) ─────────────────
  if (repoRoot && filenameSet.has("package.json")) {
    const pkg = safeReadJson(path.join(repoRoot, "package.json"));
    if (pkg) {
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      for (const dep of Object.keys(allDeps)) {
        const lowerDep = dep.toLowerCase();

        if (DATABASE_DEPS.has(lowerDep)) {
          if (lowerDep.includes("mongoose") || lowerDep.includes("mongodb")) detectedDbs.add("MongoDB");
          else if (lowerDep.includes("prisma")) detectedDbs.add("Prisma");
          else if (lowerDep.includes("sequelize")) detectedDbs.add("Sequelize");
          else if (lowerDep.includes("drizzle")) detectedDbs.add("Drizzle");
          else if (lowerDep.includes("pg") || lowerDep.includes("postgres")) detectedDbs.add("PostgreSQL");
          else if (lowerDep.includes("mysql")) detectedDbs.add("MySQL");
          else if (lowerDep.includes("sqlite")) detectedDbs.add("SQLite");
          else if (lowerDep.includes("redis")) detectedDbs.add("Redis");
          else detectedDbs.add(dep);
        }
      }
    }
  }

  // ── SIGNAL 2: Database / ERD Detection ──────────────────────────────────────
  let hasDatabase = detectedDbs.size > 0;

  if (!hasDatabase) {
    const hasPrismaSchema = pathSet.has("prisma/schema.prisma");
    const hasSqlFiles = normalizedTree.some((n) => !isDocOrTestPath(n.path) && n.path.endsWith(".sql"));
    const hasDbDirectories = normalizedTree.some((n) => {
      if (isDocOrTestPath(n.path)) return false;
      const segments = n.path.split("/");
      return (
        segments.includes("models") ||
        segments.includes("schemas") ||
        segments.includes("entities") ||
        segments.includes("migrations")
      );
    });

    if (hasPrismaSchema || hasSqlFiles || hasDbDirectories) {
      hasDatabase = true;
      if (hasPrismaSchema) detectedDbs.add("Prisma");
      if (hasSqlFiles) detectedDbs.add("SQL");
      if (hasDbDirectories && detectedDbs.size === 0) detectedDbs.add("Database Models");
    }
  }

  // ── SIGNAL 3: API / Request Flow Detection ───────────────────────────────
  let hasApis = false;

  // Framework check
  for (const fw of techStack.frameworks || []) {
    if (API_FRAMEWORKS.has(fw.toLowerCase())) {
      hasApis = true;
      break;
    }
  }

  if (!hasApis) {
    const hasApiPaths = normalizedTree.some((n) => {
      if (isDocOrTestPath(n.path)) return false;
      const p = n.path;
      const segments = p.split("/");
      return (
        segments.includes("routes") ||
        segments.includes("controllers") ||
        segments.includes("endpoints") ||
        p.startsWith("api/") ||
        p.startsWith("pages/api/") ||
        p.startsWith("app/api/")
      );
    });

    const hasApiSpecs = [...API_SPEC_FILES].some((file) => filenameSet.has(file));

    if (hasApiPaths || hasApiSpecs) {
      hasApis = true;
    }
  }

  // ── SIGNAL 4: DevOps & Infrastructure Detection ───────────────────────────
  let hasDevops = detectedDevops.size > 0;

  if (!hasDevops) {
    const hasDevopsFiles = [...DEVOPS_FILES].some((file) => filenameSet.has(file));
    const hasDevopsDirs = normalizedTree.some((n) => {
      if (isDocOrTestPath(n.path)) return false;
      const p = n.path;
      return (
        p.startsWith("k8s/") ||
        p.startsWith("kubernetes/") ||
        p.startsWith("helm/") ||
        p.startsWith("terraform/") ||
        p.startsWith(".github/workflows") ||
        p.startsWith(".circleci/")
      );
    });

    if (hasDevopsFiles || hasDevopsDirs) {
      hasDevops = true;
      if (filenameSet.has("dockerfile") || filenameSet.has("docker-compose.yml") || filenameSet.has("docker-compose.yaml")) {
        detectedDevops.add("Docker");
      }
      if (normalizedTree.some((n) => n.path.startsWith(".github/workflows"))) {
        detectedDevops.add("GitHub Actions");
      }
      if (normalizedTree.some((n) => n.path.startsWith("k8s/") || n.path.startsWith("kubernetes/"))) {
        detectedDevops.add("Kubernetes");
      }
      if (detectedDevops.size === 0) detectedDevops.add("CI/CD");
    }
  }

  // ── SIGNAL 5: Security-Sensitive Code Detection ────────────────────────────
  let hasSecuritySensitiveCode = false;

  const hasSecurityDirs = normalizedTree.some((n) => {
    if (isDocOrTestPath(n.path)) return false;
    const segments = n.path.split("/");
    return (
      segments.includes("middleware") ||
      segments.includes("auth") ||
      segments.includes("guards") ||
      segments.includes("policies") ||
      segments.includes("security")
    );
  });

  const hasEnvConfig = filenameSet.has(".env.example") || filenameSet.has(".env");

  // APIs and backend services are also security-relevant analysis targets
  if (hasSecurityDirs || hasEnvConfig || hasApis) {
    hasSecuritySensitiveCode = true;
  }

  return {
    hasDatabase,
    hasApis,
    hasDevops,
    hasSecuritySensitiveCode,
    details: {
      databases: Array.from(detectedDbs),
      frameworks: Array.from(detectedFws),
      devops: Array.from(detectedDevops),
    },
  };
};

