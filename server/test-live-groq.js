// server/test-live-groq.js
//
// Live API test for Groq LLM integration (llama-3.3-70b-versatile)

import dotenv from "dotenv";
dotenv.config();

import { generateArchitecture, generateERD } from "./src/services/llmService.js";

async function main() {
  console.log("=========================================");
  console.log("Testing Live Groq API (llama-3.3-70b)");
  console.log("=========================================\n");

  const sampleBlueprint = {
    metadata: {
      name: "ArchMind AI Platform",
      primaryLanguage: "JavaScript",
      techStack: {
        frameworks: ["Express.js", "React"],
        databases: ["MongoDB"],
        devops: ["Docker"],
      },
    },
    capabilities: {
      hasDatabase: true,
      hasApis: true,
      hasDevops: true,
      hasSecuritySensitiveCode: true,
      details: {
        databases: ["MongoDB"],
        frameworks: ["Express.js"],
      },
    },
    entryPoints: [
      { file: "src/server.js", type: "web-server" },
    ],
    routes: [
      { file: "src/routes/project.routes.js", method: "POST", path: "/api/projects/upload" },
      { file: "src/routes/user.routes.js", method: "GET", path: "/api/users/me" },
    ],
    models: [
      { file: "src/models/Project.js", name: "Project", framework: "mongoose" },
      { file: "src/models/User.js", name: "User", framework: "mongoose" },
    ],
  };

  console.log("1. Calling Groq generateArchitecture...");
  const archResult = await generateArchitecture(sampleBlueprint);
  console.log("\n--- Generated Architecture Result ---");
  console.log(JSON.stringify(archResult, null, 2));

  console.log("\n2. Calling Groq generateERD...");
  const erdResult = await generateERD(sampleBlueprint);
  console.log("\n--- Generated ERD Result ---");
  console.log(JSON.stringify(erdResult, null, 2));

  console.log("\n=========================================");
  console.log("✅ Live Groq API Test Completed Successfully!");
  console.log("=========================================");
}

main().catch(console.error);
