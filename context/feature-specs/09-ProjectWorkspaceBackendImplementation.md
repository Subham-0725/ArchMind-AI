# Project Workspace Backend Implementation

## 1. Overview

This feature specification defines the **backend foundation** required for the ArchMind AI **Project Workspace**. 

The backend exposes a structured, comprehensive project workspace contract via `GET /api/projects/:id` containing:
* Project core metadata (`id`, `name`, `source`, `status`)
* Summary statistics & file overview (`totalFiles`, `totalDirectories`, `totalSize`, `topExtensions`)
* Multi-signal language detection metrics (`primary`, `secondary`, `confidence`)
* Categorized technology stack breakdown (`languages`, `frameworks`, `databases`, `devops`)
* Sanitized file tree
* Deterministic system topology graph (`nodes` and `edges` for React Flow rendering)
* Feature capability flags (`architecture`, `erd`, `securityAudit`, `devops`)

The backend implementation requires **zero external LLM calls** and operates deterministically on verified repository evidence.

---

## 2. Architecture & Pipeline Placement

The Project Workspace Backend layer sits directly after repository ingestion, scanning, and language detection:

```text
User Request / Frontend Workspace Load
                  │
                  ▼
       GET /api/projects/:id
                  │
                  ▼
     Clerk Auth & userId Validation
                  │
                  ▼
        Fetch MongoDB Project
                  │
   Topology Exists in DB?
    ├── YES ──► Return Persisted Topology
    └── NO  ──► Execute buildTopology(project) & Async Persist
                  │
                  ▼
     Compile Workspace Contract JSON Payload
                  │
                  ▼
      HTTP 200 Response to Client
```

---

## 3. API Contract (`GET /api/projects/:id`)

