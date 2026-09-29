// src/rie/repoScanner.js
//
// Repository Intelligence Engine — File Tree Scanner & Technology Detector
//
// Responsibilities:
//   1. Walk the extracted repository directory safely using Node.js fs + path
//   2. Apply RIE noise filtering (node_modules, .git, binaries, lockfiles, build artifacts)
//   3. Compile a sanitized file tree in the standard ArchMind RIE shape
//   4. Detect project technologies, frameworks, databases, and DevOps tooling
//   5. Auto-unwrap single top-level directories so paths are relative to repo root

import fs from "fs";
import path from "path";

// ── Noise Filter Sets ─────────────────────────────────────────────────────────

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "venv",
  ".venv",
  "env",
  "__pycache__",
  ".pytest_cache",
  ".turbo",
  "coverage",
  ".nyc_output",
  ".cache",
  ".idea",
  ".vscode",
  ".husky",
  "target",
  "bin",
  "obj",
  "vendor",
  "tmp",
  "temp",
]);

const IGNORED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".pdf", ".zip", ".tar", ".gz", ".rar", ".7z",
  ".exe", ".dll", ".so", ".dylib",
  ".mp4", ".mp3", ".wav", ".mov", ".avi",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".map", ".lock",
]);

const IGNORED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "cargo.lock",
  "gemfile.lock",
  "poetry.lock",
  ".ds_store",
  "thumbs.db",
]);

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Returns true if this path segment or file should be excluded from analysis.
 *
 * @param {string} relPath - Path relative to the repo root
 * @returns {boolean}
 */
const isNoisePath = (relPath) => {
  if (!relPath) return true;

  const normalized = relPath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  for (let i = 0; i < segments.length - 1; i++) {
    const dir = segments[i].toLowerCase();
    if (IGNORED_DIRECTORIES.has(dir) || (dir.startsWith(".") && !dir.startsWith(".github"))) {
      return true;
    }
  }

  const filename = segments[segments.length - 1].toLowerCase();

  if (IGNORED_FILENAMES.has(filename)) return true;

  // Hidden files — allow standard config files through
  if (
    filename.startsWith(".") &&
    filename !== ".gitignore" &&
    filename !== ".editorconfig" &&
    filename !== ".eslintrc.json" &&
    filename !== ".prettierrc" &&
    filename !== ".env.example"
  ) {
    return true;
  }

  for (const ext of IGNORED_EXTENSIONS) {
    if (filename.endsWith(ext)) return true;
  }

  return false;
};

/**
 * Recursively walks a directory and collects all file/dir entries.
 *
 * @param {string} dirPath    - Absolute path of current directory
 * @param {string} rootPath   - Absolute path of repo root (for relative path calc)
 * @param {Array}  treeAcc    - Accumulator array
 * @param {Object} statsAcc   - Running statistics accumulator
 */
const walkDir = (dirPath, rootPath, treeAcc, statsAcc) => {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, absPath).replace(/\\/g, "/");

    if (isNoisePath(relPath)) continue;

    if (entry.isDirectory()) {
      statsAcc.totalDirs++;
      treeAcc.push({ path: relPath, type: "dir", size: 0 });
      walkDir(absPath, rootPath, treeAcc, statsAcc);
    } else if (entry.isFile()) {
      let size = 0;
      try {
        size = fs.statSync(absPath).size;
      } catch {
        size = 0;
      }

      statsAcc.totalFiles++;
      statsAcc.totalBytes += size;

      const ext = entry.name.includes(".")
        ? `.${entry.name.split(".").pop().toLowerCase()}`
        : "no_ext";
      statsAcc.extensionCounts[ext] = (statsAcc.extensionCounts[ext] || 0) + 1;

      treeAcc.push({ path: relPath, type: "file", size });
    }
  }
};

/**
 * Safely reads and parses JSON from a file.
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
 * Safely reads UTF-8 text from a file.
 * @param {string} filePath
 * @returns {string}
 */
const safeReadText = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

/**
 * Inspects manifest and configuration files to infer technology stack.
 *
 * @param {string} repoRoot - Absolute path to repository root
 * @param {Array}  fileTree - Sanitized file tree
 * @returns {{ languages: string[], frameworks: string[], databases: string[], devops: string[] }}
 */
