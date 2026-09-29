// server/test-real-blueprint.js
//
// Integration test: Generates a full Repository Blueprint for the server codebase itself.

import path from "path";
import { scanRepository } from "./src/rie/repoScanner.js";
import { detectProjectLanguage } from "./src/services/languageDetector.js";
import { detectCapabilities } from "./src/rie/relevanceDetector.js";
import { parseRepository } from "./src/rie/astParser.js";
import { aggregateBlueprint } from "./src/rie/blueprintAggregator.js";

async function main() {
  console.log("Generating Repository Blueprint for ArchMind AI server...");
  const serverDir = path.resolve(".");

  // 1. Scan tree
  const { tree, techStack } = scanRepository(serverDir);

  // 2. Language detection
  const langResult = detectProjectLanguage(tree, serverDir);

  // 3. Capabilities detection
  const capabilities = detectCapabilities(tree, techStack, serverDir);

  // 4. Tree-sitter AST parsing
  const ast = await parseRepository(tree, { extractionPath: serverDir });

  // 5. Aggregate Blueprint
  const blueprint = aggregateBlueprint({
    name: "ArchMind AI Server",
    source: "local",
    tree,
    techStack,
    primaryLanguage: langResult.primaryLanguage,
    secondaryLanguages: langResult.secondaryLanguages,
    capabilities,
    ast,
  });

  console.log("\n=========================================");
  console.log("REPOSITORY BLUEPRINT SUMMARY");
  console.log("=========================================");
  console.log("Version:", blueprint.version);
  console.log("Generated At:", blueprint.generatedAt);
  console.log("Primary Language:", blueprint.metadata.primaryLanguage);
  console.log("Capabilities:", blueprint.capabilities);
  console.log("Entry Points:", blueprint.entryPoints.map((e) => e.file));
  console.log("Structure Count:", blueprint.structure.length, "files");
  console.log("Internal Dependencies:", blueprint.dependencies.internal.length);
  console.log("External Dependencies:", blueprint.dependencies.external.length);
  console.log("Express Routes Count:", blueprint.routes.length);
  console.log("Token Estimate:", blueprint.tokenEstimate, "tokens");
  console.log("Is Budget Truncated:", blueprint.isBudgetTruncated);
  console.log("=========================================\n");
}

main().catch(console.error);
