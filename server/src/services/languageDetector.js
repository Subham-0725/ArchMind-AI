// src/services/languageDetector.js
//
// Project Language & Technology Stack Detector Service
//
// Implements multi-signal static analysis:
//   1. Source file extension counts & volume weighting
//   2. Project manifest & configuration file analysis (package.json, requirements.txt, etc.)
//   3. Framework & dependency detection
//   4. Polyglot language classification & weighted confidence score calculation
//
// Operates on normalized file trees and optional local repository roots.
// Does NOT execute code or project scripts (static analysis invariant).

import fs from "fs";
import path from "path";

// ── Extension to Language Mapping ─────────────────────────────────────────────

const EXTENSION_MAP = {
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",

  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",

  ".py": "Python",
  ".pyw": "Python",

  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",

  ".go": "Go",
  ".rs": "Rust",

  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++",
  ".h": "C",
  ".c": "C",

  ".cs": "C#",
  ".php": "PHP",
  ".rb": "Ruby",
  ".swift": "Swift",
  ".scala": "Scala",
  ".dart": "Dart",
  ".r": "R",
  ".lua": "Lua",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".hs": "Haskell",
  ".clj": "Clojure",
};

// Excluded extensions (docs, config, media, binaries) — do NOT count towards programming languages
const NON_PROGRAMMING_EXTENSIONS = new Set([
  ".md", ".markdown", ".rst", ".txt", ".pdf", ".doc", ".docx",
  ".json", ".yaml", ".yml", ".xml", ".toml", ".ini", ".env",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".css", ".scss", ".sass", ".less", ".html", ".htm",
  ".csv", ".tsv", ".sql", ".graphql", ".proto",
  ".lock", ".map", ".log", ".zip", ".tar", ".gz",
]);

// Directories to ignore during language analysis
const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".github", "dist", "build", "out",
  ".next", ".nuxt", ".svelte-kit", "venv", ".venv", "env",
  "__pycache__", ".pytest_cache", "coverage", ".cache",
  "vendor", "target", "bin", "obj", "tmp", "temp",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Safely reads and parses a JSON file from disk.
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
 * Safely reads text from a file on disk.
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
 * Normalizes file tree paths and filters out ignored directory paths.
 * @param {Array<{ path: string, type?: string, size?: number }>} fileTree
 * @returns {Array<{ path: string, filename: string, ext: string, size: number }>}
 */
const normalizeTree = (fileTree = []) => {
  const result = [];
  for (const node of fileTree) {
    if (!node || !node.path) continue;

    const normalizedPath = node.path.replace(/\\/g, "/");
    const segments = normalizedPath.split("/");

    // Skip ignored directories
    const hasIgnoredDir = segments.some((s, idx) => {
      if (idx === segments.length - 1) return false;
      return IGNORED_DIRS.has(s.toLowerCase());
    });
    if (hasIgnoredDir) continue;

    const filename = segments[segments.length - 1];
    const ext = filename.includes(".") ? `.${filename.split(".").pop().toLowerCase()}` : "";

    result.push({
      path: normalizedPath,
      filename: filename.toLowerCase(),
      ext,
      size: node.size || 0,
    });
  }
  return result;
};

// ── Main Detection Function ───────────────────────────────────────────────────

/**
 * Detects the primary language, secondary languages, frameworks, and confidence
 * score for a repository file tree.
 *
 * @param {Array<{ path: string, type?: string, size?: number }>} fileTree
 * @param {string|null} [repoRoot=null] - Absolute path to extracted disk directory (optional)
 * @returns {{
 *   primaryLanguage: string|null,
 *   secondaryLanguages: string[],
 *   frameworks: string[],
 *   confidence: number
 * }}
 */
