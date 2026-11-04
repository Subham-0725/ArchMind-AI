// server/src/services/reports/reportData.service.js
//
// Report Data Aggregation & Preparation Service for ArchMind AI.
// Consolidates repository metadata, AST architecture metrics, ERD schema entities,
// API route definitions, security audit findings, AI code reviews, and DevOps artifacts
// into a normalized, redacted, immutable report data model.

import mongoose from "mongoose";
import Project from "../../models/Project.js";
import SecurityFinding from "../../models/SecurityFinding.js";
import SecurityAudit from "../../models/SecurityAudit.js";
import DevOpsArtifact from "../../models/DevOpsArtifact.js";
import { redactSecrets, redactDeep } from "../../rie/security/secretRedactor.js";

/**
 * Sanitizes and cleans plain text string for PDF presentation.
 * Strips non-printable control characters and redacts secrets.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanText(text) {
  if (!text || typeof text !== "string") return "";
  const redacted = redactSecrets(text);
  return redacted.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Calculates an objective 0–100 repository health score based on metrics.
 *
 * @param {Object} metrics
 * @returns {{ score: number, label: string, color: string, reason: string }}
 */
function calculateHealthScore({
  severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 },
  hasArchitecture = false,
  hasDevops = false,
  hasTests = false,
  totalFiles = 0,
}) {
  let score = 100;

  // Deductions for security vulnerabilities
  score -= Math.min(50, (severityCounts.Critical || 0) * 20);
  score -= Math.min(25, (severityCounts.High || 0) * 10);
  score -= Math.min(15, (severityCounts.Medium || 0) * 3);
  score -= Math.min(5, (severityCounts.Low || 0) * 1);

  // If critical vulnerabilities exist, health score cannot exceed 48
  if ((severityCounts.Critical || 0) >= 2) {
    score = Math.min(score, 45);
  } else if ((severityCounts.Critical || 0) === 1) {
    score = Math.min(score, 58);
  }

  // Deductions for missing modern engineering baselines
  if (!hasDevops) score -= 8;
  if (!hasArchitecture) score -= 5;
  if (!hasTests && totalFiles > 5) score -= 7;

  // Clamp score
  score = Math.max(20, Math.min(100, Math.round(score)));

  let label = "Excellent";
  let color = "#16a34a"; // Green
  let reason = "High security compliance and architectural structure.";

  if (score < 50) {
    label = "Needs Immediate Attention";
    color = "#dc2626"; // Red
    reason = "Critical security vulnerabilities or hardcoded secrets detected.";
  } else if (score < 70) {
    label = "Moderate Risk";
    color = "#d97706"; // Amber
    reason = "High-severity findings or missing deployment configurations present.";
  } else if (score < 85) {
    label = "Good";
    color = "#0891b2"; // Cyan
    reason = "Solid codebase posture with minor quality improvements recommended.";
  }

  return { score, label, color, reason };
}

/**
 * Scans repository tree nodes to extract top directories, manifests, and monorepo modules.
 *
 * @param {Array<Object>} tree
 * @returns {Object}
 */
