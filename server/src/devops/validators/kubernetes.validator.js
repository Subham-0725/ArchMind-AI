// server/src/devops/validators/kubernetes.validator.js
//
// Deterministic static validator for generated Kubernetes manifests.
// Validates multi-document YAML, required resource fields, Deployment-Service
// selector alignment, container port consistency, and checks for leaked secrets.

import { SECRET_PATTERNS } from "../../rie/security/secretPatterns.js";

const VALID_K8S_KINDS = new Set([
  "Deployment",
  "Service",
  "ConfigMap",
  "Secret",
  "Ingress",
  "StatefulSet",
  "DaemonSet",
  "Job",
  "CronJob",
  "HorizontalPodAutoscaler",
]);

/**
 * Parses simple YAML key-value pairs from lines.
 *
 * @param {string[]} lines
 * @returns {Object}
 */
function parseResourceDoc(lines) {
  const doc = {};
  let currentTop = null;
  let inMetadata = false;
  let inSelector = false;
  let inLabels = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const indent = rawLine.search(/\S/);

    if (indent === 0 && line.includes(":")) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      currentTop = key;
      inMetadata = key === "metadata";
      inSelector = false;
      inLabels = false;

      if (val) {
        doc[key] = val.replace(/^["']|["']$/g, "");
      } else {
        doc[key] = {};
      }
      continue;
    }

    if (inMetadata && indent === 2) {
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const k = line.slice(0, colonIdx).trim();
        const v = line.slice(colonIdx + 1).trim();
        if (typeof doc.metadata !== "object") doc.metadata = {};
        if (k === "labels") {
          inLabels = true;
          doc.metadata.labels = {};
        } else {
          inLabels = false;
          doc.metadata[k] = v.replace(/^["']|["']$/g, "");
        }
      }
      continue;
    }

    if (inMetadata && inLabels && indent >= 4) {
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const k = line.slice(0, colonIdx).trim();
        const v = line.slice(colonIdx + 1).trim();
        if (doc.metadata?.labels) {
          doc.metadata.labels[k] = v.replace(/^["']|["']$/g, "");
        }
      }
    }
  }

  return doc;
}

/**
 * Validates a multi-document Kubernetes manifest string.
 *
 * @param {string} content - YAML content (can have multiple docs separated by '---')
 * @param {Object} [options]
 * @returns {{
 *   valid: boolean,
 *   errors: string[],
 *   warnings: string[],
 *   checks: Array<{ name: string, passed: boolean, message: string }>,
 *   validationLevel: "structural"
 * }}
 */
export function validateKubernetesManifests(content, options = {}) {
  const errors = [];
  const warnings = [];
  const checks = [];

  // Check 1: Non-empty content
  if (typeof content !== "string" || !content.trim()) {
    errors.push("Kubernetes manifest content is empty.");
    checks.push({ name: "non_empty", passed: false, message: "Manifest must not be empty" });
    return {
      valid: false,
      errors,
      warnings,
      checks,
      validationLevel: "structural",
    };
  }
  checks.push({ name: "non_empty", passed: true, message: "Kubernetes manifest content present" });

  // Check 2: Secret scanning
  let secretFound = false;
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(content)) {
      secretFound = true;
      errors.push(`Potentially exposed secret or credential detected in Kubernetes manifest: ${pattern.title}.`);
      break;
    }
  }
  checks.push({
    name: "secret_leak_prevention",
    passed: !secretFound,
    message: !secretFound ? "No hardcoded credentials detected" : "Hardcoded credential detected in manifest",
  });

  // Split into individual documents by '---'
  const rawDocs = content
    .split(/^---$/m)
    .map((d) => d.trim())
    .filter(Boolean);

  if (rawDocs.length === 0) {
    errors.push("No valid Kubernetes resource documents found.");
    return { valid: false, errors, warnings, checks, validationLevel: "structural" };
  }

  const parsedDocs = [];
  let allDocsHaveRequiredFields = true;

  for (let idx = 0; idx < rawDocs.length; idx++) {
    const rawDoc = rawDocs[idx];
    const lines = rawDoc.split(/\r?\n/);
    const parsed = parseResourceDoc(lines);
    parsed._raw = rawDoc;
    parsedDocs.push(parsed);

    const docIndexStr = `Document ${idx + 1}`;

    if (!parsed.apiVersion) {
      allDocsHaveRequiredFields = false;
      errors.push(`${docIndexStr} is missing required 'apiVersion' field.`);
    }
    if (!parsed.kind) {
      allDocsHaveRequiredFields = false;
      errors.push(`${docIndexStr} is missing required 'kind' field.`);
    } else if (!VALID_K8S_KINDS.has(parsed.kind)) {
      warnings.push(`${docIndexStr} specifies unusual or unsupported resource kind '${parsed.kind}'.`);
    }

    const name = parsed.metadata?.name;
    if (!name) {
      allDocsHaveRequiredFields = false;
      errors.push(`${docIndexStr} (${parsed.kind || "Resource"}) is missing 'metadata.name'.`);
    }
  }

  checks.push({
    name: "required_k8s_fields",
    passed: allDocsHaveRequiredFields,
    message: allDocsHaveRequiredFields
      ? `All ${parsedDocs.length} resource(s) define apiVersion, kind, and metadata.name`
      : "Some resources are missing required Kubernetes metadata",
  });

  // Check 3: Deployment & Service Selector Consistency
  const deployments = parsedDocs.filter((d) => d.kind === "Deployment");
  const services = parsedDocs.filter((d) => d.kind === "Service");

  // Extract labels and selectors using regex from raw doc
  let selectorsMatch = true;

  for (const dep of deployments) {
    const raw = dep._raw;
    // Extract matchLabels app
    const matchLabelMatch = raw.match(/matchLabels:\s*\n\s+([a-zA-Z0-9_.-]+):\s*["']?([a-zA-Z0-9_.-]+)["']?/i);
    const podLabelMatch = raw.match(/template:\s*\n[\s\S]*?labels:\s*\n\s+([a-zA-Z0-9_.-]+):\s*["']?([a-zA-Z0-9_.-]+)["']?/i);

    if (matchLabelMatch && podLabelMatch) {
      const selectorKey = matchLabelMatch[1];
      const selectorVal = matchLabelMatch[2];
      const podKey = podLabelMatch[1];
      const podVal = podLabelMatch[2];

      if (selectorKey !== podKey || selectorVal !== podVal) {
        selectorsMatch = false;
        errors.push(`Deployment '${dep.metadata?.name}' selector matchLabels (${selectorKey}=${selectorVal}) does not match template pod labels (${podKey}=${podVal}).`);
      }
    }

    // Check 4: Resource limits in Deployment (warning)
    const hasResources = /resources:\s*\n[\s\S]*?(limits|requests):/i.test(raw);
    if (!hasResources) {
      warnings.push(`Deployment '${dep.metadata?.name}' does not specify resource requests or limits.`);
    }

    // Check 5: SecurityContext (warning)
    const hasSecurityContext = /securityContext:\s*\n[\s\S]*?runAsNonRoot:\s*true/i.test(raw);
    if (!hasSecurityContext) {
      warnings.push(`Deployment '${dep.metadata?.name}' should specify 'securityContext.runAsNonRoot: true' for production safety.`);
    }
  }

  // Cross-reference Service selector with Deployment
  for (const svc of services) {
    const raw = svc._raw;
    const svcSelectorMatch = raw.match(/selector:\s*\n\s+([a-zA-Z0-9_.-]+):\s*["']?([a-zA-Z0-9_.-]+)["']?/i);

    if (svcSelectorMatch && deployments.length > 0) {
      const svcKey = svcSelectorMatch[1];
      const svcVal = svcSelectorMatch[2];

      const matchingDep = deployments.some((dep) => {
        return (
          dep._raw.includes(`${svcKey}: "${svcVal}"`) ||
          dep._raw.includes(`${svcKey}: '${svcVal}'`) ||
          dep._raw.includes(`${svcKey}: ${svcVal}`)
        );
      });

      if (!matchingDep) {
        warnings.push(`Service '${svc.metadata?.name}' selector (${svcKey}=${svcVal}) does not match any Deployment pod labels.`);
      }
    }
  }

  checks.push({
    name: "selector_consistency",
    passed: selectorsMatch,
    message: selectorsMatch
      ? "Deployment selector matchLabels and pod labels are consistent"
      : "Deployment selectors do not match pod template labels",
  });

  // Check 6: Port consistency check
  let portConsistent = true;
  for (const dep of deployments) {
    const portMatch = dep._raw.match(/containerPort:\s*(\d+)/i);
    const containerPort = portMatch ? portMatch[1] : null;

    if (containerPort) {
      for (const svc of services) {
        const targetPortMatch = svc._raw.match(/targetPort:\s*(\d+)/i);
        if (targetPortMatch && targetPortMatch[1] !== containerPort) {
          portConsistent = false;
          warnings.push(`Service '${svc.metadata?.name}' targetPort (${targetPortMatch[1]}) does not match Deployment containerPort (${containerPort}).`);
        }
      }
    }
  }

  checks.push({
    name: "port_consistency",
    passed: portConsistent,
    message: portConsistent
      ? "Service targetPort matches Deployment containerPort"
      : "Detected port mismatch between Service and Deployment",
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks,
    validationLevel: "structural",
  };
}

