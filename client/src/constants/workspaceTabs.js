// client/src/constants/workspaceTabs.js

/**
 * Centralized Workspace Tab Configuration for ArchMind AI
 * Maps tab IDs to capability keys supplied by the backend RIE detector.
 */
export const WORKSPACE_TABS = [
  {
    id: "topology",
    label: "Topology",
    icon: "❖",
    alwaysEnabled: true,
    analysisModule: "architecture",
  },
  {
    id: "erd",
    label: "ER Diagram",
    icon: "⬡",
    capabilityKey: "hasDatabase",
    detailKey: "databases",
    analysisModule: "erd",
    emptyState: {
      title: "ER Diagram",
      subtitle: "No database schemas detected in this repository.",
      description:
        "ArchMind did not detect Prisma, Mongoose, SQL schemas, ORM models, or migration files.",
      badge: "Not Available",
    },
  },
  {
    id: "apis",
    label: "API Sequences",
    icon: "⇄",
    capabilityKey: "hasApis",
    detailKey: "frameworks",
    analysisModule: "api",
    emptyState: {
      title: "API Sequences",
      subtitle: "No API routes, controllers, or supported API frameworks were detected.",
      description:
        "ArchMind scanned the repository but found no API route handlers or controller definitions.",
      badge: "Not Available",
    },
  },
  {
    id: "devops",
    label: "DevOps & CI/CD",
    icon: "⚙",
    capabilityKey: "hasDevops",
    detailKey: "devops",
    analysisModule: "devops",
    emptyState: {
      title: "DevOps & CI/CD",
      subtitle: "No Docker, Kubernetes, Helm, Terraform, or CI workflow configuration was detected.",
      description:
        "ArchMind did not find Dockerfile, docker-compose, .github/workflows, Helm charts, or Terraform manifests in this repository.",
      badge: "Not Available",
    },
  },
  {
    id: "security",
    label: "Security Audit",
    icon: "🛡",
    capabilityKey: "hasSecuritySensitiveCode",
    analysisModule: "security",
    emptyState: {
      title: "Security Audit",
      subtitle: "No authentication, authorization, or security-sensitive backend signals were detected.",
      description:
        "ArchMind did not detect sensitive security logic, authentication middleware, or cryptographic operations in this repository.",
      badge: "Not Available",
    },
  },
];

/**
 * Check if a tab is enabled based on project capabilities.
 * @param {Object} tab - Tab definition object
 * @param {Object|null} capabilities - Project capabilities object from API response
 * @returns {boolean}
 */
export function isTabEnabled(tab, capabilities = {}) {
  const caps = capabilities || {};
  if (tab.alwaysEnabled) return true;
  if (!tab.capabilityKey) return true;

  // Support both canonical keys (hasDatabase, hasDevops) and backward-compat aliases (erd, devops)
  if (tab.capabilityKey === "hasDatabase") {
    return Boolean(caps.hasDatabase ?? caps.erd);
  }
  if (tab.capabilityKey === "hasDevops") {
    return Boolean(caps.hasDevops ?? caps.devops);
  }
  return Boolean(caps[tab.capabilityKey]);
}

/**
 * Get technology details list for a capability tab.
 * @param {Object} tab - Tab definition object
 * @param {Object|null} capabilities - Project capabilities object
 * @returns {Array<string>}
 */
export function getTabDetails(tab, capabilities = {}) {
  const caps = capabilities || {};
  if (!tab.detailKey || !caps.details) return [];
  const detailsList = caps.details[tab.detailKey];
  return Array.isArray(detailsList) ? detailsList : [];
}

