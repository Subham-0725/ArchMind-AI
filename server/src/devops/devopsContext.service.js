// server/src/devops/devopsContext.service.js
//
// Repository Context Collector for ArchMind AI DevOps Generation (Phase 5).
// Extracts bounded, grounded metadata from repository files, RIE blueprint,
// AST analysis, and SourceFile records while enforcing strict secret redaction.

import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { redactSecrets } from "../rie/security/secretRedactor.js";
import SourceFile from "../models/SourceFile.js";

/**
 * Helper to fetch sanitized text of a file from MongoDB SourceFile records,
 * falling back to local extractionPath if accessible on disk.
 *
 * @param {Object} project
 * @param {string} targetPath
 * @returns {Promise<string|null>}
 */
async function getFileContent(project, targetPath) {
  if (!project || !targetPath) return null;

  // 1. Try SourceFile in MongoDB only if connected
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const doc = await SourceFile.findOne({
        projectId: project._id,
        filePath: targetPath,
        analysisVersion: project.analysisVersion || 1,
      }).lean();

      if (doc?.content) {
        return redactSecrets(doc.content);
      }
    } catch (err) {
      // MongoDB lookup failed, continue to fallbacks
    }
  }

  // 2. Try disk if extractionPath exists
  if (project.extractionPath) {
    try {
      const fullPath = path.join(project.extractionPath, targetPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const raw = fs.readFileSync(fullPath, "utf8");
        return redactSecrets(raw);
      }
    } catch {
      // Ignore disk read error
    }
  }

  // 3. Try content embedded in tree node if present
  if (Array.isArray(project.tree)) {
    const node = project.tree.find((n) => n.path === targetPath);
    if (node?.content) {
      return redactSecrets(String(node.content));
    }
  }

  return null;
}

/**
 * Collects a grounded, bounded DevOps context from an ingested repository.
 *
 * @param {Object} project - Project mongoose document or plain object
 * @param {Object} [options]
 * @returns {Promise<Object>} Collected DevOps context
 */
