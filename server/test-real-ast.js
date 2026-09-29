// server/test-real-ast.js
//
// Test script to run Tree-sitter AST parsing against the server's own codebase.

import path from "path";
import { scanRepository } from "./src/rie/repoScanner.js";
import { parseRepository } from "./src/rie/astParser.js";

async function main() {
  console.log("Parsing current ArchMind AI server directory...");
  const serverDir = path.resolve(".");

  // 1. Scan directory for tree
  const { tree, stats } = scanRepository(serverDir);
  console.log(`Scanned ${stats.totalFiles} files in repository tree.\n`);

  // 2. Run AST parser
  const ast = await parseRepository(tree, { extractionPath: serverDir });

  console.log("=== AST Parsing Summary ===");
  console.log(JSON.stringify(ast.summary, null, 2));

  console.log("\n=== Extracted Functions (First 5) ===");
  console.log(JSON.stringify(ast.functions.slice(0, 5), null, 2));

  console.log("\n=== Extracted External Dependencies ===");
  console.log(JSON.stringify(ast.dependencies.external.slice(0, 10), null, 2));

  console.log("\n=== Extracted Express Routes ===");
  console.log(JSON.stringify(ast.routes, null, 2));

  console.log("\n=== Extracted Entry Points ===");
  console.log(JSON.stringify(ast.entryPoints, null, 2));
}

main().catch(console.error);
