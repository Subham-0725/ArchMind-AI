// server/src/rie/topologyBuilder.js
//
// Repository Intelligence Engine — Deterministic System Topology Generator
//
// Analyzes project file tree, techStack, languages, and structure signals to
// produce a React Flow-compatible node and edge graph.
// Does NOT execute code or call LLM APIs (100% static & deterministic invariant).

const FRONTEND_FRAMEWORKS = new Set([
  "React",
  "Vue",
  "Angular",
  "Svelte",
  "Next.js",
  "Nuxt",
  "Remix",
  "Vite",
  "Gatsby",
  "Ember",
  "Alpine.js",
]);

const BACKEND_FRAMEWORKS = new Set([
  "Express",
  "Express.js",
  "Fastify",
  "NestJS",
  "Koa",
  "Hono",
  "Django",
  "Flask",
  "FastAPI",
  "Spring Boot",
  "Quarkus",
  "Ktor",
  "Gin",
  "Echo",
  "Fiber",
  "Chi",
  "Actix",
  "Axum",
  "Rocket",
  "Laravel",
  "Symfony",
  "Slim",
  "Rails",
  "Sinatra",
  "ASP.NET",
]);

const DATABASE_TECH = new Set([
  "MongoDB",
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "Prisma",
  "Drizzle",
  "Sequelize",
  "Mongoose",
  "SQLAlchemy",
  "GORM",
  "Diesel",
  "SQLx",
  "Doctrine",
  "Mongoid",
]);

const CACHE_TECH = new Set(["Redis", "Memcached"]);

const DEVOPS_TECH = new Set([
  "Docker",
  "Kubernetes",
  "GitHub Actions",
  "Travis CI",
  "CircleCI",
  "Jenkins",
  "GitLab CI",
]);

/**
 * Deterministically constructs a React Flow compatible topology graph
 * (nodes and edges) based on verified repository evidence.
 *
 * @param {Object} projectData
 * @param {Array}  [projectData.tree=[]]
 * @param {Object} [projectData.techStack={}]
 * @param {string} [projectData.primaryLanguage=null]
 * @param {Array}  [projectData.secondaryLanguages=[]]
 * @param {string} [projectData.name="Repository"]
 * @returns {{
 *   nodes: Array<{ id: string, type: string, position: { x: number, y: number }, data: { label: string, technology: string, tier: string } }>,
 *   edges: Array<{ id: string, source: string, target: string, animated: boolean, label: string }>,
 *   generatedAt: Date
 * }}
 */