export const detectProjectLanguage = (fileTree = [], repoRoot = null) => {
  const files = normalizeTree(fileTree);
  const pathSet = new Set(files.map((f) => f.path.toLowerCase()));
  const filenameSet = new Set(files.map((f) => f.filename));

  const languageCounts = {};
  const languageSizes = {};
  let totalProgrammingFiles = 0;
  let totalProgrammingBytes = 0;

  // ────────────────────────────────────────────────────────────────────────────
  // SIGNAL 1: File Extension Analysis
  // ────────────────────────────────────────────────────────────────────────────
  for (const file of files) {
    if (!file.ext || NON_PROGRAMMING_EXTENSIONS.has(file.ext)) continue;

    const lang = EXTENSION_MAP[file.ext];
    if (lang) {
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      languageSizes[lang] = (languageSizes[lang] || 0) + (file.size || 100);
      totalProgrammingFiles++;
      totalProgrammingBytes += (file.size || 100);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SIGNAL 2: Manifest & Configuration Analysis
  // ────────────────────────────────────────────────────────────────────────────
  const manifestSignals = new Set();
  const detectedFrameworks = new Set();

  // JavaScript / TypeScript Manifests
  if (filenameSet.has("package.json")) {
    manifestSignals.add("JavaScript");

    if (filenameSet.has("tsconfig.json") || pathSet.has("tsconfig.json")) {
      manifestSignals.add("TypeScript");
    }

    if (repoRoot) {
      const pkg = safeReadJson(path.join(repoRoot, "package.json"));
      if (pkg) {
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps.typescript || allDeps["@types/node"]) manifestSignals.add("TypeScript");

        if (allDeps.react) detectedFrameworks.add("React");
        if (allDeps.next) detectedFrameworks.add("Next.js");
        if (allDeps.vue || allDeps["@vue/core"]) detectedFrameworks.add("Vue");
        if (allDeps.nuxt) detectedFrameworks.add("Nuxt");
        if (allDeps["@angular/core"]) detectedFrameworks.add("Angular");
        if (allDeps.svelte) detectedFrameworks.add("Svelte");
        if (allDeps.express) detectedFrameworks.add("Express.js");
        if (allDeps.fastify) detectedFrameworks.add("Fastify");
        if (allDeps.nestjs || allDeps["@nestjs/core"]) detectedFrameworks.add("NestJS");
      }
    } else {
      // Inferred from file tree paths when repoRoot is null (e.g. GitHub API tree)
      if (files.some((f) => f.ext === ".ts" || f.ext === ".tsx")) manifestSignals.add("TypeScript");
      if (files.some((f) => f.ext === ".jsx" || f.ext === ".tsx")) detectedFrameworks.add("React");
    }
  }

  // Python Manifests
  if (
    filenameSet.has("requirements.txt") ||
    filenameSet.has("pyproject.toml") ||
    filenameSet.has("pipfile") ||
    filenameSet.has("setup.py")
  ) {
    manifestSignals.add("Python");

    if (repoRoot) {
      const reqText = (
        safeReadText(path.join(repoRoot, "requirements.txt")) +
        "\n" +
        safeReadText(path.join(repoRoot, "pyproject.toml"))
      ).toLowerCase();

      if (reqText.includes("django")) detectedFrameworks.add("Django");
      if (reqText.includes("flask")) detectedFrameworks.add("Flask");
      if (reqText.includes("fastapi")) detectedFrameworks.add("FastAPI");
    }
  }

  // Java / Kotlin Manifests
  if (filenameSet.has("pom.xml") || filenameSet.has("build.gradle") || filenameSet.has("build.gradle.kts")) {
    manifestSignals.add("Java");
    if (filenameSet.has("build.gradle.kts") || files.some((f) => f.ext === ".kt")) {
      manifestSignals.add("Kotlin");
    }

    if (repoRoot) {
      const buildText = (
        safeReadText(path.join(repoRoot, "pom.xml")) +
        "\n" +
        safeReadText(path.join(repoRoot, "build.gradle")) +
        "\n" +
        safeReadText(path.join(repoRoot, "build.gradle.kts"))
      ).toLowerCase();

      if (buildText.includes("spring-boot") || buildText.includes("springframework")) {
        detectedFrameworks.add("Spring Boot");
      }
    }
  }

  // Go Manifests
  if (filenameSet.has("go.mod")) {
    manifestSignals.add("Go");
    if (repoRoot) {
      const goModText = safeReadText(path.join(repoRoot, "go.mod")).toLowerCase();
      if (goModText.includes("gin-gonic/gin")) detectedFrameworks.add("Gin");
      if (goModText.includes("labstack/echo")) detectedFrameworks.add("Echo");
      if (goModText.includes("gofiber/fiber")) detectedFrameworks.add("Fiber");
    }
  }

  // Rust Manifests
  if (filenameSet.has("cargo.toml")) {
    manifestSignals.add("Rust");
    if (repoRoot) {
      const cargoText = safeReadText(path.join(repoRoot, "Cargo.toml")).toLowerCase();
      if (cargoText.includes("actix")) detectedFrameworks.add("Actix");
      if (cargoText.includes("axum")) detectedFrameworks.add("Axum");
      if (cargoText.includes("rocket")) detectedFrameworks.add("Rocket");
    }
  }

  // PHP Manifests
  if (filenameSet.has("composer.json")) {
    manifestSignals.add("PHP");
    if (repoRoot) {
      const composerPkg = safeReadJson(path.join(repoRoot, "composer.json"));
      if (composerPkg) {
        const deps = { ...composerPkg.require, ...composerPkg["require-dev"] };
        if (deps["laravel/framework"]) detectedFrameworks.add("Laravel");
        if (deps["symfony/symfony"]) detectedFrameworks.add("Symfony");
      }
    }
  }

  // Ruby Manifests
  if (filenameSet.has("gemfile")) {
    manifestSignals.add("Ruby");
    if (repoRoot) {
      const gemText = safeReadText(path.join(repoRoot, "Gemfile")).toLowerCase();
      if (gemText.includes("rails")) detectedFrameworks.add("Rails");
      if (gemText.includes("sinatra")) detectedFrameworks.add("Sinatra");
    }
  }

  // C# Manifests
  if (files.some((f) => f.ext === ".csproj" || f.ext === ".sln")) {
    manifestSignals.add("C#");
    detectedFrameworks.add("ASP.NET");
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SIGNAL 3 & 4: Language Ranking & Confidence Score Calculation
  // ────────────────────────────────────────────────────────────────────────────

  // Rank languages based on weighted file counts + size + manifest boosts
  const scoredLanguages = [];

  const candidateLanguages = new Set([
    ...Object.keys(languageCounts),
    ...manifestSignals,
  ]);

  if (candidateLanguages.size === 0) {
    return {
      primaryLanguage: null,
      secondaryLanguages: [],
      frameworks: [...detectedFrameworks],
      confidence: 0,
    };
  }

  for (const lang of candidateLanguages) {
    const fileCount = languageCounts[lang] || 0;
    const fileBytes = languageSizes[lang] || 0;
    const hasManifest = manifestSignals.has(lang);

    // Compute relative proportions
    const fileRatio = totalProgrammingFiles > 0 ? fileCount / totalProgrammingFiles : 0;
    const bytesRatio = totalProgrammingBytes > 0 ? fileBytes / totalProgrammingBytes : 0;

    // Combined score calculation
    let score = (fileRatio * 0.5) + (bytesRatio * 0.3) + (hasManifest ? 0.35 : 0);

    // Special preference for TypeScript over JavaScript if TypeScript source files exist
    if (lang === "TypeScript" && fileCount > 0) {
      score += 0.15;
    }

    scoredLanguages.push({
      language: lang,
      score,
      fileCount,
      hasManifest,
    });
  }

  // Sort descending by score
  scoredLanguages.sort((a, b) => b.score - a.score);

  const primaryObj = scoredLanguages[0];
  const primaryLanguage = primaryObj ? primaryObj.language : null;

  // Secondary languages: other languages with significant file presence (>= 15% ratio or >= 2 files)
  const secondaryLanguages = scoredLanguages
    .slice(1)
    .filter((item) => item.fileCount >= 2 || item.score >= 0.15)
    .map((item) => item.language);

  // ────────────────────────────────────────────────────────────────────────────
  // Confidence Score Calculation (0.00 to 0.98)
  // ────────────────────────────────────────────────────────────────────────────
  let confidence = 0;

  if (primaryLanguage) {
    let baseConfidence = 0.5;

    // Boost if manifest is present
    if (primaryObj.hasManifest) {
      baseConfidence += 0.3;
    }

    // Boost if frameworks matching ecosystem exist
    if (detectedFrameworks.size > 0) {
      baseConfidence += 0.1;
    }

    // Boost if dominant file count ratio
    const totalFilesForPrimary = primaryObj.fileCount;
    if (totalProgrammingFiles > 0) {
      const primaryRatio = totalFilesForPrimary / totalProgrammingFiles;
      baseConfidence += (primaryRatio * 0.08);
    }

    // Cap confidence at 0.98 to follow non-arbitrary scoring rules
    confidence = Math.min(0.98, Math.round(baseConfidence * 100) / 100);
  }

  return {
    primaryLanguage,
    secondaryLanguages,
    frameworks: [...detectedFrameworks],
    confidence,
  };
};