function analyzeTreeStructure(tree = []) {
  if (!Array.isArray(tree) || tree.length === 0) {
    return {
      directories: [],
      manifests: [],
      modules: [],
      detectedDevOpsFiles: [],
      hasTests: false,
      entryPoints: [],
    };
  }

  const dirCounts = new Map();
  const manifests = [];
  const detectedDevOpsFiles = [];
  const modulesMap = new Map();
  let hasTests = false;

  const KNOWN_MANIFESTS = new Set([
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "pom.xml",
    "build.gradle",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "tsconfig.json",
    ".env",
    ".env.example",
    "Makefile",
    "README.md",
  ]);

  for (const node of tree) {
    const rawPath = (node.path || "").replace(/\\/g, "/");
    const basename = rawPath.split("/").pop();

    if (KNOWN_MANIFESTS.has(basename)) {
      if (!manifests.includes(rawPath)) manifests.push(rawPath);
    }

    // Detect source DevOps files
    if (
      basename === "Dockerfile" ||
      basename === "docker-compose.yml" ||
      basename === "docker-compose.yaml" ||
      rawPath.includes(".github/workflows") ||
      rawPath.includes("k8s/") ||
      rawPath.includes("helm/")
    ) {
      if (!detectedDevOpsFiles.includes(rawPath)) detectedDevOpsFiles.push(rawPath);
    }

    // Detect test harness
    if (
      rawPath.includes("test") ||
      rawPath.includes("__tests__") ||
      rawPath.includes(".spec.") ||
      rawPath.includes(".test.")
    ) {
      hasTests = true;
    }

    // Detect monorepo sub-modules (e.g. Backend/package.json, Frontend/package.json)
    const segments = rawPath.split("/");
    if (segments.length > 1) {
      const topDir = segments[0] + "/";
      dirCounts.set(topDir, (dirCounts.get(topDir) || 0) + 1);

      if (segments.length === 2 && segments[1] === "package.json") {
        const modName = segments[0];
        const isBackend = modName.toLowerCase().includes("back") || modName.toLowerCase().includes("server") || modName.toLowerCase().includes("api");
        const isFrontend = modName.toLowerCase().includes("front") || modName.toLowerCase().includes("client") || modName.toLowerCase().includes("web");
        modulesMap.set(modName, {
          name: modName,
          path: `${modName}/`,
          type: isBackend ? "Backend API Service" : isFrontend ? "Frontend Client Application" : "Sub-module",
        });
      }
    }
  }

  const directories = Array.from(dirCounts.entries())
    .map(([path, count]) => {
      const lower = path.toLowerCase();
      let role = "General Module";
      if (lower.includes("back") || lower.includes("server") || lower.includes("api")) role = "Backend Services";
      else if (lower.includes("front") || lower.includes("client") || lower.includes("web") || lower.includes("ui")) role = "Frontend Client";
      else if (lower.includes("model") || lower.includes("schema") || lower.includes("db")) role = "Data Models & Schema";
      else if (lower.includes("route") || lower.includes("controller")) role = "API Controllers & Routing";
      else if (lower.includes("test")) role = "Automated Test Suite";
      else if (lower.includes("config") || lower.includes("util")) role = "Shared Utilities & Configuration";
      return { path, count, role };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const modules = Array.from(modulesMap.values());

  return {
    directories,
    manifests,
    modules,
    detectedDevOpsFiles,
    hasTests,
  };
}

/**
 * Generates tailored, actionable recommendations grounded strictly in repository findings.
 *
 * @param {Object} data
 * @returns {Array<Object>}
 */
function generateActionableRecommendations(data) {
  const list = [];
  const { security, devops, database, apiRoutes, structure } = data;

  // 1. Critical Hardcoded Secrets (P0)
  const secretFindings = security.findings.filter((f) => f.source === "secret_scanner" || f.severity === "Critical");
  if (secretFindings.length > 0) {
    const locs = secretFindings.slice(0, 2).map((f) => `${f.filePath}:${f.startLine}`).join(", ");
    list.push({
      priority: "P0 - Critical",
      category: "Secret Security",
      observation: `Detected ${secretFindings.length} hardcoded credential(s) in repository (e.g. ${locs}).`,
      impact: "Exposed credentials in version control allow unauthorized access to production infrastructure and databases.",
      action: "Immediately rotate and invalidate the exposed credentials in their upstream providers. Remove plaintext secret files from version control and inject values via environment variables.",
    });
  }

  // 2. High-Severity AST Vulnerabilities (P1)
  const astHighFindings = security.findings.filter((f) => f.source === "ast_analyzer" && f.severity === "High");
  if (astHighFindings.length > 0) {
    const locs = astHighFindings.slice(0, 2).map((f) => `${f.filePath}:${f.startLine}`).join(", ");
    list.push({
      priority: "P1 - High",
      category: "Code Vulnerability",
      observation: `Detected ${astHighFindings.length} high-severity code pattern(s) (e.g. ${locs}).`,
      impact: "Patterns such as dynamic code execution or unescaped query assembly expose the application to injection or remote exploit.",
      action: "Replace dangerous constructs (such as eval or string-concatenated queries) with safe parameterized abstractions and sandboxed execution.",
    });
  }

  // 3. DevOps & Deployment Baseline (P1 or P2)
  if (!devops.hasDetectedDevops && !devops.hasGeneratedDevops) {
    list.push({
      priority: "P2 - Medium",
      category: "DevOps & CI/CD",
      observation: "No containerization (Dockerfile) or CI/CD automated workflow was detected in the repository.",
      impact: "Manual deployment and testing creates configuration drift and increases the risk of production release failures.",
      action: "Generate a multi-stage Dockerfile and GitHub Actions CI workflow via the ArchMind DevOps Center to automate build verification.",
    });
  } else if (devops.hasGeneratedDevops) {
    const invalidArtifacts = devops.generatedArtifacts.filter((a) => !a.valid);
    if (invalidArtifacts.length > 0) {
      list.push({
        priority: "P1 - High",
        category: "DevOps Validation",
        observation: `${invalidArtifacts.length} generated DevOps manifest(s) have lint or schema validation warnings.`,
        impact: "Manifests with validation warnings may fail during Kubernetes deployment or Docker container builds.",
        action: "Review the validation errors in the DevOps Center and resolve configuration warnings before cluster deployment.",
      });
    }
  }

  // 4. API Authentication Governance (P2)
  if (apiRoutes.hasApiRoutes) {
    const unauthenticatedMutations = apiRoutes.routes.filter(
      (r) => r.authRequired === false && ["POST", "PUT", "DELETE", "PATCH"].includes(r.method)
    );
    if (unauthenticatedMutations.length > 0) {
      const examples = unauthenticatedMutations.slice(0, 2).map((r) => `${r.method} ${r.path}`).join(", ");
      list.push({
        priority: "P2 - Medium",
        category: "API Governance",
        observation: `${unauthenticatedMutations.length} data-mutation endpoint(s) appear unauthenticated (e.g. ${examples}).`,
        impact: "Publicly accessible state-modifying endpoints are vulnerable to unauthorized data tampering or denial-of-service.",
        action: "Enforce JWT authentication middleware or role-based access control on all state-modifying routes.",
      });
    }
  }

  // 5. Database Performance & Indexing (P3)
  if (database.hasDatabase) {
    const unindexedModels = database.entities.filter(
      (e) => !e.fields?.some((f) => f.isPrimary || f.isUnique || f.isForeign)
    );
    if (unindexedModels.length > 0) {
      const modelNames = unindexedModels.slice(0, 2).map((m) => m.name).join(", ");
      list.push({
        priority: "P3 - Low",
        category: "Database Indexing",
        observation: `Models (${modelNames}) do not specify primary or foreign-key indexes.`,
        impact: "Unindexed query filters trigger full-collection scans as data scales, increasing query latency.",
        action: "Define explicit Mongoose or SQL indexes on frequently queried fields and foreign-key references.",
      });
    }
  }

  // 6. Test Suite Coverage (P2)
  if (!structure.hasTests && data.overview.totalFiles > 5) {
    list.push({
      priority: "P2 - Medium",
      category: "Quality Assurance",
      observation: "No automated test suite (__tests__, spec, or unit tests) was detected in the repository.",
      impact: "Lack of automated test coverage impedes continuous delivery and elevates regression risk during refactoring.",
      action: "Integrate a test runner (such as Jest, Vitest, or Mocha) and implement unit tests for core controllers and models.",
    });
  }

  // 7. General Maintenance (Fallback if clean)
  if (list.length === 0) {
    list.push({
      priority: "P3 - Low",
      category: "Dependency Maintenance",
      observation: "Repository analysis identified clean security posture and baseline architecture.",
      impact: "Third-party dependencies require regular patching against emerging CVE advisories.",
      action: "Configure automated vulnerability scanning (Dependabot) and keep lockfiles updated.",
    });
    list.push({
      priority: "P3 - Low",
      category: "Observability",
      observation: "Production services require unified telemetry and structured logging.",
      impact: "Unstructured logs make diagnosing distributed production incidents difficult.",
      action: "Implement structured JSON logging (e.g. Winston or Pino) across all controller boundaries.",
    });
  }

  return list;
}

/**
 * Builds a clean visual architecture topology diagram representation.
 *
 * @param {Object} topology
 * @param {Array<Object>} tiers
 * @returns {string}
 */
function buildTopologyDiagramText(tiers) {
  const fe = tiers.frontend.length > 0 ? tiers.frontend.map((n) => n.label).join(", ") : "Client Application";
  const be = tiers.backend.length > 0 ? tiers.backend.map((n) => n.label).join(", ") : "Backend Services";
  const db = tiers.database.length > 0 ? tiers.database.map((n) => n.label).join(", ") : "Data Storage";

  return `[ Frontend Tier: ${fe} ] ──(HTTP/REST)──> [ Backend Tier: ${be} ] ──(ORM/ODM)──> [ Database Tier: ${db} ]`;
}

/**
 * Aggregates, extracts, sanitizes, and prepares full report data for a project.
 *
 * @param {Object|string} projectOrId - Project document, plain object, or Project ID
 * @param {Object} [options] - Optional overrides or pre-fetched child collections
 * @returns {Promise<Object>} Clean, structured report data payload
 */
export async function collectReportData(projectOrId, options = {}) {
  let project = projectOrId;

  // Resolve project if ID was provided
  if (typeof project === "string" || (project && project instanceof mongoose.Types.ObjectId)) {
    project = await Project.findById(project).lean();
  } else if (project && typeof project.toObject === "function") {
    project = project.toObject();
  }

  if (!project) {
    const err = new Error("Project not found or invalid project parameter.");
    err.status = 404;
    err.code = "PROJECT_NOT_FOUND";
    throw err;
  }

  const projectId = project._id || project.id;

  // 1. Fetch Security Findings
  let rawFindings = options.findings || [];
  if (rawFindings.length === 0 && projectId && mongoose.connection.readyState === 1) {
    try {
      rawFindings = await SecurityFinding.find({ projectId })
        .sort({ severity: 1, startLine: 1 })
        .lean();
    } catch {
      rawFindings = project.securityFindings || [];
    }
  } else if (rawFindings.length === 0) {
    rawFindings = project.securityFindings || [];
  }

  // 2. Fetch Security Audit
  let rawAudit = options.audit || null;
  if (!rawAudit && projectId && mongoose.connection.readyState === 1) {
    try {
      rawAudit = await SecurityAudit.findOne({
        projectId,
        analysisVersion: project.analysisVersion || 1,
      }).lean();
      if (!rawAudit) {
        rawAudit = await SecurityAudit.findOne({ projectId }).sort({ createdAt: -1 }).lean();
      }
    } catch {
      rawAudit = null;
    }
  }

  // 3. Fetch DevOps Artifacts
  let rawDevOps = options.devopsArtifacts || [];
  if (rawDevOps.length === 0 && projectId && mongoose.connection.readyState === 1) {
    try {
      rawDevOps = await DevOpsArtifact.find({
        projectId,
        superseded: false,
      })
        .sort({ artifactType: 1 })
        .lean();
    } catch {
      rawDevOps = [];
    }
  }

  // ── Normalize Tech Stack & Overview ─────────────────────────────────────────
  const techStack = project.techStack || {};
  const languagesList = Array.isArray(techStack.languages) && techStack.languages.length > 0
    ? techStack.languages
    : project.primaryLanguage
    ? [project.primaryLanguage]
    : project.github?.language
    ? [project.github.language]
    : [];

  const frameworksList = Array.isArray(techStack.frameworks) ? techStack.frameworks : [];
  const databasesList = Array.isArray(techStack.databases) && techStack.databases.length > 0
    ? techStack.databases
    : project.database?.type
    ? [project.database.type]
    : [];

  const devopsList = Array.isArray(techStack.devops) ? techStack.devops : [];

  const totalFiles = project.stats?.totalFiles || project.tree?.length || 0;
  const totalBytes = project.stats?.totalBytes || project.stats?.totalSize || project.zip?.sizeBytes || 0;
  const totalDirs = project.stats?.totalDirs || 0;
  const topExtensions = Array.isArray(project.stats?.topExtensions) ? project.stats.topExtensions : [];

  // ── Analyze File Tree Structure ─────────────────────────────────────────────
  const structureAnalysis = analyzeTreeStructure(project.tree || []);

  // ── Normalize Security Findings ─────────────────────────────────────────────
  const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };

  const findings = (rawFindings || []).map((f) => {
    const sev = ["Critical", "High", "Medium", "Low"].includes(f.severity) ? f.severity : "Medium";
    severityCounts[sev] = (severityCounts[sev] || 0) + 1;

    // Build risk explanation if missing
    let explanation = cleanText(f.description || f.explanation || "");
    if (!explanation) {
      if (f.source === "secret_scanner") {
        explanation = "Detected plaintext credential or authentication token in source files, which may grant unauthorized access if committed.";
      } else {
        explanation = "Identified statically insecure code construct that violates secure programming practices.";
      }
    }

    // Build concrete remediation if missing
    let recommendation = cleanText(f.recommendation || f.suggestedImprovement || "");
    if (!recommendation) {
      if (f.source === "secret_scanner") {
        recommendation = "Revoke and rotate the exposed secret immediately. Store credentials in environment variables injected via secret management.";
      } else {
        recommendation = "Refactor the flagged statement to use parameterized APIs and secure coding patterns.";
      }
    }

    return {
      ruleId: cleanText(f.ruleId || "security-finding"),
      title: cleanText(f.title || f.ruleId || "Security Finding"),
      severity: sev,
      confidence: f.confidence || "High",
      filePath: cleanText(f.filePath || "unknown"),
      startLine: f.startLine || f.lineNumber || 1,
      endLine: f.endLine || f.startLine || 1,
      description: explanation,
      explanation,
      recommendation,
      source: f.source || "security_scanner",
      category: f.category || "security",
      redactedEvidence: cleanText(f.redactedEvidence || f.evidence || ""),
    };
  }).sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));

  // If project has securitySummary severity counts and findings array was empty, use summary
  if (findings.length === 0 && project.securitySummary?.severityCounts) {
    Object.assign(severityCounts, project.securitySummary.severityCounts);
  }

  // ── Separate Code Review Findings ───────────────────────────────────────────
  let codeReviewItems = findings.filter((f) => f.source === "ai_reviewer");
  if (codeReviewItems.length === 0 && options.codeReview && Array.isArray(options.codeReview.findings)) {
    codeReviewItems = options.codeReview.findings.map((f) => ({
      ...f,
      title: cleanText(f.title),
      filePath: cleanText(f.filePath),
      description: cleanText(f.description || f.explanation),
      recommendation: cleanText(f.recommendation || f.suggestedImprovement),
    }));
  }

  const pureSecurityFindings = findings.filter((f) => f.source !== "ai_reviewer");

  // ── Normalize Database & Schema ─────────────────────────────────────────────
  const rawEntities =
    project.database?.entities ||
    project.database?.models ||
    project.blueprint?.models ||
    [];

  const databaseEntities = (rawEntities || []).map((e) => {
    const fields = (e.fields || e.properties || e.columns || []).map((f) => ({
      name: cleanText(f.name || "field"),
      type: cleanText(f.type || "String"),
      isPrimary: Boolean(f.isPrimary),
      isForeign: Boolean(f.isForeign),
      isRequired: Boolean(f.isRequired || f.required),
      isUnique: Boolean(f.isUnique || f.unique),
      references: cleanText(f.references || ""),
    }));

    return {
      name: cleanText(e.name || "Entity"),
      tableName: cleanText(e.tableName || e.collectionName || `${(e.name || "entity").toLowerCase()}s`),
      fields,
      fieldCount: fields.length,
      indexes: Array.isArray(e.indexes) ? e.indexes : [],
    };
  });

  // Extract explicit declared relationships from model fields (e.g. ref: "User")
  const extractedRelationships = [];
  const seenRelKeys = new Set();

  for (const ent of databaseEntities) {
    for (const f of ent.fields) {
      if (f.references) {
        const key = `${ent.name}->${f.references}`;
        if (!seenRelKeys.has(key)) {
          seenRelKeys.add(key);
          extractedRelationships.push({
            sourceEntity: ent.name,
            targetEntity: f.references,
            type: "Many-to-One",
            foreignKey: f.name,
            status: "Declared Model Reference",
          });
        }
      }
    }
  }

  // Merge with project.database.relationships
  for (const r of project.database?.relationships || []) {
    const src = cleanText(r.sourceEntity || r.from || "");
    const tgt = cleanText(r.targetEntity || r.to || "");
    const key = `${src}->${tgt}`;
    if (!seenRelKeys.has(key) && src && tgt) {
      seenRelKeys.add(key);
      extractedRelationships.push({
        sourceEntity: src,
        targetEntity: tgt,
        type: cleanText(r.type || "One-to-Many"),
        foreignKey: cleanText(r.foreignKey || ""),
        status: "Schema Relationship",
      });
    }
  }

  const hasDatabase = databaseEntities.length > 0;
  const databaseType = cleanText(project.database?.type || databasesList[0] || "Not detected");

  // ── Normalize API Routes ────────────────────────────────────────────────────
  const rawRoutes =
    project.apiRoutes ||
    project.analysisResults?.apiRoutes ||
    project.blueprint?.routes ||
    [];

  const methodBreakdown = { GET: 0, POST: 0, PUT: 0, DELETE: 0, PATCH: 0, OTHER: 0 };

  const apiRoutes = (rawRoutes || []).map((r) => {
    const method = cleanText((r.method || "GET").toUpperCase());
    if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      methodBreakdown[method] = (methodBreakdown[method] || 0) + 1;
    } else {
      methodBreakdown.OTHER = (methodBreakdown.OTHER || 0) + 1;
    }

    return {
      method,
      path: cleanText(r.path || "/"),
      handler: cleanText(r.handler || r.controller || "Controller Handler"),
      filePath: cleanText(r.filePath || r.file || ""),
      line: r.line || r.lineNumber || null,
      authRequired: typeof r.authRequired === "boolean" ? r.authRequired : false,
      description: cleanText(r.description || ""),
    };
  });

  const hasApiRoutes = apiRoutes.length > 0;

  // ── Normalize Architecture & Topology ───────────────────────────────────────
  const topologyNodes = (project.topology?.nodes || []).map((n) => {
    const data = n.data || {};
    return {
      id: cleanText(n.id || ""),
      label: cleanText(data.label || n.label || "Component"),
      description: cleanText(data.description || ""),
      tier: cleanText(data.tier || "backend"),
      technologies: Array.isArray(data.technologies) ? data.technologies.map(cleanText) : [],
    };
  });

  const topologyEdges = (project.topology?.edges || []).map((e) => ({
    id: cleanText(e.id || ""),
    source: cleanText(e.source || ""),
    target: cleanText(e.target || ""),
    label: cleanText(e.label || ""),
  }));

  const entryPoints = (project.blueprint?.entryPoints || project.ast?.entryPoints || []).map((ep) => {
    return cleanText(typeof ep === "string" ? ep : ep.path || ep.name || "");
  }).filter(Boolean);

  const architectureSummary = cleanText(
    project.blueprint?.architecture ||
      project.blueprint?.summary ||
      (project.analysisResults?.architecture?.summary) ||
      (topologyNodes.length > 0 ? "Layered Component Architecture" : "Not detected")
  );

  const hasArchitecture = topologyNodes.length > 0 || entryPoints.length > 0 || (Boolean(project.blueprint?.architecture) && project.blueprint.architecture !== "Not detected");

  const architectureTiers = {
    frontend: topologyNodes.filter((n) => n.tier === "frontend"),
    backend: topologyNodes.filter((n) => n.tier === "backend"),
    database: topologyNodes.filter((n) => n.tier === "database"),
    devops: topologyNodes.filter((n) => n.tier === "devops"),
  };

  const flowDiagramText = buildTopologyDiagramText(architectureTiers);

  // ── Normalize DevOps Artifacts (Detected vs Generated) ──────────────────────
  const generatedDevOpsArtifacts = (rawDevOps || []).map((a) => {
    const lines = (a.content || "").split(/\r?\n/);
    const keyDirectives = lines
      .filter((l) => {
        const trimmed = l.trim();
        return (
          trimmed.startsWith("FROM") ||
          trimmed.startsWith("EXPOSE") ||
          trimmed.startsWith("ENTRYPOINT") ||
          trimmed.startsWith("CMD") ||
          trimmed.startsWith("name:") ||
          trimmed.startsWith("on:") ||
          trimmed.startsWith("apiVersion:") ||
          trimmed.startsWith("kind:")
        );
      })
      .slice(0, 6)
      .map(cleanText);

    return {
      id: cleanText(a._id ? String(a._id) : a.id || ""),
      artifactType: cleanText(a.artifactType || "dockerfile"),
      filePath: cleanText(a.filePath || "Dockerfile"),
      version: a.version || 1,
      valid: Boolean(a.validation?.valid),
      errorCount: (a.validation?.errors || []).length,
      warningCount: (a.validation?.warnings || []).length,
      errors: (a.validation?.errors || []).map(cleanText),
      warnings: (a.validation?.warnings || []).map(cleanText),
      checks: (a.validation?.checks || []).map((c) => ({
        name: cleanText(c.name),
        passed: Boolean(c.passed),
        message: cleanText(c.message),
      })),
      runtime: cleanText(a.metadata?.runtime || ""),
      framework: cleanText(a.metadata?.framework || ""),
      port: a.metadata?.port || null,
      keyDirectives,
      contentExcerpt: cleanText(lines.slice(0, 14).join("\n")),
    };
  });

  const hasDetectedDevops = structureAnalysis.detectedDevOpsFiles.length > 0;
  const hasGeneratedDevops = generatedDevOpsArtifacts.length > 0;
  const hasDevops = hasDetectedDevops || hasGeneratedDevops;

  // ── Calculate Repository Health ─────────────────────────────────────────────
  const health = calculateHealthScore({
    severityCounts,
    hasArchitecture,
    hasDevops,
    hasTests: structureAnalysis.hasTests,
    totalFiles,
  });

  // ── Build Base Report Data Structure ────────────────────────────────────────
  const reportData = {
    metadata: {
      projectId: String(projectId),
      projectName: cleanText(project.name || "Repository"),
      source: cleanText(project.source || "github"),
      repoUrl: cleanText(project.github?.url || (project.zip ? `ZIP Archive: ${project.zip.originalName}` : "Local Repository")),
      defaultBranch: cleanText(project.github?.defaultBranch || "main"),
      analysisVersion: project.analysisVersion || 1,
      generatedAt: new Date().toISOString(),
      status: cleanText(project.status || "completed"),
      license: cleanText(project.github?.license || "Not specified"),
      stars: project.github?.stars || 0,
      forks: project.github?.forks || 0,
      owner: cleanText(project.github?.owner || ""),
    },
    overview: {
      primaryLanguage: cleanText(project.primaryLanguage || languagesList[0] || "Not detected"),
      secondaryLanguages: (project.secondaryLanguages || []).map(cleanText),
      languages: languagesList.map(cleanText),
      frameworks: frameworksList.map(cleanText),
      databases: databasesList.map(cleanText),
      devops: devopsList.map(cleanText),
      totalFiles,
      totalDirs,
      totalBytes,
      totalSizeFormatted: totalBytes > 0 ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB` : "N/A",
      topExtensions,
    },
    health,
    structure: {
      directories: structureAnalysis.directories,
      manifests: structureAnalysis.manifests,
      modules: structureAnalysis.modules,
      detectedDevOpsFiles: structureAnalysis.detectedDevOpsFiles,
      hasTests: structureAnalysis.hasTests,
      entryPoints,
    },
    architecture: {
      hasArchitecture,
      summary: architectureSummary,
      nodes: topologyNodes,
      edges: topologyEdges,
      nodeCount: topologyNodes.length,
      edgeCount: topologyEdges.length,
      tiers: architectureTiers,
      flowDiagramText,
    },
    database: {
      hasDatabase,
      type: databaseType,
      entities: databaseEntities,
      relationships: extractedRelationships,
      entityCount: databaseEntities.length,
      relationshipCount: extractedRelationships.length,
    },
    apiRoutes: {
      hasApiRoutes,
      routes: apiRoutes,
      totalCount: apiRoutes.length,
      methodBreakdown,
    },
    security: {
      hasSecurityFindings: pureSecurityFindings.length > 0,
      totalFindings: pureSecurityFindings.length,
      severityCounts,
      findings: pureSecurityFindings,
      auditStats: {
        filesScanned: rawAudit?.filesScanned || 0,
        filesSkipped: rawAudit?.filesSkipped || 0,
        unsupportedFilesCount: rawAudit?.unsupportedFilesCount || 0,
      },
    },
    codeReview: {
      hasCodeReview: codeReviewItems.length > 0,
      items: codeReviewItems,
      totalItems: codeReviewItems.length,
      overallScore: options.codeReview?.overallScore || 85,
      summary: cleanText(options.codeReview?.summary || "Automated static analysis and code review observations."),
    },
    devops: {
      hasDevops,
      hasDetectedDevops,
      hasGeneratedDevops,
      detectedFiles: structureAnalysis.detectedDevOpsFiles,
      generatedArtifacts: generatedDevOpsArtifacts,
      artifacts: generatedDevOpsArtifacts, // backwards compatibility
      totalArtifacts: generatedDevOpsArtifacts.length,
    },
  };

  // Generate actionable recommendations from normalized data
  reportData.recommendations = generateActionableRecommendations(reportData);

  // Return deeply redacted immutable clone
  return redactDeep(reportData);
}
