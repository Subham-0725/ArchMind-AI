// server/src/devops/validators/dockerfile.validator.js
//
// Deterministic static validator for generated Dockerfiles.
// Validates instruction keywords, base image, startup commands, non-root user,
// and enforces strict secret scanning on generated contents.

import { redactSecrets } from "../../rie/security/secretRedactor.js";
import { SECRET_PATTERNS } from "../../rie/security/secretPatterns.js";

const VALID_INSTRUCTIONS = new Set([
  "FROM",
  "RUN",
  "CMD",
  "LABEL",
  "MAINTAINER",
  "EXPOSE",
  "ENV",
  "ADD",
  "COPY",
  "ENTRYPOINT",
  "VOLUME",
  "USER",
  "WORKDIR",
  "ARG",
  "ONBUILD",
  "STOPSIGNAL",
  "HEALTHCHECK",
  "SHELL",
]);

/**
 * Validates a generated Dockerfile string.
 *
 * @param {string} content - Dockerfile raw text
 * @param {Object} [options]
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   checks: Array<{ name: string, passed: boolean, message: string }>,
 *   validationLevel: "structural"
 * }}
 */
export function validateDockerfile(content, options = {}) {
  const errors = [];
  const warnings = [];
  const checks = [];

  // Check 1: Non-empty content
  const isNonEmpty = typeof content === "string" && content.trim().length > 0;
  if (!isNonEmpty) {
    errors.push("Dockerfile content is empty.");
    checks.push({ name: "non_empty", passed: false, message: "Content must not be empty" });
    return {
      valid: false,
      errors,
      warnings,
      checks,
      validationLevel: "structural",
    };
  }
  checks.push({ name: "non_empty", passed: true, message: "Dockerfile has non-empty content" });

  const rawLines = content.split(/\r?\n/);
  const instructionLines = [];

  // Parse lines handling line continuations with backslash
  let currentInstruction = "";
  let currentLineNo = 1;
  let startLineNo = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (currentInstruction === "") {
      startLineNo = i + 1;
    }

    if (line.startsWith("#") || line === "") {
      continue;
    }

    if (line.endsWith("\\")) {
      currentInstruction += line.slice(0, -1).trim() + " ";
    } else {
      currentInstruction += line;
      instructionLines.push({ text: currentInstruction.trim(), lineNo: startLineNo });
      currentInstruction = "";
    }
  }

  // Check 2: Valid instruction syntax
  let hasValidInstructions = true;
  for (const item of instructionLines) {
    const firstWord = item.text.split(/\s+/)[0]?.toUpperCase();
    if (!VALID_INSTRUCTIONS.has(firstWord)) {
      hasValidInstructions = false;
      errors.push(`Invalid Docker instruction '${firstWord}' at line ${item.lineNo}.`);
    }
  }
  checks.push({
    name: "instruction_syntax",
    passed: hasValidInstructions,
    message: hasValidInstructions ? "All instructions use valid Docker syntax" : "Found invalid Docker instructions",
  });

  // Check 3: Base image (FROM)
  const fromInstructions = instructionLines.filter((l) => l.text.toUpperCase().startsWith("FROM"));
  const hasBaseImage = fromInstructions.length > 0;
  if (!hasBaseImage) {
    errors.push("Missing required 'FROM' instruction.");
  }
  checks.push({
    name: "has_base_image",
    passed: hasBaseImage,
    message: hasBaseImage ? `Found ${fromInstructions.length} FROM instruction(s)` : "Missing FROM instruction",
  });

  // Check 4: Usable startup command (CMD or ENTRYPOINT)
  const hasStartupCommand = instructionLines.some((l) => {
    const upper = l.text.toUpperCase();
    return upper.startsWith("CMD") || upper.startsWith("ENTRYPOINT");
  });
  if (!hasStartupCommand) {
    errors.push("Missing usable startup instruction ('CMD' or 'ENTRYPOINT').");
  }
  checks.push({
    name: "has_startup_command",
    passed: hasStartupCommand,
    message: hasStartupCommand ? "Startup instruction (CMD/ENTRYPOINT) present" : "No CMD or ENTRYPOINT found",
  });

  // Check 5: Secret detection
  let secretFound = false;
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex index if global
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      secretFound = true;
      errors.push(`Potentially exposed secret or credential detected: ${pattern.title}.`);
      break;
    }
  }
  if (content.includes("BEGIN PRIVATE KEY") || content.includes("BEGIN RSA PRIVATE KEY")) {
    secretFound = true;
    errors.push("Raw private cryptographic key embedded in Dockerfile.");
  }
  checks.push({
    name: "secret_leak_prevention",
    passed: !secretFound,
    message: !secretFound ? "No hardcoded secrets detected" : "Hardcoded secret detected in Dockerfile",
  });

  // Check 6: Unsafe commands (rm -rf /, curl ... | sh without verification)
  const hasUnsafeCommands = /rm\s+-rf\s+\/($|\s)/.test(content) || /curl\s+[^|]+\|\s*(sh|bash)/i.test(content);
  if (hasUnsafeCommands) {
    warnings.push("Suspicious command detected (e.g. piping curl to shell or root deletion).");
  }
  checks.push({
    name: "safe_commands",
    passed: !hasUnsafeCommands,
    message: !hasUnsafeCommands ? "No unsafe command patterns found" : "Contains potentially unsafe command",
  });

  // Check 7: Best practice - Non-root user (warning only)
  const hasUserInstruction = instructionLines.some((l) => l.text.toUpperCase().startsWith("USER"));
  if (!hasUserInstruction) {
    warnings.push("Dockerfile does not define a non-root 'USER'. Container will execute as root by default.");
  }
  checks.push({
    name: "non_root_user",
    passed: hasUserInstruction,
    message: hasUserInstruction ? "Non-root USER instruction configured" : "Non-root USER not configured",
  });

  // Check 8: Best practice - Layer caching (warning only)
  // If `COPY . .` appears before `npm install` or `pip install`, it invalidates Docker layer cache
  let copyAllIndex = -1;
  let installIndex = -1;
  for (let idx = 0; idx < instructionLines.length; idx++) {
    const text = instructionLines[idx].text;
    if (/^COPY\s+(\.\s+\.|\.\/\s+\.\/)/i.test(text)) {
      if (copyAllIndex === -1) copyAllIndex = idx;
    }
    if (/^RUN\s+.*(npm|yarn|pnpm|pip)\s+(install|ci)/i.test(text)) {
      if (installIndex === -1) installIndex = idx;
    }
  }
  if (copyAllIndex !== -1 && installIndex !== -1 && copyAllIndex < installIndex) {
    warnings.push("Optimal layer caching: 'COPY . .' is placed before dependency installation ('npm/pip install'). Move package manifest COPY before install.");
  }
  checks.push({
    name: "layer_caching_order",
    passed: !(copyAllIndex !== -1 && installIndex !== -1 && copyAllIndex < installIndex),
    message: "Layer caching order checked",
  });

  // Check 9: Best practice - Pinned image tags (warning only)
  const unpinnedFrom = fromInstructions.some((l) => /FROM\s+[a-zA-Z0-9_/.-]+:latest(\s+|$)/i.test(l.text));
  if (unpinnedFrom) {
    warnings.push("Base image uses ':latest' tag. Pin to a specific version or SHA digest for reproducible builds.");
  }
  checks.push({
    name: "pinned_base_image",
    passed: !unpinnedFrom,
    message: !unpinnedFrom ? "Base image has version tag" : "Base image uses unpinned ':latest' tag",
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks,
    validationLevel: "structural",
  };
}

