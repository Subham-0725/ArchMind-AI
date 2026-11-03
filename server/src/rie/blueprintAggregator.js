// server/src/rie/blueprintAggregator.js
//
// Repository Intelligence Engine — Repository Blueprint Aggregator
//
// Combines static intelligence outputs (File Tree, Language Detection, Tech Stack,
// Capability Matrix, Database Schema, and Tree-sitter AST Structural Data) into a normalized,
// deduplicated, versioned JSON blueprint.
//
// Includes token-budget context optimization and strict schema validation.

import { validateBlueprint, isValidBlueprint } from "./validation/blueprintValidator.js";

const DEFAULT_MAX_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;

/**
 * Normalizes relative paths to use standard forward slashes.
 */
function normalizePath(p) {
  if (!p) return "";
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Deduplicates array of objects by key generator.
 */
function deduplicate(items, keyFn) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

/**
 * Aggregates all static RIE intelligence into a compact, validated Repository Blueprint.
 *
 * @param {Object} projectData
 * @param {string} [projectData.projectId] - Project ID
 * @param {string} [projectData.name] - Project name
 * @param {string} [projectData.source="zip"] - Ingestion source ("zip" | "github")
 * @param {string} [projectData.repositoryUrl] - Repository URL
 * @param {string} [projectData.branch="main"] - Branch name
 * @param {string} [projectData.commitSha] - Commit SHA or content fingerprint
 * @param {number} [projectData.analysisVersion=1] - Analysis version counter
 * @param {Array} [projectData.tree=[]] - File tree
 * @param {Object} [projectData.techStack={}] - Tech stack
 * @param {string} [projectData.primaryLanguage="Unknown"] - Primary language
 * @param {Array} [projectData.secondaryLanguages=[]] - Secondary languages
 * @param {Object} [projectData.capabilities={}] - Smart relevance capabilities
 * @param {Object} [projectData.ast={}] - Tree-sitter AST extraction
 * @param {Object} [projectData.database=null] - Extracted database schema
 * @param {Array} [projectData.securityFindings=[]] - Masked secret scan findings
 * @param {Object} [projectData.securitySummary={}] - Security findings summary
 * @param {Object} [options={}]
 * @param {number} [options.maxTokens=8000] - Token budget cap
 * @param {boolean} [options.validate=true] - Run schema validation
 * @returns {Object} Normalized, validated Repository Blueprint
 */
export function aggregateBlueprint(projectData = {}, options = {}) {
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  const {
    projectId = null,
    name = "Unnamed Project",
    source = "unknown",
    repositoryUrl = null,
    branch = "main",
    commitSha = null,
    analysisVersion = 1,
    tree = [],
    techStack = { languages: [], frameworks: [], databases: [], devops: [] },
    primaryLanguage = "Unknown",
    secondaryLanguages = [],
    capabilities = {
      hasDatabase: false,
      hasApis: false,
      hasDevops: false,
      hasSecuritySensitiveCode: false,
      details: {},
    },
    ast = {},
    database = null,
    securityFindings = [],
    securitySummary = {},
  } = projectData;

  // 1. Process Structure (Filter noise directories and compact fields)
  const rawFiles = Array.isArray(tree) ? tree : [];
  const structure = rawFiles
    .filter((f) => f && f.path)
    .map((f) => {
      const normPath = normalizePath(f.path);
      const ext = normPath.includes(".") ? `.${normPath.split(".").pop().toLowerCase()}` : "";
      const fileName = normPath.split("/").pop() || "";
      return {
        path: normPath,
        filePath: normPath,
        fileName,
        extension: ext,
        type: f.type || "file",
        isDirectory: f.type === "dir",
        size: typeof f.size === "number" ? f.size : 0,
      };
    });

  // 2. Process AST Data with Deduplication
  const astData = ast || {};

  const entryPoints = deduplicate(astData.entryPoints || [], (e) => `${normalizePath(e.file)}:${e.type}`).map(
    (e) => ({
      file: normalizePath(e.file),
      type: e.type || "entrypoint",
    })
  );

  const internalDeps = deduplicate(
    (astData.dependencies?.internal || []).map((d) => ({
      from: normalizePath(d.from),
      to: normalizePath(d.to),
    })),
    (d) => `${d.from}->${d.to}`
  );

  const externalDeps = deduplicate(
    (astData.dependencies?.external || []).map((d) => ({
      from: normalizePath(d.from),
      package: d.package,
    })),
    (d) => `${d.from}:${d.package}`
  );

  const rawRoutes = Array.isArray(projectData.apiRoutes) && projectData.apiRoutes.length > 0
    ? projectData.apiRoutes
    : (astData.routes || []);

  const routes = deduplicate(
    rawRoutes.map((r) => ({
      routeId: r.routeId || null,
      file: normalizePath(r.sourceFile || r.file),
      framework: r.framework || "Express",
      method: (r.method || "GET").toUpperCase(),
      path: r.path || "/",
      handler: r.handlerName || r.handler || null,
      line: r.lineRange?.startLine || r.line || 1,
      middleware: r.middleware || [],
      params: r.params || [],
      isAuthProtected: Boolean(r.isAuthProtected),
      confidence: r.confidence || "high",
    })),
    (r) => `${r.file}:${r.method}:${r.path}:${r.line}`
  );

  const models = deduplicate(
    (astData.models || []).map((m) => ({
      file: normalizePath(m.file),
      name: m.name,
      framework: m.framework || "ORM",
      line: m.line || 1,
    })),
    (m) => `${m.file}:${m.name}`
  );

  const classes = deduplicate(
    (astData.classes || []).map((c) => ({
      file: normalizePath(c.file),
      name: c.name,
      superClass: c.superClass || null,
      methods: c.methods || [],
      line: c.line || 1,
    })),
    (c) => `${c.file}:${c.name}`
  );

  const functions = deduplicate(
    (astData.functions || []).map((f) => ({
      file: normalizePath(f.file),
      name: f.name,
      params: f.params || [],
      isAsync: Boolean(f.isAsync),
      line: f.line || 1,
    })),
    (f) => `${f.file}:${f.name}`
  );

  // 3. Normalize database schema (strip noise, limit for token budget)
  let databaseSchema = null;
  if (database && Array.isArray(database.entities) && database.entities.length > 0) {
    databaseSchema = {
      type: database.type || "Unknown",
      entities: database.entities.map((e) => ({
        name: e.name,
        sourceFile: normalizePath(e.sourceFile || ""),
        fields: Array.isArray(e.fields) ? e.fields : [],
      })),
      relationships: Array.isArray(database.relationships) ? database.relationships : [],
    };
  }

  // 4. Assemble Base Blueprint Object
  const timestamp = new Date().toISOString();
  let blueprint = {
    version: 1,
    generatedAt: timestamp,
    metadata: {
      projectId,
      name,
      projectName: name,
      source,
      sourceType: source,
      repositoryUrl,
      branch,
      commitSha,
      analysisVersion,
      analyzedAt: timestamp,
      primaryLanguage: primaryLanguage || "Unknown",
      secondaryLanguages: secondaryLanguages || [],
      techStack,
    },
    capabilities,
    entryPoints,
    structure,
    dependencies: {
      internal: internalDeps,
      external: externalDeps,
    },
    routes,
    models,
    classes,
    functions,
    database: databaseSchema,
    api: {
      routes,
      httpMethods: Array.from(new Set(routes.map((r) => r.method))),
      routePaths: Array.from(new Set(routes.map((r) => r.path))),
      handlerFiles: Array.from(new Set(routes.map((r) => r.file))),
      frameworks: Array.from(new Set(routes.map((r) => r.framework).filter(Boolean))),
      authProtectedCount: routes.filter((r) => r.isAuthProtected).length,
    },
    architecture: {
      entryPoints,
      components: [
        ...(entryPoints.length > 0 ? [{ name: "Entrypoint", files: entryPoints.map((e) => e.file) }] : []),
        ...(models.length > 0 ? [{ name: "DatabaseModels", count: models.length }] : []),
        ...(routes.length > 0 ? [{ name: "ApiRoutes", count: routes.length }] : []),
      ],
    },
    security: {
      findings: securityFindings || [],
      totalFindings: (securityFindings || []).length,
      summary: securitySummary || {},
    },
    tokenEstimate: 0,
    isBudgetTruncated: false,
  };

  // 5. Token Budget Optimization & Truncation Strategy
  let jsonString = JSON.stringify(blueprint);
  let charLength = jsonString.length;

  if (charLength > maxChars) {
    blueprint.isBudgetTruncated = true;

    // Step A: Compact structure (keep top-level files/dirs and max 2 levels)
    blueprint.structure = structure.filter((item) => item.path.split("/").length <= 3);
    jsonString = JSON.stringify(blueprint);
    charLength = jsonString.length;

    // Step B: Limit functions to top 50 if still over budget
    if (charLength > maxChars && blueprint.functions.length > 50) {
      blueprint.functions = blueprint.functions.slice(0, 50);
      jsonString = JSON.stringify(blueprint);
      charLength = jsonString.length;
    }

    // Step C: Limit classes and internal dependencies if still over budget
    if (charLength > maxChars) {
      blueprint.classes = blueprint.classes.slice(0, 30);
      blueprint.dependencies.internal = blueprint.dependencies.internal.slice(0, 40);
      jsonString = JSON.stringify(blueprint);
      charLength = jsonString.length;
    }

    // Step D: Limit database entity fields to 20 per entity if still over budget (PRESERVE entity names)
    if (charLength > maxChars && blueprint.database?.entities) {
      blueprint.database.entities = blueprint.database.entities.map((e) => ({
        ...e,
        fields: e.fields.slice(0, 20),
      }));
      jsonString = JSON.stringify(blueprint);
      charLength = jsonString.length;
    }

    // Step E: Omit functions entirely if still over budget (preserving routes, models, database, capabilities)
    if (charLength > maxChars) {
      blueprint.functions = [];
      jsonString = JSON.stringify(blueprint);
    }
  }

  // Final Token Estimate
  blueprint.tokenEstimate = Math.ceil(JSON.stringify(blueprint).length / CHARS_PER_TOKEN);

  // Optional Schema Validation check
  if (options.validate !== false) {
    const valResult = isValidBlueprint(blueprint);
    if (!valResult.valid) {
      console.warn("[blueprintAggregator] Blueprint validation warnings:", valResult.errors);
    }
  }

  return blueprint;
}
