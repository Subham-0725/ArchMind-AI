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
  const database = projectData.database || null;
  const apiRoutes = Array.isArray(projectData.apiRoutes) ? projectData.apiRoutes : [];

  const filePaths = new Set(tree.map((node) => (node.path || "").toLowerCase()));
  const allFrameworks = new Set([
    ...(techStack.frameworks || []),
    ...(projectData.apiFrameworks || []),
  ]);
  const allDatabases = new Set([
    ...(techStack.databases || []),
    ...(database?.type ? [database.type] : []),
  ]);
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
    backendLabel = `${mainFw} API Server`;
    const routesSuffix = apiRoutes.length > 0 ? ` (${apiRoutes.length} routes)` : "";
    backendTech = `${primaryLanguage || "Node.js"} / ${mainFw}${routesSuffix}`;
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
      const routesSuffix = apiRoutes.length > 0 ? ` (${apiRoutes.length} routes)` : "";
      backendTech = `${primaryLanguage || "Node.js"}${routesSuffix}`;
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

  if (database && Array.isArray(database.entities) && database.entities.length > 0) {
    hasDatabase = true;
    const dbType = database.type || "Database";
    databaseLabel = `${dbType} Database`;
    const entityNames = database.entities.map((e) => e.name).filter(Boolean);
    const namesPreview = entityNames.slice(0, 3).join(", ");
    databaseTech = `${dbType} (${database.entities.length} models: ${namesPreview}${entityNames.length > 3 ? "..." : ""})`;
  } else if (detectedDatabases.length > 0) {
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

  // 4. Detect Specific Subsystems / Controllers based on repository evidence
  const hasAiService = [...filePaths].some(
    (p) => p.includes("ai.controller") || p.includes("ai.routes") || p.includes("ai.service")
  );
  const hasAtsService = [...filePaths].some(
    (p) => p.includes("ats.controller") || p.includes("ats.routes") || p.includes("ats.service")
  );
  const hasDocExportService = [...filePaths].some(
    (p) => p.includes("document.controller") || p.includes("export.controller") || p.includes("documents.js")
  );
  const hasResumeService = [...filePaths].some(
    (p) => p.includes("resume.controller") || p.includes("resumes.js")
  );

  // 5. Detect DevOps / Infrastructure Tier
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
      position: { x: 250, y: 120 },
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
      position: { x: 250, y: 240 },
      data: {
        label: backendLabel,
        technology: backendTech,
        tier: "Backend",
      },
    });
  }

  // Evidence-grounded internal sub-services
  if (hasResumeService && hasBackend) {
    nodes.push({
      id: "svc-resume",
      type: "customService",
      position: { x: 100, y: 360 },
      data: {
        label: "Resume Management",
        technology: "Resume Engine",
        tier: "Backend",
      },
    });
  }

  if (hasAiService && hasBackend) {
    nodes.push({
      id: "svc-ai",
      type: "customService",
      position: { x: 300, y: 360 },
      data: {
        label: "AI Generation Service",
        technology: "Groq / OpenAI LLM",
        tier: "Backend",
      },
    });
    // External AI integration
    nodes.push({
      id: "ext-ai",
      type: "customService",
      position: { x: 500, y: 360 },
      data: {
        label: "External AI Provider",
        technology: "Groq / OpenAI API",
        tier: "DevOps",
      },
    });
  }

  if (hasAtsService && hasBackend) {
    nodes.push({
      id: "svc-ats",
      type: "customService",
      position: { x: 100, y: 480 },
      data: {
        label: "ATS Scoring Service",
        technology: "Resume Scoring & Parser",
        tier: "Backend",
      },
    });
  }

  if (hasDocExportService && hasBackend) {
    nodes.push({
      id: "svc-doc",
      type: "customService",
      position: { x: 300, y: 480 },
      data: {
        label: "Document & Export Service",
        technology: "PDF / DOCX Generation",
        tier: "Backend",
      },
    });
  }

  if (hasDatabase) {
    nodes.push({
      id: "database",
      type: "customService",
      position: { x: 250, y: 600 },
      data: {
        label: databaseLabel,
        technology: databaseTech,
        tier: "Database",
      },
    });
  }

  if (hasCache) {
    nodes.push({
      id: "cache",
      type: "customService",
      position: { x: 500, y: 600 },
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

  // Connect backend to sub-services if present
  const subServices = [];
  if (hasResumeService && hasBackend) {
    subServices.push("svc-resume");
    edges.push({
      id: "e-backend-svc-resume",
      source: "backend",
      target: "svc-resume",
      animated: true,
      label: "/api/v1/resumes",
    });
  }
  if (hasAiService && hasBackend) {
    subServices.push("svc-ai");
    edges.push({
      id: "e-backend-svc-ai",
      source: "backend",
      target: "svc-ai",
      animated: true,
      label: "/api/ai",
    });
    edges.push({
      id: "e-svc-ai-ext-ai",
      source: "svc-ai",
      target: "ext-ai",
      animated: true,
      label: "LLM API Calls",
    });
  }
  if (hasAtsService && hasBackend) {
    subServices.push("svc-ats");
    edges.push({
      id: "e-backend-svc-ats",
      source: "backend",
      target: "svc-ats",
      animated: true,
      label: "/api/v1/ats",
    });
  }
  if (hasDocExportService && hasBackend) {
    subServices.push("svc-doc");
    edges.push({
      id: "e-backend-svc-doc",
      source: "backend",
      target: "svc-doc",
      animated: true,
      label: "/api/v1/documents",
    });
  }

  // Connect to database
  if (hasDatabase) {
    if (subServices.length > 0) {
      for (const sId of subServices) {
        edges.push({
          id: `e-${sId}-database`,
          source: sId,
          target: "database",
          animated: true,
          label: "Mongoose / Queries",
        });
      }
    } else if (hasBackend) {
      edges.push({
        id: "e-backend-database",
        source: "backend",
        target: "database",
        animated: true,
        label: "ORM / Queries",
      });
    } else if (hasFrontend) {
      edges.push({
        id: "e-frontend-database",
        source: "frontend",
        target: "database",
        animated: true,
        label: "Direct Database Access",
      });
    }
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