export const buildTopology = (projectData = {}) => {
  const tree = projectData.tree || [];
  const techStack = projectData.techStack || {
    languages: [],
    frameworks: [],
    databases: [],
    devops: [],
  };
  const primaryLanguage = projectData.primaryLanguage || null;
  const secondaryLanguages = projectData.secondaryLanguages || [];

  const filePaths = new Set(tree.map((node) => (node.path || "").toLowerCase()));
  const allFrameworks = new Set(techStack.frameworks || []);
  const allDatabases = new Set(techStack.databases || []);
  const allDevops = new Set(techStack.devops || []);
  const allLanguages = new Set([
    ...(primaryLanguage ? [primaryLanguage] : []),
    ...secondaryLanguages,
    ...(techStack.languages || []),
  ]);

  const nodes = [];
  const edges = [];

  // 1. Detect Frontend Tier
  let hasFrontend = false;
  let frontendLabel = "";
  let frontendTech = "";

  const detectedFrontendFrameworks = [...allFrameworks].filter((fw) =>
    FRONTEND_FRAMEWORKS.has(fw)
  );

  if (detectedFrontendFrameworks.length > 0) {
    hasFrontend = true;
    const mainFw = detectedFrontendFrameworks[0];
    frontendLabel = mainFw === "React" ? "React Frontend" : `${mainFw} Web App`;
    frontendTech = detectedFrontendFrameworks.join(" + ");
  } else {
    // Structural inspection
    const hasClientFolder = [...filePaths].some(
      (p) => p.startsWith("client/") || p.startsWith("frontend/") || p.startsWith("public/")
    );
    const hasJsxTsx = [...filePaths].some(
      (p) => p.endsWith(".jsx") || p.endsWith(".tsx") || p.endsWith(".vue") || p.endsWith(".svelte")
    );

    if (hasClientFolder || hasJsxTsx) {
      hasFrontend = true;
      frontendLabel = "Web Frontend";
      frontendTech = allLanguages.has("TypeScript") ? "TypeScript / HTML" : "JavaScript / HTML";
    }
  }

  // 2. Detect Backend Tier
  let hasBackend = false;
  let backendLabel = "";
  let backendTech = "";

  const detectedBackendFrameworks = [...allFrameworks].filter((fw) =>
    BACKEND_FRAMEWORKS.has(fw)
  );

  if (detectedBackendFrameworks.length > 0) {
    hasBackend = true;
    const mainFw = detectedBackendFrameworks[0];
    backendLabel = `${mainFw} API`;
    backendTech = `${primaryLanguage || "Node.js"} / ${mainFw}`;
  } else {
    // Structural inspection
    const hasBackendFolder = [...filePaths].some(
      (p) =>
        p.startsWith("server/") ||
        p.startsWith("backend/") ||
        p.startsWith("api/") ||
        p.includes("controllers/") ||
        p.includes("routes/") ||
        p.includes("services/")
    );
    const hasServerFiles =
      filePaths.has("server.js") ||
      filePaths.has("app.js") ||
      filePaths.has("main.py") ||
      filePaths.has("main.go");

    if (hasBackendFolder || hasServerFiles) {
      hasBackend = true;
      backendLabel = `${primaryLanguage || "Backend"} Service`;
      backendTech = primaryLanguage || "Node.js";
    }
  }

  // 3. Detect Database / Storage Tier
  let hasDatabase = false;
  let databaseLabel = "";
  let databaseTech = "";

  let hasCache = false;
  let cacheLabel = "";
  let cacheTech = "";

  const detectedDatabases = [...allDatabases].filter((db) => DATABASE_TECH.has(db));
  const detectedCaches = [...allDatabases].filter((db) => CACHE_TECH.has(db));

  if (detectedDatabases.length > 0) {
    hasDatabase = true;
    const mainDb = detectedDatabases[0];
    databaseLabel = `${mainDb} Database`;
    databaseTech = detectedDatabases.join(" + ");
  } else {
    // Check ORMs / schema files in file tree
    const hasDbFiles =
      filePaths.has("prisma/schema.prisma") ||
      [...filePaths].some((p) => p.includes("models/") || p.includes("schemas/"));
    if (hasDbFiles && hasBackend) {
      hasDatabase = true;
      databaseLabel = "Database Layer";
      databaseTech = "Mongoose / ORM";
    }
  }

  if (detectedCaches.length > 0) {
    hasCache = true;
    cacheLabel = "Redis Cache";
    cacheTech = detectedCaches.join(" + ");
  }

  // 4. Detect DevOps / Infrastructure Tier
  let hasDevops = false;
  let devopsLabel = "";
  let devopsTech = "";

  const detectedDevops = [...allDevops].filter((d) => DEVOPS_TECH.has(d));
  const hasDockerFiles =
    filePaths.has("dockerfile") ||
    filePaths.has("docker-compose.yml") ||
    filePaths.has("docker-compose.yaml");
  const hasCiWorkflows = [...filePaths].some((p) => p.startsWith(".github/workflows"));

  if (detectedDevops.length > 0 || hasDockerFiles || hasCiWorkflows) {
    hasDevops = true;
    if (hasDockerFiles && hasCiWorkflows) {
      devopsLabel = "Container & CI/CD";
      devopsTech = "Docker + GitHub Actions";
    } else if (hasDockerFiles) {
      devopsLabel = "Docker Runtime";
      devopsTech = "Docker Container";
    } else if (hasCiWorkflows) {
      devopsLabel = "GitHub Actions CI";
      devopsTech = "GitHub Actions";
    } else {
      devopsLabel = "DevOps Pipeline";
      devopsTech = detectedDevops.join(" + ") || "CI/CD";
    }
  }

  // ── Node Construction ────────────────────────────────────────────────────────

  // Fallback: If no tier was detected at all, build a default service node
  if (!hasFrontend && !hasBackend && !hasDatabase && !hasDevops) {
    nodes.push({
      id: "app-service",
      type: "customService",
      position: { x: 250, y: 150 },
      data: {
        label: `${projectData.name || "Repository"} Service`,
        technology: primaryLanguage || "Source Code",
        tier: "Backend",
      },
    });
    return { nodes, edges, generatedAt: new Date() };
  }

  if (hasDevops) {
    nodes.push({
      id: "devops",
      type: "customService",
      position: { x: 250, y: 50 },
      data: {
        label: devopsLabel,
        technology: devopsTech,
        tier: "DevOps",
      },
    });
  }

  if (hasFrontend) {
    nodes.push({
      id: "frontend",
      type: "customService",
      position: { x: 250, y: hasDevops ? 180 : 100 },
      data: {
        label: frontendLabel,
        technology: frontendTech,
        tier: "Frontend",
      },
    });
  }

  if (hasBackend) {
    nodes.push({
      id: "backend",
      type: "customService",
      position: { x: 250, y: hasDevops ? (hasFrontend ? 310 : 180) : (hasFrontend ? 250 : 100) },
      data: {
        label: backendLabel,
        technology: backendTech,
        tier: "Backend",
      },
    });
  }

  if (hasDatabase) {
    let dbY = 400;
    if (hasBackend && hasFrontend) dbY = 440;
    else if (hasBackend || hasFrontend) dbY = 280;

    nodes.push({
      id: "database",
      type: "customService",
      position: { x: 250, y: dbY },
      data: {
        label: databaseLabel,
        technology: databaseTech,
        tier: "Database",
      },
    });
  }

  if (hasCache) {
    let cacheY = 400;
    if (hasBackend && hasFrontend) cacheY = 440;
    else if (hasBackend || hasFrontend) cacheY = 280;

    nodes.push({
      id: "cache",
      type: "customService",
      position: { x: 500, y: cacheY },
      data: {
        label: cacheLabel,
        technology: cacheTech,
        tier: "Database",
      },
    });
  }

  // ── Edge Construction ────────────────────────────────────────────────────────

  if (hasFrontend && hasBackend) {
    edges.push({
      id: "e-frontend-backend",
      source: "frontend",
      target: "backend",
      animated: true,
      label: "HTTP / REST API",
    });
  }

  if (hasBackend && hasDatabase) {
    edges.push({
      id: "e-backend-database",
      source: "backend",
      target: "database",
      animated: true,
      label: "ORM / Queries",
    });
  }

  if (hasBackend && hasCache) {
    edges.push({
      id: "e-backend-cache",
      source: "backend",
      target: "cache",
      animated: true,
      label: "Cache Reads / Writes",
    });
  }

  if (hasFrontend && hasDatabase && !hasBackend) {
    edges.push({
      id: "e-frontend-database",
      source: "frontend",
      target: "database",
      animated: true,
      label: "Direct Database Access",
    });
  }

  if (hasDevops) {
    const targetService = hasBackend ? "backend" : hasFrontend ? "frontend" : null;
    if (targetService) {
      edges.push({
        id: `e-devops-${targetService}`,
        source: "devops",
        target: targetService,
        animated: true,
        label: "Builds & Deploys",
      });
    }
  }

  return {
    nodes,
    edges,
    generatedAt: new Date(),
  };
};
