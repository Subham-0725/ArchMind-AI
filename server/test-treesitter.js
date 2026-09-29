import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";

console.log("Testing Tree-sitter imports...");
try {
  const parser = new Parser();
  parser.setLanguage(JavaScript);

  const sourceCode = "function hello(name) { return `Hello ${name}`; }";
  const tree = parser.parse(sourceCode);
  console.log("JS Root Node Type:", tree.rootNode.type);
  console.log("JS Root Child Count:", tree.rootNode.childCount);

  // Test TypeScript
  const tsParser = new Parser();
  tsParser.setLanguage(TypeScript.typescript);
  const tsTree = tsParser.parse("interface User { id: string; name: string; }");
  console.log("TS Root Node Type:", tsTree.rootNode.type);

  // Test Python
  const pyParser = new Parser();
  pyParser.setLanguage(Python);
  const pyTree = pyParser.parse("def greet(name):\n    return f'Hello {name}'\n");
  console.log("Python Root Node Type:", pyTree.rootNode.type);

  console.log("SUCCESS: All Tree-sitter parsers initialized and parsed successfully!");
} catch (err) {
  console.error("Tree-sitter test error:", err);
  process.exit(1);
}
