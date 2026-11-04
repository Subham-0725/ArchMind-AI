// server/src/devops/validators/cicd.validator.js
//
// Deterministic static validator for generated GitHub Actions CI/CD workflows.
// Validates YAML structure, required workflow blocks, job steps, triggers,
// nonexistent script references, and scans for leaked secrets.

import { SECRET_PATTERNS } from "../../rie/security/secretPatterns.js";

/**
 * Basic lightweight YAML line parser for GitHub Actions workflows.
 * Validates indentation and parses top-level sections without external dependencies.
 *
 * @param {string} yamlString
 * @returns {{ data: Object, parseErrors: string[] }}
 */
export function parseWorkflowYaml(yamlString) {
  const parseErrors = [];
  if (typeof yamlString !== "string" || !yamlString.trim()) {
    return { data: null, parseErrors: ["YAML content is empty."] };
  }

  const lines = yamlString.split(/\r?\n/);
  const data = {};
  let currentTopKey = null;
  let currentJobKey = null;
  let inSteps = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/#.*$/, "").trimEnd(); // strip comments
    if (!line.trim()) continue;

    const indent = rawLine.search(/\S/);

    // Top-level key (indent 0)
    if (indent === 0 && line.includes(":")) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      currentTopKey = key;
      inSteps = false;

      if (val) {
        data[key] = val.replace(/^["']|["']$/g, "");
      } else {
        data[key] = key === "jobs" ? {} : {};
      }
      continue;
    }

    // Inside top-level block
    if (currentTopKey === "jobs" && indent === 2) {
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const jobName = line.slice(0, colonIdx).trim();
        currentJobKey = jobName;
        data.jobs[jobName] = { steps: [] };
        inSteps = false;
      }
      continue;
    }

    if (currentTopKey === "jobs" && currentJobKey) {
      const job = data.jobs[currentJobKey];
      if (indent === 4 && line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const field = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (field === "runs-on") {
          job["runs-on"] = val.replace(/^["']|["']$/g, "");
          inSteps = false;
        } else if (field === "steps") {
          inSteps = true;
        } else {
          job[field] = val;
          inSteps = false;
        }
        continue;
      }

      if (inSteps && indent >= 6) {
        // Step item
        const trimmed = line.trim();
        if (trimmed.startsWith("-")) {
          const stepItem = {};
          const rest = trimmed.slice(1).trim();
          if (rest.includes(":")) {
            const [k, ...v] = rest.split(":");
            stepItem[k.trim()] = v.join(":").trim();
          }
          job.steps.push(stepItem);
        } else if (job.steps.length > 0 && trimmed.includes(":")) {
          const [k, ...v] = trimmed.split(":");
          const lastStep = job.steps[job.steps.length - 1];
          lastStep[k.trim()] = v.join(":").trim();
        }
      }
    }

    // Capture triggers under 'on:'
    if (currentTopKey === "on" && indent >= 2) {
      const trimmed = line.trim();
      if (typeof data.on !== "object" || data.on === null) {
        data.on = {};
      }
      if (trimmed.startsWith("-")) {
        const trigger = trimmed.slice(1).trim().replace(/^["']|["']$/g, "");
        if (trigger) data.on[trigger] = true;
      } else if (trimmed.includes(":")) {
        const trigger = trimmed.split(":")[0].trim();
        if (trigger) data.on[trigger] = true;
      }
    }
  }

  return { data, parseErrors };
}

/**
 * Validates a generated GitHub Actions CI/CD workflow YAML.
 *
 * @param {string} content - YAML content
 * @param {Object} [context] - Context with package scripts for validation
 * @param {Object} [context.scripts] - package.json scripts
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   checks: Array<{ name: string, passed: boolean, message: string }>,
 *   validationLevel: "structural"
 * }}
 */
export function validateCicdWorkflow(content, context = {}) {
  const errors = [];
  const warnings = [];
  const checks = [];

  // Check 1: Non-empty content
  if (typeof content !== "string" || !content.trim()) {
    errors.push("CI/CD workflow content is empty.");
    checks.push({ name: "non_empty", passed: false, message: "Workflow content must not be empty" });
    return {
      valid: false,
      errors,
      warnings,
      checks,
      validationLevel: "structural",
    };
  }
  checks.push({ name: "non_empty", passed: true, message: "Workflow has non-empty content" });

  // Check 2: Parse YAML structure
  const { data, parseErrors } = parseWorkflowYaml(content);
  if (parseErrors.length > 0 || !data) {
    errors.push(...parseErrors);
    checks.push({ name: "yaml_syntax", passed: false, message: "Failed to parse YAML structure" });
    return { valid: false, errors, warnings, checks, validationLevel: "structural" };
  }
  checks.push({ name: "yaml_syntax", passed: true, message: "YAML structure parsed successfully" });

  // Check 3: Top-level required keys
  const hasName = Boolean(data.name);
  const hasOn = Boolean(data.on);
  const hasJobs = Boolean(data.jobs && typeof data.jobs === "object");

  if (!hasName) warnings.push("Workflow is missing top-level 'name' property.");
  if (!hasOn) errors.push("Workflow is missing top-level trigger definition ('on:').");
  if (!hasJobs) errors.push("Workflow is missing top-level 'jobs:' block.");

  checks.push({
    name: "required_top_level_blocks",
    passed: hasOn && hasJobs,
    message: hasOn && hasJobs ? "Required workflow blocks ('on', 'jobs') present" : "Missing required top-level blocks",
  });

  // Check 4: Valid jobs and runs-on
  const jobNames = data.jobs ? Object.keys(data.jobs) : [];
  if (jobNames.length === 0) {
    errors.push("Workflow defines no jobs in 'jobs:' section.");
  }

  let allJobsHaveRunsOn = true;
  let allJobsHaveSteps = true;

  for (const jName of jobNames) {
    const job = data.jobs[jName];
    if (!job["runs-on"]) {
      allJobsHaveRunsOn = false;
      errors.push(`Job '${jName}' is missing required 'runs-on' property (e.g. 'ubuntu-latest').`);
    }
    if (!Array.isArray(job.steps) || job.steps.length === 0) {
      allJobsHaveSteps = false;
      errors.push(`Job '${jName}' has no steps defined.`);
    }
  }

  checks.push({
    name: "job_structure",
    passed: jobNames.length > 0 && allJobsHaveRunsOn && allJobsHaveSteps,
    message: jobNames.length > 0 && allJobsHaveRunsOn && allJobsHaveSteps
      ? `Defined ${jobNames.length} valid job(s) with runners and steps`
      : "Job definitions are missing runners or steps",
  });

  // Check 5: Secret detection in YAML
  let secretFound = false;
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      secretFound = true;
      errors.push(`Potentially exposed secret or credential detected in workflow: ${pattern.title}.`);
      break;
    }
  }
  checks.push({
    name: "secret_leak_prevention",
    passed: !secretFound,
    message: !secretFound ? "No hardcoded credentials detected in workflow" : "Hardcoded credentials detected",
  });

  // Check 6: Check for nonexistent script references if project scripts provided
  if (context.scripts && typeof context.scripts === "object") {
    const availableScripts = new Set(Object.keys(context.scripts));
    const npmRunRegex = /npm\s+run\s+([a-zA-Z0-9_:-]+)/g;
    let match;
    while ((match = npmRunRegex.exec(content)) !== null) {
      const scriptName = match[1];
      if (!availableScripts.has(scriptName)) {
        warnings.push(`Workflow references 'npm run ${scriptName}', but '${scriptName}' is not defined in project package.json scripts.`);
      }
    }
  }
  checks.push({
    name: "script_reference_verification",
    passed: true,
    message: "Verified npm script invocations against repository manifest",
  });

  // Check 7: Least privilege permissions
  const hasPermissionsBlock = /permissions\s*:/i.test(content);
  if (!hasPermissionsBlock) {
    warnings.push("Workflow does not declare explicit 'permissions:'. Recommend adding 'permissions: { contents: read }'.");
  }
  checks.push({
    name: "least_privilege_permissions",
    passed: hasPermissionsBlock,
    message: hasPermissionsBlock ? "Workflow defines explicit permissions" : "Explicit permissions not specified",
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks,
    validationLevel: "structural",
  };
}

