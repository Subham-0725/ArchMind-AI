// scratch/test-workspace-backend.js
import { buildTopology } from "../server/src/rie/topologyBuilder.js";

console.log("=== Testing Project Workspace Backend Topology Generator ===");

// 1. Full Stack Project (React + Express + MongoDB + Docker + GitHub Actions)
const fullStackProject = {
  name: "ArchMind AI FullStack",
  primaryLanguage: "TypeScript",
  secondaryLanguages: ["JavaScript"],
  techStack: {
    languages: ["TypeScript", "JavaScript"],
    frameworks: ["React", "Express.js"],
    databases: ["MongoDB", "Mongoose"],
    devops: ["Docker", "GitHub Actions"],
  },
  tree: [
    { path: "client/package.json", type: "file", size: 400 },
    { path: "client/src/App.tsx", type: "file", size: 1200 },
    { path: "server/package.json", type: "file", size: 500 },
    { path: "server/src/server.ts", type: "file", size: 800 },
    { path: "Dockerfile", type: "file", size: 250 },
    { path: ".github/workflows/deploy.yml", type: "file", size: 600 },
  ],
};

const fullStackTopo = buildTopology(fullStackProject);
console.log("\n1. Full Stack Topology:");
console.log("Nodes:", JSON.stringify(fullStackTopo.nodes, null, 2));
console.log("Edges:", JSON.stringify(fullStackTopo.edges, null, 2));

// 2. Frontend-Only Project (React + Vite)
const frontendOnlyProject = {
  name: "React Landing Page",
  primaryLanguage: "JavaScript",
  secondaryLanguages: [],
  techStack: {
    languages: ["JavaScript"],
    frameworks: ["React", "Vite"],
    databases: [],
    devops: [],
  },
  tree: [
    { path: "package.json", type: "file", size: 300 },
    { path: "src/App.jsx", type: "file", size: 900 },
    { path: "vite.config.js", type: "file", size: 200 },
  ],
};

const frontendTopo = buildTopology(frontendOnlyProject);
console.log("\n2. Frontend-Only Topology:");
console.log("Nodes:", JSON.stringify(frontendTopo.nodes, null, 2));
console.log("Edges:", JSON.stringify(frontendTopo.edges, null, 2));

// 3. Backend-Only Project (Express API)
const backendOnlyProject = {
  name: "Express Auth Microservice",
  primaryLanguage: "JavaScript",
  secondaryLanguages: [],
  techStack: {
    languages: ["JavaScript"],
    frameworks: ["Express"],
    databases: [],
    devops: [],
  },
  tree: [
    { path: "package.json", type: "file", size: 350 },
    { path: "app.js", type: "file", size: 600 },
    { path: "routes/auth.js", type: "file", size: 400 },
  ],
};

const backendTopo = buildTopology(backendOnlyProject);
console.log("\n3. Backend-Only Topology:");
console.log("Nodes:", JSON.stringify(backendTopo.nodes, null, 2));
console.log("Edges:", JSON.stringify(backendTopo.edges, null, 2));

// 4. Backend + PostgreSQL Project
const pgProject = {
  name: "FastAPI + Postgres",
  primaryLanguage: "Python",
  secondaryLanguages: [],
  techStack: {
    languages: ["Python"],
    frameworks: ["FastAPI"],
    databases: ["PostgreSQL", "SQLAlchemy"],
    devops: [],
  },
  tree: [
    { path: "requirements.txt", type: "file", size: 200 },
    { path: "main.py", type: "file", size: 1000 },
    { path: "models/user.py", type: "file", size: 500 },
  ],
};

const pgTopo = buildTopology(pgProject);
console.log("\n4. Backend + PostgreSQL Topology:");
console.log("Nodes:", JSON.stringify(pgTopo.nodes, null, 2));
console.log("Edges:", JSON.stringify(pgTopo.edges, null, 2));

// Assertions
if (fullStackTopo.nodes.length !== 4) throw new Error("Expected 4 nodes for fullstack project");
if (fullStackTopo.edges.length !== 3) throw new Error("Expected 3 edges for fullstack project");
if (frontendTopo.nodes.length !== 1 || frontendTopo.nodes[0].id !== "frontend") throw new Error("Expected 1 frontend node");
if (frontendTopo.edges.length !== 0) throw new Error("Expected 0 edges for frontend-only project");
if (backendTopo.nodes.length !== 1 || backendTopo.nodes[0].id !== "backend") throw new Error("Expected 1 backend node");
if (pgTopo.nodes.length !== 2) throw new Error("Expected 2 nodes for backend+postgres");

console.log("\n✅ ALL WORKSPACE BACKEND TOPOLOGY TESTS PASSED SUCCESSFULLY!");
