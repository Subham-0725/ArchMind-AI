// server/src/services/security/codeReview.service.js
//
// AI-Assisted Code Review Service using Groq.
// Reviews selected repository files for correctness, security, maintainability, and performance.
// Enforces strict secret redaction, bounded context, and output schema validation.

import fs from "fs";
import path from "path";
import { redactSecrets } from "../../rie/security/secretRedactor.js";
import { GroqChatService } from "../chat/groqChat.service.js";
import SourceFile from "../../models/SourceFile.js";
import Project from "../../models/Project.js";

const MAX_REVIEW_LINES = 400;

export class CodeReviewService {
  constructor(options = {}) {
    this.groqService = options.groqService || new GroqChatService();
  }

  /**
   * Reviews a single file within a project.
   *
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.filePath
   * @param {string} [params.customFocus] - Optional review focus (e.g. "security", "performance")
   * @returns {Promise<Object>} Structured review report
   */
  async reviewFile({ projectId, filePath, customFocus = null }) {
    if (!projectId || !filePath) {
      const err = new Error("Project ID and file path are required for code review.");
      err.status = 400;
      err.code = "MISSING_PARAM";
      throw err;
    }

    const normalizedPath = filePath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (
      normalizedPath.includes("..") ||
      normalizedPath.includes("\0") ||
      normalizedPath.startsWith("/") ||
      normalizedPath.includes("://")
    ) {
      const err = new Error("Invalid file path. Path traversal is strictly prohibited.");
      err.status = 400;
      err.code = "INVALID_PATH";
      throw err;
    }

    // 1. Retrieve file content
    let sourceFile = await SourceFile.findOne({
      projectId,
      filePath: normalizedPath,
    }).lean();

    if (!sourceFile || !sourceFile.content) {
      // Check Project model and tree/disk
      const project = await Project.findById(projectId).lean();
      if (!project) {
        const err = new Error("Project not found.");
        err.status = 404;
        err.code = "PROJECT_NOT_FOUND";
        throw err;
      }

      const treeNode = (project.tree || []).find((t) => t.path === normalizedPath && t.type !== "dir");
      if (!treeNode) {
        const err = new Error(`File '${normalizedPath}' does not exist in the repository tree.`);
        err.status = 404;
        err.code = "FILE_NOT_FOUND";
        throw err;
      }

      if (treeNode.content) {
        sourceFile = {
          filePath: normalizedPath,
          content: treeNode.content,
          lineCount: treeNode.content.split(/\r?\n/).length,
          language: path.extname(normalizedPath).replace(".", "") || "text",
        };
      } else if (project.source === "zip" && project.extractionPath && fs.existsSync(project.extractionPath)) {
        const absPath = path.resolve(project.extractionPath, normalizedPath);
        if (absPath.startsWith(path.resolve(project.extractionPath)) && fs.existsSync(absPath)) {
          const rawContent = fs.readFileSync(absPath, "utf8");
          const sanitized = redactSecrets(rawContent);
          sourceFile = {
            filePath: normalizedPath,
            content: sanitized,
            lineCount: sanitized.split(/\r?\n/).length,
            language: path.extname(normalizedPath).replace(".", "") || "text",
          };
        }
      }
    }

    if (!sourceFile || !sourceFile.content) {
      const err = new Error(`Source file '${normalizedPath}' not found or has no text content in storage.`);
      err.status = 404;
      err.code = "FILE_NOT_FOUND";
      throw err;
    }

    const totalLines = sourceFile.lineCount || sourceFile.content.split(/\r?\n/).length;

    // 2. Bound lines & Redact secrets
    const lines = sourceFile.content.split(/\r?\n/);
    const isTruncated = lines.length > MAX_REVIEW_LINES;
    const boundedContent = lines.slice(0, MAX_REVIEW_LINES).join("\n");
    const sanitizedCode = redactSecrets(boundedContent);

    // 3. Prompt Construction
    const systemPrompt = `You are an expert senior code reviewer and security auditor.
Analyze the provided source file and return an objective, evidence-based code review report.
Do not invent line numbers or fabricate security vulnerabilities. If no issues exist in a category, return an empty array for that category.

You MUST respond strictly with valid JSON conforming to this schema (no markdown, no backticks, no prose):
{
  "summary": "High-level summary of the code quality and risks",
  "overallScore": 85,
  "findings": [
    {
      "category": "correctness" | "security" | "maintainability" | "performance",
      "title": "Short title",
      "severity": "Critical" | "High" | "Medium" | "Low",
      "confidence": "High" | "Medium" | "Low",
      "startLine": 1,
      "endLine": 10,
      "explanation": "Clear technical explanation of the issue",
      "suggestedImprovement": "Concrete suggested replacement code or refactoring guidance"
    }
  ]
}`;

    const userPrompt = `File: ${sourceFile.filePath} (${sourceFile.language || "code"}, ${totalLines} total lines)
${customFocus ? `Focus review especially on: ${customFocus}\n` : ""}
Source Code:
\`\`\`${sourceFile.language || ""}
${sanitizedCode}
\`\`\``;

    // 4. Query Groq
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let completion;
    try {
      completion = await this.groqService.completeChat(messages, {
        temperature: 0.1,
      });
    } catch (groqErr) {
      throw groqErr;
    }

    // 5. Parse and Validate Output
    let parsedReview;
    try {
      let rawText = (completion.content || "").trim();
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }
      parsedReview = JSON.parse(rawText);
    } catch (parseErr) {
      const err = new Error(`AI model returned a malformed response: ${parseErr.message}`);
      err.status = 502;
      err.code = "MALFORMED_AI_RESPONSE";
      throw err;
    }

    // 6. Normalize and bound line numbers
    const validatedFindings = (Array.isArray(parsedReview.findings) ? parsedReview.findings : [])
      .map((f) => {
        const start = Math.max(1, Math.min(parseInt(f.startLine, 10) || 1, totalLines));
        const end = Math.max(start, Math.min(parseInt(f.endLine, 10) || start, totalLines));
        const explanation = f.explanation || f.description || "";
        const suggestion = f.suggestedImprovement || f.suggestion || f.fixSnippet || "";
        return {
          category: ["correctness", "security", "maintainability", "performance"].includes(f.category)
            ? f.category
            : "maintainability",
          title: f.title || "Code Review Observation",
          severity: ["Critical", "High", "Medium", "Low"].includes(f.severity) ? f.severity : "Medium",
          confidence: ["High", "Medium", "Low"].includes(f.confidence) ? f.confidence : "Medium",
          filePath: sourceFile.filePath,
          startLine: start,
          endLine: end,
          explanation,
          description: explanation,
          suggestedImprovement: suggestion,
          suggestion,
          codeSnippet: f.codeSnippet || "",
          fixSnippet: f.fixSnippet || suggestion,
        };
      });

    return {
      filePath: sourceFile.filePath,
      language: sourceFile.language,
      totalLines,
      reviewedLines: Math.min(totalLines, MAX_REVIEW_LINES),
      isTruncated,
      summary: parsedReview.summary || "Code review completed.",
      overallScore: typeof parsedReview.overallScore === "number" ? parsedReview.overallScore : 80,
      findings: validatedFindings,
      totalFindings: validatedFindings.length,
      model: completion.model,
      reviewedAt: new Date(),
    };
  }
}

export const defaultCodeReviewService = new CodeReviewService();


