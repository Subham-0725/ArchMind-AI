// server/src/services/security/testGenerator.service.js
//
// Test Generation Service using Groq.
// Detects repository test frameworks (Jest, Vitest, Mocha, Pytest, Unittest)
// and generates structured unit test suites for normal, edge, and error cases.
// PREVIEW ONLY: Never executes generated tests and never overwrites repository files.

import path from "path";
import { redactSecrets } from "../../rie/security/secretRedactor.js";
import { GroqChatService } from "../chat/groqChat.service.js";
import SourceFile from "../../models/SourceFile.js";
import Project from "../../models/Project.js";

const MAX_SOURCE_LINES = 350;

export class TestGeneratorService {
  constructor(options = {}) {
    this.groqService = options.groqService || new GroqChatService();
  }

  /**
   * Detects the test framework for the project and target file.
   *
   * @param {Object} project
   * @param {string} ext
   * @returns {{ framework: string, confidence: "high"|"medium"|"low", reason: string }}
   */
  detectTestFramework(project, ext) {
    const isPython = ext === ".py" || ext === ".pyw";

    // 1. Python framework detection
    if (isPython) {
      const tree = project?.tree || [];
      const hasPytest = tree.some(
        (node) =>
          node.path?.includes("conftest.py") ||
          node.path?.includes("pytest.ini") ||
          node.path?.toLowerCase().endsWith("test_*.py")
      );
      if (hasPytest) {
        return {
          framework: "pytest",
          confidence: "high",
          reason: "Detected pytest configuration or naming conventions in repository tree.",
        };
      }
      return {
        framework: "unittest",
        confidence: "medium",
        reason: "Standard Python unittest library selected as safe baseline.",
      };
    }

    // 2. JavaScript / TypeScript framework detection
    const tree = project?.tree || [];
    const hasVitest = tree.some(
      (node) => node.path?.includes("vitest.config") || node.path?.includes("vite.config")
    );
    const hasJest = tree.some(
      (node) => node.path?.includes("jest.config") || node.path?.includes("__tests__")
    );

    if (hasVitest) {
      return {
        framework: "vitest",
        confidence: "high",
        reason: "Detected Vite/Vitest project configuration.",
      };
    }
    if (hasJest) {
      return {
        framework: "jest",
        confidence: "high",
        reason: "Detected Jest configuration or __tests__ directories.",
      };
    }

    // Check project techStack or capabilities
    const frameworks = project?.techStack?.frameworks || [];
    if (frameworks.includes("Jest")) {
      return {
        framework: "jest",
        confidence: "high",
        reason: "Jest detected in project technology stack.",
      };
    }

    return {
      framework: "jest",
      confidence: "medium",
      reason: "Defaulted to Jest for Node.js / JavaScript project.",
    };
  }

  /**
   * Proposes a clean test file path following project conventions.
   */
  suggestTestFilePath(filePath, framework) {
    const normalized = filePath.replace(/\\/g, "/");
    const dir = path.dirname(normalized);
    const baseName = path.basename(normalized, path.extname(normalized));
    const ext = path.extname(normalized);

    if (ext === ".py") {
      return `tests/test_${baseName}.py`;
    }

    if (framework === "vitest") {
      return `${dir}/${baseName}.test${ext.includes("ts") ? ".ts" : ".js"}`;
    }

    return `tests/${baseName}.test${ext.includes("ts") ? ".ts" : ".js"}`;
  }

  /**
   * Generates a unit test suite preview for a selected file.
   *
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.filePath
   * @returns {Promise<Object>} Test generation preview
   */
  async generateTests({ projectId, filePath }) {
    if (!projectId || !filePath) {
      const err = new Error("Project ID and file path are required for test generation.");
      err.status = 400;
      err.code = "MISSING_PARAM";
      throw err;
    }

    const [project, sourceFile] = await Promise.all([
      Project.findById(projectId).lean(),
      SourceFile.findOne({
        projectId,
        filePath: filePath.replace(/\\/g, "/"),
      }).lean(),
    ]);

    if (!project) {
      const err = new Error("Project not found.");
      err.status = 404;
      err.code = "PROJECT_NOT_FOUND";
      throw err;
    }

    if (!sourceFile || !sourceFile.content) {
      const err = new Error(`Source file '${filePath}' not found or has no content.`);
      err.status = 404;
      err.code = "FILE_NOT_FOUND";
      throw err;
    }

    const ext = path.extname(sourceFile.filePath).toLowerCase();
    const { framework, confidence: frameworkConfidence, reason: frameworkReason } =
      this.detectTestFramework(project, ext);

    const suggestedFilePath = this.suggestTestFilePath(sourceFile.filePath, framework);

    // Bound content & redact secrets
    const lines = sourceFile.content.split(/\r?\n/);
    const boundedContent = lines.slice(0, MAX_SOURCE_LINES).join("\n");
    const sanitizedCode = redactSecrets(boundedContent);

    // System prompt requesting structured test output
    const systemPrompt = `You are an expert test engineering architect.
Generate comprehensive, production-grade unit tests for the provided source file using ${framework}.
Cover:
1. Normal happy-path behavior
2. Edge cases (null/undefined inputs, boundary values, empty arrays)
3. Error cases (invalid arguments, thrown exceptions, rejected promises)

You MUST respond strictly with valid JSON conforming to this schema (no markdown, no backticks, no prose):
{
  "testCode": "Full runnable test file code as a string",
  "testCases": [
    {
      "name": "Test case description",
      "type": "normal" | "edge" | "error",
      "description": "Explanation of what this test verifies"
    }
  ]
}`;

    const userPrompt = `File to test: ${sourceFile.filePath} (${sourceFile.language || "code"})
Framework: ${framework}
Source Code:
\`\`\`${sourceFile.language || ""}
${sanitizedCode}
\`\`\``;

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

    // Parse output
    let parsed;
    try {
      let rawText = (completion.content || "").trim();
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      const err = new Error(`AI model returned a malformed response: ${parseErr.message}`);
      err.status = 502;
      err.code = "MALFORMED_AI_RESPONSE";
      throw err;
    }

    const testCode = parsed.testCode || "// No test code generated.";
    const testCases = Array.isArray(parsed.testCases) ? parsed.testCases : [];

    return {
      targetFilePath: sourceFile.filePath,
      suggestedFilePath,
      framework,
      frameworkConfidence,
      frameworkReason,
      testCode,
      testCases,
      totalTestCases: testCases.length,
      executed: false,
      isAutoApplied: false,
      disclaimer: "Generated test preview only. Tests have not been automatically executed or written to repository files.",
      generatedAt: new Date(),
    };
  }
}

export const defaultTestGeneratorService = new TestGeneratorService();