export async function collectDevopsContext(project, options = {}) {
  const tree = Array.isArray(project.tree) ? project.tree : [];
  const normalizedPaths = tree.map((n) => (n.path || "").replace(/\\/g, "/"));
  const pathSet = new Set(normalizedPaths);
  const baseNames = new Set(normalizedPaths.map((p) => p.split("/").pop().toLowerCase()));

  // 1. Primary language & runtime
  const techStack = project.techStack || {};
  let primaryLanguage = project.primaryLanguage || techStack.languages?.[0] || null;

  if (!primaryLanguage) {
    if (pathSet.has("package.json")) primaryLanguage = "JavaScript";
    else if (pathSet.has("requirements.txt") || pathSet.has("pyproject.toml")) primaryLanguage = "Python";
    else if (pathSet.has("go.mod")) primaryLanguage = "Go";
    else if (pathSet.has("pom.xml") || pathSet.has("build.gradle")) primaryLanguage = "Java";
    else if (pathSet.has("Cargo.toml")) primaryLanguage = "Rust";
    else primaryLanguage = "Unknown";
  }

  // 2. Package manager and dependency manifests
  let packageManager = null;
  let lockfile = null;
  let installCommand = null;
  let buildScript = null;
  let startScript = null;
  let testScript = null;
  let lintScript = null;
  let runtimeVersion = null;
  let scripts = {};
  let dependencies = {};
  let devDependencies = {};

  if (primaryLanguage === "JavaScript" || primaryLanguage === "TypeScript" || pathSet.has("package.json")) {
    packageManager = "npm";
    installCommand = "npm install";

    if (pathSet.has("package-lock.json")) {
      lockfile = "package-lock.json";
      packageManager = "npm";
      installCommand = "npm ci";
    } else if (pathSet.has("yarn.lock")) {
      lockfile = "yarn.lock";
      packageManager = "yarn";
      installCommand = "yarn install --frozen-lockfile";
    } else if (pathSet.has("pnpm-lock.yaml")) {
      lockfile = "pnpm-lock.yaml";
      packageManager = "pnpm";
      installCommand = "pnpm install --frozen-lockfile";
    } else if (pathSet.has("bun.lockb")) {
      lockfile = "bun.lockb";
      packageManager = "bun";
      installCommand = "bun install --frozen-lockfile";
    }

    // Read package.json content
    const pkgJsonText = await getFileContent(project, "package.json");
    if (pkgJsonText) {
      try {
        const pkg = JSON.parse(pkgJsonText);
        scripts = pkg.scripts || {};
        dependencies = pkg.dependencies || {};
        devDependencies = pkg.devDependencies || {};

        if (scripts.build) buildScript = "npm run build";
        if (scripts.start) startScript = "npm start";
        if (scripts.test && !scripts.test.includes("no test specified")) testScript = "npm test";
        if (scripts.lint) lintScript = "npm run lint";

        if (pkg.engines?.node) {
          const match = String(pkg.engines.node).match(/\d+/);
          if (match) runtimeVersion = match[0];
        }
      } catch {
        // Corrupt package.json, proceed with defaults
      }
    }

    if (!runtimeVersion) {
      runtimeVersion = "20"; // LTS default
    }
  } else if (primaryLanguage === "Python") {
    runtimeVersion = "3.11";
    packageManager = "pip";
    installCommand = "pip install -r requirements.txt";

    if (pathSet.has("poetry.lock")) {
      lockfile = "poetry.lock";
      packageManager = "poetry";
      installCommand = "poetry install --no-dev";
    } else if (pathSet.has("Pipfile.lock") || pathSet.has("Pipfile")) {
      lockfile = "Pipfile.lock";
      packageManager = "pipenv";
      installCommand = "pipenv install --deploy";
    } else if (pathSet.has("requirements.txt")) {
      lockfile = "requirements.txt";
    }

    // Detect python test scripts
    const reqText = await getFileContent(project, "requirements.txt");
    const hasPytestInReqs = reqText && reqText.toLowerCase().includes("pytest");

    if (normalizedPaths.some((p) => p.includes("test") || p.endsWith("_test.py") || p.startsWith("tests/"))) {
      if (hasPytestInReqs || normalizedPaths.some((p) => p.includes("pytest") || p.includes("conftest.py"))) {
        testScript = "pytest";
      } else {
        testScript = "python -m unittest";
      }
    }
  } else if (primaryLanguage === "Go") {
    runtimeVersion = "1.22";
    packageManager = "go modules";
    installCommand = "go mod download";
    testScript = "go test ./...";
    buildScript = "go build -o app .";
  }

  // 3. Entry point detection
  let entryPoint = null;
  const commonEntryFiles = [
    "src/server.js",
    "src/index.js",
    "src/main.js",
    "server.js",
    "index.js",
    "app.js",
    "src/app.js",
    "main.py",
    "app.py",
    "wsgi.py",
    "asgi.py",
    "main.go",
    "cmd/main.go",
  ];

  for (const f of commonEntryFiles) {
    if (pathSet.has(f)) {
      entryPoint = f;
      break;
    }
  }

  // If start script was not defined, compute from entry point
  if (!startScript && entryPoint) {
    if (primaryLanguage === "JavaScript" || primaryLanguage === "TypeScript") {
      startScript = `node ${entryPoint}`;
    } else if (primaryLanguage === "Python") {
      if (techStack.frameworks?.includes("FastAPI")) {
        startScript = `uvicorn ${entryPoint.replace(".py", "")}:app --host 0.0.0.0 --port 8000`;
      } else {
        startScript = `python ${entryPoint}`;
      }
    } else if (primaryLanguage === "Go") {
      startScript = "./app";
    }
  }

  // 4. Application port detection
  let port = null;
  // Inspect known entry point or env examples for port
  const envExampleContent =
    (await getFileContent(project, ".env.example")) ||
    (await getFileContent(project, ".env.sample"));

  if (envExampleContent) {
    const portMatch = envExampleContent.match(/^\s*PORT\s*=\s*(\d+)/m);
    if (portMatch) {
      port = parseInt(portMatch[1], 10);
    }
  }

  if (!port && entryPoint) {
    const entryContent = await getFileContent(project, entryPoint);
    if (entryContent) {
      const portMatch =
        entryContent.match(/process\.env\.PORT\s*\|\|\s*(\d+)/) ||
        entryContent.match(/listen\s*\(\s*(\d+)/) ||
        entryContent.match(/port\s*[:=]\s*(\d+)/i);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
      }
    }
  }

  // Fallback defaults by framework if evidence exists
  if (!port) {
    if (techStack.frameworks?.includes("Express") || techStack.frameworks?.includes("NestJS")) {
      port = 5000;
    } else if (techStack.frameworks?.includes("FastAPI") || techStack.frameworks?.includes("Django")) {
      port = 8000;
    } else if (techStack.frameworks?.includes("Next.js") || techStack.frameworks?.includes("React")) {
      port = 3000;
    }
  }

  // 5. Structure: monorepo vs single service
  const hasClient = normalizedPaths.some((p) => p.startsWith("client/") || p.startsWith("frontend/"));
  const hasServer = normalizedPaths.some((p) => p.startsWith("server/") || p.startsWith("backend/"));
  const isMonorepo = hasClient && hasServer;

  // 6. Existing DevOps files
  const existingDockerfiles = normalizedPaths.filter(
    (p) => p === "Dockerfile" || p.endsWith("/Dockerfile") || p.includes("Containerfile")
  );
  const existingCicd = normalizedPaths.filter(
    (p) => p.startsWith(".github/workflows/") && (p.endsWith(".yml") || p.endsWith(".yaml"))
  );
  const existingK8s = normalizedPaths.filter(
    (p) => (p.startsWith("k8s/") || p.startsWith("kubernetes/")) && (p.endsWith(".yml") || p.endsWith(".yaml"))
  );

  // 7. Non-sensitive environment variable names (strip all values)
  const envVarNames = [];
  if (envExampleContent) {
    const lines = envExampleContent.split(/\r?\n/);
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const key = trimmed.split("=")[0].trim();
      if (key && !envVarNames.includes(key)) {
        envVarNames.push(key);
      }
    }
  }

  // 8. Health check endpoint detection
  let healthEndpoint = null;
  const routes = project.apiRoutes || project.analysisResults?.apiRoutes || [];
  for (const r of routes) {
    const pathLower = (r.path || "").toLowerCase();
    if (
      pathLower === "/health" ||
      pathLower === "/api/health" ||
      pathLower === "/healthz" ||
      pathLower === "/status" ||
      pathLower === "/ping"
    ) {
      healthEndpoint = r.path;
      break;
    }
  }

  // 9. Database requirements
  const databaseType = project.database?.type || techStack.databases?.[0] || null;

  return {
    projectName: project.name || "app",
    primaryLanguage,
    runtimeVersion,
    packageManager,
    lockfile,
    installCommand,
    buildScript,
    startScript,
    testScript,
    lintScript,
    entryPoint,
    port,
    isMonorepo,
    hasClient,
    hasServer,
    healthEndpoint,
    databaseType,
    existingDockerfiles,
    existingCicd,
    existingK8s,
    envVarNames,
    scripts,
    dependencies: Object.keys(dependencies).slice(0, 30),
    frameworks: techStack.frameworks || [],
  };
}
