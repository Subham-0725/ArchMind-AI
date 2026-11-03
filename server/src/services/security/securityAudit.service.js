// server/src/services/security/securityAudit.service.js
//
// Core Security Audit Service for ArchMind AI
// Orchestrates Layer A (Deterministic Secret Scanner) and Layer B (Tree-sitter AST Analyzer),
// maintains versioned audit results, and synchronizes project-level security summaries.

import fs from "fs";
import path from "path";
import Project from "../../models/Project.js";
import SourceFile from "../../models/SourceFile.js";
import SecurityFinding from "../../models/SecurityFinding.js";
import SecurityAudit from "../../models/SecurityAudit.js";
import { scanFileContent } from "../../rie/security/secretScanner.js";
import { scanFileAst } from "../../rie/security/astSecurityScanner.js";

const SEVERITY_WEIGHT = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export class SecurityAuditService {
  /**
   * Executes a complete deterministic and AST security audit for a project.
   *
   * @param {Object} params
   * @param {Object|string} params.project - Project document or Project ID
   * @param {Object} [params.options]
   * @returns {Promise<{ audit: Object, findings: Array<Object>, totalFindings: number, severityCounts: Object }>}
   */
  async runSecurityScan({ project, options = {} }) {
    let proj = project;
    if (typeof proj === "string" || proj instanceof String) {
      proj = await Project.findById(proj);
    }
    if (!proj || !proj._id) {
      throw new Error("Valid project document is required to execute security scan.");
    }

    const projectId = proj._id;
    const analysisVersion = proj.analysisVersion || 1;
    const startedAt = new Date();

    // 1. Mark SecurityAudit as processing
    let audit = await SecurityAudit.findOne({ projectId, analysisVersion });
    if (!audit) {
      audit = new SecurityAudit({
        projectId,
        analysisVersion,
        status: "processing",
        startedAt,
      });
    } else {
      audit.status = "processing";
      audit.startedAt = startedAt;
      audit.completedAt = null;
    }
    if (typeof audit.save === "function") {
      await audit.save();
    }

    // 2. Collect eligible files with content
    let candidateFiles = [];

    // Attempt to load from MongoDB SourceFile collection (indexed during Phase 1)
    const indexedFiles = await SourceFile.find({
      projectId,
      isBinary: false,
      content: { $ne: null },
    })
      .select("filePath fileName language lineCount content")
      .lean();

    if (indexedFiles && indexedFiles.length > 0) {
      candidateFiles = indexedFiles;
    } else if (proj.extractionPath && fs.existsSync(proj.extractionPath)) {
      // Fallback: Read from local disk extraction folder if present
      const tree = proj.tree || [];
      for (const node of tree) {
        if (!node || node.type === "dir" || !node.path) continue;
        try {
          const fullPath = path.resolve(proj.extractionPath, node.path);
          if (fullPath.startsWith(path.resolve(proj.extractionPath)) && fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, "utf8");
            candidateFiles.push({
              filePath: node.path.replace(/\\/g, "/"),
              fileName: path.basename(node.path),
              content,
            });
          }
        } catch {
          // Skip inaccessible file
        }
      }
    } else if (Array.isArray(proj.tree) && proj.tree.length > 0) {
      // Fallback: Read content attached to tree nodes
      candidateFiles = proj.tree
        .filter((n) => n && n.type !== "dir" && typeof n.content === "string")
        .map((n) => ({
          filePath: n.path.replace(/\\/g, "/"),
          fileName: path.basename(n.path),
          content: n.content,
        }));
    }

    const allFindings = [];
    const unsupportedFiles = [];
    const errors = [];
    let filesScanned = 0;
    let filesSkipped = 0;

    // 3. Execute Layer A (Secret Scanning) & Layer B (AST Analysis)
    for (const file of candidateFiles) {
      const { filePath, content } = file;
      if (!content || typeof content !== "string") {
        filesSkipped++;
        continue;
      }

      filesScanned++;

      // ── Layer A: Deterministic Secret Scanning ───────────────────────────────
      try {
        const secretFindings = scanFileContent(content, filePath);
        for (const sf of secretFindings) {
          allFindings.push({
            ...sf,
            projectId,
            analysisVersion,
          });
        }
      } catch (err) {
        errors.push({ filePath, stage: "secret_scanner", error: err.message });
      }

      // ── Layer B: Tree-sitter AST Security Analysis ───────────────────────────
      try {
        const astResult = scanFileAst(filePath, content);
        if (astResult.status === "completed") {
          for (const af of astResult.findings) {
            allFindings.push({
              ...af,
              projectId,
              analysisVersion,
            });
          }
        } else if (astResult.status === "unsupported") {
          unsupportedFiles.push({
            filePath,
            reason: astResult.reason,
          });
        } else if (astResult.status === "parse_error") {
          errors.push({ filePath, stage: "ast_analyzer", error: astResult.error });
        }
      } catch (err) {
        errors.push({ filePath, stage: "ast_analyzer", error: err.message });
      }
    }

    // 4. Deduplicate findings matching (filePath, startLine, ruleId)
    const seen = new Set();
    const deduplicatedFindings = [];

    for (const f of allFindings) {
      const key = `${f.filePath}:${f.startLine || f.lineNumber}:${f.ruleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicatedFindings.push(f);
      }
    }

    // Sort findings by severity (Critical -> High -> Medium -> Low), then file path
    deduplicatedFindings.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.severity] || 0;
      const weightB = SEVERITY_WEIGHT[b.severity] || 0;
      if (weightB !== weightA) return weightB - weightA;
      return a.filePath.localeCompare(b.filePath);
    });

    // 5. Compile severity tallies
    const severityCounts = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const f of deduplicatedFindings) {
      if (severityCounts[f.severity] !== undefined) {
        severityCounts[f.severity]++;
      }
    }

    // 6. Atomic replacement of persistent SecurityFinding records for this version
    await SecurityFinding.deleteMany({ projectId, analysisVersion });
    if (deduplicatedFindings.length > 0) {
      await SecurityFinding.insertMany(deduplicatedFindings);
    }

    // 7. Complete SecurityAudit metadata
    audit.status = "completed";
    audit.completedAt = new Date();
    audit.totalFindings = deduplicatedFindings.length;
    audit.severityCounts = severityCounts;
    audit.filesScanned = filesScanned;
    audit.filesSkipped = filesSkipped;
    audit.unsupportedFilesCount = unsupportedFiles.length;
    audit.unsupportedFiles = unsupportedFiles;
    audit.errors = errors;
    if (typeof audit.save === "function") {
      await audit.save();
    }

    // 8. Update Project document security artifacts & status
    proj.securityFindings = deduplicatedFindings.map((f) => ({
      category: f.category,
      filePath: f.filePath,
      lineNumber: f.startLine || f.lineNumber,
      severity: f.severity,
      confidence: f.confidence,
      maskedValue: f.maskedValue || f.redactedEvidence || "****",
    }));

    proj.securitySummary = {
      status: "completed",
      totalFindings: deduplicatedFindings.length,
      severityCounts,
      filesScanned,
      unsupportedFilesCount: unsupportedFiles.length,
      lastScannedAt: audit.completedAt,
    };

    if (!proj.analysis) proj.analysis = {};
    if (!proj.analysis.security) proj.analysis.security = {};
    proj.analysis.security.status = "completed";
    proj.analysis.security.completedAt = audit.completedAt;

    if (!proj.analysisResults) proj.analysisResults = {};
    proj.analysisResults.security = {
      totalFindings: deduplicatedFindings.length,
      severityCounts,
      filesScanned,
      unsupportedFilesCount: unsupportedFiles.length,
      status: "completed",
    };

    if (typeof proj.save === "function") {
      await proj.save();
    }

    return {
      audit: audit.toObject ? audit.toObject() : audit,
      findings: deduplicatedFindings,
      totalFindings: deduplicatedFindings.length,
      severityCounts,
    };
  }

  /**
   * Retrieves audit summary and coverage metadata.
   */
  async getSecuritySummary(projectId, analysisVersion = null) {
    const query = { projectId };
    if (analysisVersion) query.analysisVersion = analysisVersion;

    const audit = await SecurityAudit.findOne(query).sort({ analysisVersion: -1 }).lean();
    if (!audit) {
      return {
        status: "idle",
        analysisVersion: analysisVersion || 1,
        totalFindings: 0,
        severityCounts: { Critical: 0, High: 0, Medium: 0, Low: 0 },
        filesScanned: 0,
        filesSkipped: 0,
        unsupportedFilesCount: 0,
        completedAt: null,
      };
    }

    return audit;
  }

  /**
   * Lists findings with filters, pagination, and stable sorting.
   */
  async getFindings({
    projectId,
    analysisVersion = null,
    filters = {},
    page = 1,
    limit = 50,
  }) {
    const query = { projectId };
    if (analysisVersion) {
      query.analysisVersion = analysisVersion;
    }

    if (filters.severity && filters.severity !== "ALL") {
      query.severity = filters.severity;
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.status && filters.status !== "ALL") {
      query.status = filters.status;
    }
    if (filters.source) {
      query.source = filters.source;
    }
    if (filters.ruleId) {
      query.ruleId = filters.ruleId;
    }
    if (filters.filePath) {
      query.filePath = new RegExp(filters.filePath, "i");
    }

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (safePage - 1) * safeLimit;

    const [findings, totalCount] = await Promise.all([
      SecurityFinding.find(query)
        .sort({ severity: 1, filePath: 1, startLine: 1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      SecurityFinding.countDocuments(query),
    ]);

    // Apply consistent in-memory sort weighting for severity enum
    findings.sort((a, b) => {
      const weightA = SEVERITY_WEIGHT[a.severity] || 0;
      const weightB = SEVERITY_WEIGHT[b.severity] || 0;
      return weightB - weightA;
    });

    return {
      findings,
      totalCount,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalCount / safeLimit),
    };
  }

  /**
   * Retrieves single finding detail.
   */
  async getFindingDetail(projectId, findingId) {
    const finding = await SecurityFinding.findOne({
      _id: findingId,
      projectId,
    }).lean();

    if (!finding) {
      const err = new Error("Finding not found or does not belong to this project.");
      err.status = 404;
      err.code = "FINDING_NOT_FOUND";
      throw err;
    }

    return finding;
  }

  /**
   * Updates finding status (open, resolved, ignored).
   */
  async updateFindingStatus(projectId, findingId, status) {
    const ALLOWED_STATUSES = ["open", "resolved", "ignored"];
    if (!ALLOWED_STATUSES.includes(status)) {
      const err = new Error(`Invalid status '${status}'. Must be one of: ${ALLOWED_STATUSES.join(", ")}`);
      err.status = 400;
      err.code = "INVALID_STATUS";
      throw err;
    }

    const finding = await SecurityFinding.findOne({
      _id: findingId,
      projectId,
    });

    if (!finding) {
      const err = new Error("Finding not found or does not belong to this project.");
      err.status = 404;
      err.code = "FINDING_NOT_FOUND";
      throw err;
    }

    finding.status = status;
    await finding.save();

    return finding.toObject ? finding.toObject() : finding;
  }
}

export const defaultSecurityAuditService = new SecurityAuditService();