### Response Structure

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "673f1a2b8c9d0e1f2a3b4c5d",
      "name": "ArchMind AI",
      "source": "github",
      "status": "uploaded"
    },
    "overview": {
      "totalFiles": 142,
      "totalDirectories": 28,
      "totalSize": 1845200,
      "topExtensions": [
        { "extension": ".js", "count": 65 },
        { "extension": ".jsx", "count": 42 },
        { "extension": ".json", "count": 12 }
      ]
    },
    "languages": {
      "primary": "JavaScript",
      "secondary": ["TypeScript"],
      "confidence": 0.98
    },
    "techStack": {
      "languages": ["JavaScript", "TypeScript"],
      "frameworks": ["React", "Express.js"],
      "databases": ["MongoDB"],
      "devops": ["Docker"]
    },
    "tree": [
      { "path": "package.json", "type": "file", "size": 450 },
      { "path": "server/src/server.js", "type": "file", "size": 1200 }
    ],
    "topology": {
      "nodes": [
        {
          "id": "frontend",
          "type": "customService",
          "position": { "x": 250, "y": 100 },
          "data": {
            "label": "React Frontend",
            "technology": "React + Vite",
            "tier": "Frontend"
          }
        },
        {
          "id": "backend",
          "type": "customService",
          "position": { "x": 250, "y": 250 },
          "data": {
            "label": "Express.js API",
            "technology": "Node.js / Express.js",
            "tier": "Backend"
          }
        },
        {
          "id": "database",
          "type": "customService",
          "position": { "x": 250, "y": 400 },
          "data": {
            "label": "MongoDB Database",
            "technology": "MongoDB + Mongoose",
            "tier": "Database"
          }
        }
      ],
      "edges": [
        {
          "id": "e-frontend-backend",
          "source": "frontend",
          "target": "backend",
          "animated": true,
          "label": "HTTP / REST API"
        },
        {
          "id": "e-backend-database",
          "source": "backend",
          "target": "database",
          "animated": true,
          "label": "ORM / Queries"
        }
      ],
      "generatedAt": "2026-09-27T00:50:00.000Z"
    },
    "capabilities": {
      "architecture": true,
      "erd": true,
      "securityAudit": false,
      "devops": true
    },
    "id": "673f1a2b8c9d0e1f2a3b4c5d",
    "name": "ArchMind AI",
    "source": "github",
    "status": "uploaded",
    "github": {},
    "zip": {},
    "stats": {},
    "primaryLanguage": "JavaScript",
    "secondaryLanguages": ["TypeScript"],
    "languageDetectionConfidence": 0.98,
    "errorDetails": null,
    "createdAt": "2026-09-27T00:00:00.000Z",
    "updatedAt": "2026-09-27T00:00:00.000Z"
  }
}
```

---

## 4. Deterministic System Topology Generator (`topologyBuilder.js`)

Located in `server/src/rie/topologyBuilder.js`.

The builder derives React Flow nodes and edges by inspecting empirical repository evidence without making assumptions or hallucinating non-existent tiers.

### Tier Detection Rules

1. **Frontend Tier (`tier: "Frontend"`)**:
   * **Framework Signals**: `React`, `Vue`, `Angular`, `Svelte`, `Next.js`, `Nuxt`, `Remix`, `Vite`, `Gatsby`, `Ember`, `Alpine.js`.
   * **Path Signals**: Directories named `client/`, `frontend/`, `public/`, or extensions `.jsx`, `.tsx`, `.vue`, `.svelte`.
   * **Node ID**: `"frontend"`

2. **Backend Tier (`tier: "Backend"`)**:
   * **Framework Signals**: `Express`, `Express.js`, `Fastify`, `NestJS`, `Koa`, `Hono`, `Django`, `Flask`, `FastAPI`, `Spring Boot`, `Quarkus`, `Ktor`, `Gin`, `Echo`, `Fiber`, `Chi`, `Actix`, `Axum`, `Rocket`, `Laravel`, `Symfony`, `Slim`, `Rails`, `Sinatra`, `ASP.NET`.
   * **Path Signals**: Directories named `server/`, `backend/`, `api/`, `controllers/`, `routes/`, `services/`, `middleware/`, or entry files `server.js`, `app.js`, `main.py`, `main.go`.
   * **Node ID**: `"backend"`

3. **Database & Storage Tier (`tier: "Database"`)**:
   * **Database & ORM Signals**: `MongoDB`, `PostgreSQL`, `MySQL`, `SQLite`, `Prisma`, `Drizzle`, `Sequelize`, `Mongoose`, `SQLAlchemy`, `GORM`, `Diesel`, `SQLx`, `Doctrine`, `Mongoid`.
   * **Cache Signals**: `Redis`, `Memcached`.
   * **Node IDs**: `"database"`, `"cache"`

4. **DevOps & Infrastructure Tier (`tier: "DevOps"`)**:
   * **Tooling Signals**: `Docker`, `Kubernetes`, `GitHub Actions`, `Travis CI`, `CircleCI`, `Jenkins`, `GitLab CI`.
   * **Path Signals**: `Dockerfile`, `docker-compose.yml`, `.github/workflows/`, `k8s/`.
   * **Node ID**: `"devops"`

5. **Fallback Single Tier**:
   * If no frontend, backend, database, or devops signal exists, a default service node is built using `primaryLanguage` or repository name:
   * **Node ID**: `"app-service"`

### Edge Rules

* **Frontend → Backend**: `{ id: "e-frontend-backend", source: "frontend", target: "backend", animated: true, label: "HTTP / REST API" }`
* **Backend → Database**: `{ id: "e-backend-database", source: "backend", target: "database", animated: true, label: "ORM / Queries" }`
* **Backend → Cache**: `{ id: "e-backend-cache", source: "backend", target: "cache", animated: true, label: "Cache Reads / Writes" }`
* **Frontend → Database (Direct)**: `{ id: "e-frontend-database", source: "frontend", target: "database", animated: true, label: "Direct Database Access" }`
* **DevOps → Service**: `{ id: "e-devops-backend", source: "devops", target: "backend", animated: true, label: "Builds & Deploys" }`

---

## 5. MongoDB Schema Definition (`Project.js`)

Add `topology` field to the Mongoose project schema:

```javascript
topology: {
  nodes: { type: Array, default: [] },
  edges: { type: Array, default: [] },
  generatedAt: { type: Date, default: null },
}
```

The `topology` block is included in `projectSchema.methods.toSafeObject()`.

---

## 6. Capability Flags

The `capabilities` sub-object informs the Workspace frontend which analysis actions are valid for the current project:

* `architecture`: `true` (standard static architecture visualization is always supported for valid codebases)
* `erd`: `true` if any database or ORM is detected; `false` otherwise
* `securityAudit`: `false` (reserved for downstream AI security audit phase)
* `devops`: `true` if Docker, Kubernetes, or CI/CD pipelines are detected; `false` otherwise

---

## 7. Security & Performance Invariants

1. **Multi-Tenant Isolation**: Every project fetch query filters by `{ _id: id, userId }` extracted from the Clerk JWT session via `getAuth(req)`.
2. **Zero LLM Latency**: Topology generation is 100% static and executes in under `5ms`.
3. **Automatic Persistence**: Topology generated on-the-fly during legacy project queries is saved back to MongoDB asynchronously.