const detectTechStack = (repoRoot, fileTree) => {
  const filePaths = new Set(fileTree.map((n) => n.path.toLowerCase()));
  const languages = new Set();
  const frameworks = new Set();
  const databases = new Set();
  const devops = new Set();

  // ── Node.js / JavaScript / TypeScript ──────────────────────────────────────
  if (filePaths.has("package.json")) {
    const pkg = safeReadJson(path.join(repoRoot, "package.json"));
    if (pkg) {
      languages.add("JavaScript");
      if (filePaths.has("tsconfig.json")) languages.add("TypeScript");

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      // Frameworks
      if (allDeps.react) frameworks.add("React");
      if (allDeps.vue || allDeps["@vue/core"]) frameworks.add("Vue");
      if (allDeps["@angular/core"]) frameworks.add("Angular");
      if (allDeps.svelte) frameworks.add("Svelte");
      if (allDeps.next) frameworks.add("Next.js");
      if (allDeps.nuxt) frameworks.add("Nuxt");
      if (allDeps["@remix-run/react"]) frameworks.add("Remix");
      if (allDeps.express) frameworks.add("Express.js");
      if (allDeps.fastify) frameworks.add("Fastify");
      if (allDeps.koa) frameworks.add("Koa");
      if (allDeps.nestjs || allDeps["@nestjs/core"]) frameworks.add("NestJS");
      if (allDeps.hono) frameworks.add("Hono");

      // Databases
      if (allDeps.mongoose || allDeps.mongodb) databases.add("MongoDB");
      if (allDeps.pg || allDeps.postgres || allDeps["pg-pool"]) databases.add("PostgreSQL");
      if (allDeps.mysql || allDeps.mysql2) databases.add("MySQL");
      if (allDeps.sqlite3 || allDeps["better-sqlite3"]) databases.add("SQLite");
      if (allDeps.redis || allDeps.ioredis) databases.add("Redis");
      if (allDeps["@prisma/client"]) databases.add("Prisma");
      if (allDeps.drizzle || allDeps["drizzle-orm"]) databases.add("Drizzle");
      if (allDeps.sequelize) databases.add("Sequelize");

      // DevOps
      if (allDeps.docker || filePaths.has("dockerfile")) devops.add("Docker");
    }
  }

  // ── Python ─────────────────────────────────────────────────────────────────
  if (
    filePaths.has("requirements.txt") ||
    filePaths.has("pyproject.toml") ||
    filePaths.has("setup.py") ||
    filePaths.has("pipfile")
  ) {
    languages.add("Python");

    const reqText = safeReadText(path.join(repoRoot, "requirements.txt")).toLowerCase();
    if (reqText.includes("django")) frameworks.add("Django");
    if (reqText.includes("flask")) frameworks.add("Flask");
    if (reqText.includes("fastapi")) frameworks.add("FastAPI");
    if (reqText.includes("sqlalchemy")) databases.add("SQLAlchemy");
    if (reqText.includes("psycopg2")) databases.add("PostgreSQL");
    if (reqText.includes("pymongo")) databases.add("MongoDB");
    if (reqText.includes("redis")) databases.add("Redis");

    const pyprojectText = safeReadText(path.join(repoRoot, "pyproject.toml")).toLowerCase();
    if (pyprojectText.includes("fastapi")) frameworks.add("FastAPI");
    if (pyprojectText.includes("django")) frameworks.add("Django");
    if (pyprojectText.includes("flask")) frameworks.add("Flask");
  }

  // ── Java / Kotlin ──────────────────────────────────────────────────────────
  if (filePaths.has("pom.xml")) {
    languages.add("Java");
    const pomText = safeReadText(path.join(repoRoot, "pom.xml")).toLowerCase();
    if (pomText.includes("spring")) frameworks.add("Spring Boot");
    if (pomText.includes("quarkus")) frameworks.add("Quarkus");
    if (pomText.includes("postgresql")) databases.add("PostgreSQL");
    if (pomText.includes("mysql")) databases.add("MySQL");
    if (pomText.includes("mongodb")) databases.add("MongoDB");
  }

  if (filePaths.has("build.gradle") || filePaths.has("build.gradle.kts")) {
    languages.add("Java");
    if (filePaths.has("build.gradle.kts")) languages.add("Kotlin");
    const gradleFile = filePaths.has("build.gradle.kts") ? "build.gradle.kts" : "build.gradle";
    const gradleText = safeReadText(path.join(repoRoot, gradleFile)).toLowerCase();
    if (gradleText.includes("spring")) frameworks.add("Spring Boot");
    if (gradleText.includes("ktor")) frameworks.add("Ktor");
    if (gradleText.includes("postgresql")) databases.add("PostgreSQL");
    if (gradleText.includes("mysql")) databases.add("MySQL");
    if (gradleText.includes("mongodb")) databases.add("MongoDB");
  }

  // ── Go ─────────────────────────────────────────────────────────────────────
  if (filePaths.has("go.mod")) {
    languages.add("Go");
    const goModText = safeReadText(path.join(repoRoot, "go.mod")).toLowerCase();
    if (goModText.includes("gin-gonic/gin")) frameworks.add("Gin");
    if (goModText.includes("labstack/echo")) frameworks.add("Echo");
    if (goModText.includes("gofiber/fiber")) frameworks.add("Fiber");
    if (goModText.includes("go-chi/chi")) frameworks.add("Chi");
    if (goModText.includes("go-gorm/gorm") || goModText.includes("gorm.io/gorm")) databases.add("GORM");
    if (goModText.includes("mongodb")) databases.add("MongoDB");
    if (goModText.includes("pq") || goModText.includes("pgx")) databases.add("PostgreSQL");
  }

  // ── Rust ───────────────────────────────────────────────────────────────────
  if (filePaths.has("cargo.toml")) {
    languages.add("Rust");
    const cargoText = safeReadText(path.join(repoRoot, "Cargo.toml")).toLowerCase();
    if (cargoText.includes("actix")) frameworks.add("Actix");
    if (cargoText.includes("axum")) frameworks.add("Axum");
    if (cargoText.includes("rocket")) frameworks.add("Rocket");
    if (cargoText.includes("sqlx")) databases.add("SQLx");
    if (cargoText.includes("diesel")) databases.add("Diesel");
  }

  // ── PHP ────────────────────────────────────────────────────────────────────
  if (filePaths.has("composer.json")) {
    languages.add("PHP");
    const composerPkg = safeReadJson(path.join(repoRoot, "composer.json"));
    if (composerPkg) {
      const allDeps = { ...composerPkg.require, ...composerPkg["require-dev"] };
      if (allDeps["laravel/framework"]) frameworks.add("Laravel");
      if (allDeps["symfony/symfony"] || allDeps["symfony/framework-bundle"]) frameworks.add("Symfony");
      if (allDeps["slim/slim"]) frameworks.add("Slim");
      if (allDeps["doctrine/orm"]) databases.add("Doctrine");
    }
  }

  // ── Ruby ───────────────────────────────────────────────────────────────────
  if (filePaths.has("gemfile")) {
    languages.add("Ruby");
    const gemfileText = safeReadText(path.join(repoRoot, "Gemfile")).toLowerCase();
    if (gemfileText.includes("rails")) frameworks.add("Rails");
    if (gemfileText.includes("sinatra")) frameworks.add("Sinatra");
    if (gemfileText.includes("pg")) databases.add("PostgreSQL");
    if (gemfileText.includes("mysql2")) databases.add("MySQL");
    if (gemfileText.includes("mongoid")) databases.add("MongoDB");
    if (gemfileText.includes("redis")) databases.add("Redis");
  }

  // ── Docker / Kubernetes / CI ───────────────────────────────────────────────
  if (filePaths.has("dockerfile") || filePaths.has("docker-compose.yml") || filePaths.has("docker-compose.yaml")) {
    devops.add("Docker");
  }

  for (const fp of filePaths) {
    if ((fp.endsWith(".yaml") || fp.endsWith(".yml")) && fp.includes("k8s")) {
      devops.add("Kubernetes");
      break;
    }
  }

  if ([...filePaths].some((p) => p.startsWith(".github/workflows"))) {
    devops.add("GitHub Actions");
  }
  if (filePaths.has(".travis.yml")) devops.add("Travis CI");
  if (filePaths.has("jenkinsfile") || filePaths.has("Jenkinsfile")) devops.add("Jenkins");
  if (filePaths.has(".circleci/config.yml")) devops.add("CircleCI");
  if (filePaths.has("gitlab-ci.yml") || filePaths.has(".gitlab-ci.yml")) devops.add("GitLab CI");

  return {
    languages: [...languages],
    frameworks: [...frameworks],
    databases: [...databases],
    devops: [...devops],
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scans an extracted repository directory, applies noise filtering,
 * compiles a file tree and statistics, and detects the technology stack.
 *
 * @param {string} repoRoot - Absolute path to the extracted repository directory
 * @returns {{
 *   tree: Array<{ path: string, type: 'file'|'dir', size: number }>,
 *   stats: { totalFiles: number, totalDirs: number, totalBytes: number, isTruncated: boolean, topExtensions: Array },
 *   techStack: { languages: string[], frameworks: string[], databases: string[], devops: string[] }
 * }}
 */
export const scanRepository = (repoRoot) => {
  const tree = [];
  const statsAcc = {
    totalFiles: 0,
    totalDirs: 0,
    totalBytes: 0,
    extensionCounts: {},
  };

  // If the ZIP contained a single top-level folder (common pattern: repo.zip → repo/),
  // descend into it automatically so tree paths are relative to the real repo root.
  let scanRoot = repoRoot;
  try {
    const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    const files = entries.filter((e) => e.isFile());

    if (dirs.length === 1 && files.length === 0) {
      scanRoot = path.join(repoRoot, dirs[0].name);
    }
  } catch {
    // Keep scanRoot as-is
  }

  walkDir(scanRoot, scanRoot, tree, statsAcc);

  // Reject if no valid source files remain after noise filtering
  if (tree.length === 0) {
    const err = new Error(
      "The uploaded ZIP contains no analyzable source files after filtering out noise directories (node_modules, .git, dist, etc.)."
    );
    err.code = "EMPTY_ZIP";
    throw err;
  }

  const topExtensions = Object.entries(statsAcc.extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([extension, count]) => ({ extension, count }));

  const stats = {
    totalFiles: statsAcc.totalFiles,
    totalDirs: statsAcc.totalDirs,
    totalBytes: statsAcc.totalBytes,
    isTruncated: false,
    topExtensions,
  };

  const techStack = detectTechStack(scanRoot, tree);

  return { tree, stats, techStack };
};
