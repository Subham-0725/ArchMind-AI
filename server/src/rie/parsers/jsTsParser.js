// server/src/rie/parsers/jsTsParser.js
//
// Tree-sitter AST parser for JavaScript, JSX, TypeScript, and TSX files.
// Extracts imports, exports, functions, classes, methods, routes, database models, and entry points.

import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";

// Lazy-instantiate parsers
let jsParser = null;
let tsParser = null;
let tsxParser = null;

function getParserForExt(ext) {
  const extension = (ext || "").toLowerCase();
  if (extension === ".ts") {
    if (!tsParser) {
      tsParser = new Parser();
      tsParser.setLanguage(TypeScript.typescript);
    }
    return tsParser;
  } else if (extension === ".tsx") {
    if (!tsxParser) {
      tsxParser = new Parser();
      tsxParser.setLanguage(TypeScript.tsx);
    }
    return tsxParser;
  } else {
    if (!jsParser) {
      jsParser = new Parser();
      jsParser.setLanguage(JavaScript);
    }
    return jsParser;
  }
}

/**
 * Get node text helper
 */
function getNodeText(node, code) {
  if (!node) return "";
  return code.substring(node.startIndex, node.endIndex);
}

/**
 * Extracts JS/TS AST metadata from source code.
 *
 * @param {string} filePath - Relative file path in repository
 * @param {string} code - File source code text
 * @returns {Object} Extracted JS/TS metadata
 */
export function parseJsTsFile(filePath, code) {
  const ext = filePath.substring(filePath.lastIndexOf("."));
  const parser = getParserForExt(ext);
  const tree = parser.parse(code);
  const root = tree.rootNode;

  const result = {
    file: filePath,
    language: ext.includes("ts") ? "typescript" : "javascript",
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    routes: [],
    models: [],
    entryPoints: [],
  };

  // Helper visitor function
  function visit(node) {
    if (!node) return;

    const type = node.type;

    // 1. ES Import Declaration: import x from 'y'; import { a, b } from 'c'; import * as z from 'd';
    if (type === "import_statement") {
      extractEsImport(node, code, filePath, result);
    }
    // 2. CommonJS Require: const x = require('y');
    else if (type === "lexical_declaration" || type === "variable_declaration") {
      extractCjsRequire(node, code, filePath, result);
      extractJsModel(node, code, filePath, result);
    }
    // 3. Export Statement: export default ..., export const x = ...
    else if (type === "export_statement") {
      extractExport(node, code, filePath, result);
    }
    // 4. Function Declaration: function foo(...) {}
    else if (type === "function_declaration" || type === "generator_function_declaration") {
      const nameNode = node.childForFieldName("name");
      const name = nameNode ? getNodeText(nameNode, code) : "anonymous";
      const params = extractParams(node.childForFieldName("parameters"), code);
      const isAsync = node.text.startsWith("async");

      result.functions.push({
        file: filePath,
        name,
        params,
        isAsync,
        line: node.startPosition.row + 1,
      });
    }
    // 5. Class Declaration: class User extends Model {}
    else if (type === "class_declaration" || type === "class") {
      extractClass(node, code, filePath, result);
    }
    // 6. Express/Fastify/Router route calls: app.get('/path', handler), router.post(...)
    else if (type === "call_expression") {
      extractRouteCall(node, code, filePath, result);
    }

    // Traverse children
    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i));
    }
  }

  visit(root);

  // Check if file is a potential entry point (e.g. server.js, index.js with express listen or app setup)
  if (
    /server\.[jt]sx?$|app\.[jt]sx?$|main\.[jt]sx?$|index\.[jt]sx?$/i.test(filePath) &&
    (code.includes(".listen(") || code.includes("express()") || code.includes("Fastify()"))
  ) {
    result.entryPoints.push({
      file: filePath,
      type: "web-server",
    });
  }

  return result;
}

// ── Extraction Helpers ────────────────────────────────────────────────────────

function extractEsImport(node, code, filePath, result) {
  let source = "";
  const specifiers = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "string") {
      source = getNodeText(child, code).replace(/['"]/g, "");
    } else if (child.type === "import_clause" || child.type === "named_imports") {
      const specText = getNodeText(child, code);
      specifiers.push(...specText.replace(/[\{\}\s]/g, "").split(",").filter(Boolean));
    }
  }

  if (source) {
    const isInternal = source.startsWith(".") || source.startsWith("@/") || source.startsWith("~/");
    result.imports.push({
      file: filePath,
      source,
      isInternal,
      specifiers,
      raw: getNodeText(node, code),
    });
  }
}

function extractCjsRequire(node, code, filePath, result) {
  const text = getNodeText(node, code);
  const requireMatch = text.match(/(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (requireMatch) {
    const specRaw = requireMatch[1] || requireMatch[2] || "";
    const specifiers = specRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const source = requireMatch[3];
    const isInternal = source.startsWith(".") || source.startsWith("@/") || source.startsWith("~/");

    result.imports.push({
      file: filePath,
      source,
      isInternal,
      specifiers,
      raw: text,
    });
  }
}

function extractExport(node, code, filePath, result) {
  const text = getNodeText(node, code);
  const isDefault = text.includes("export default");

  let name = isDefault ? "default" : "unknown";
  let type = "variable";

  if (text.includes("function")) {
    type = "function";
    const match = text.match(/function\s*([a-zA-Z0-9_$]+)/);
    if (match) name = match[1];
  } else if (text.includes("class")) {
    type = "class";
    const match = text.match(/class\s*([a-zA-Z0-9_$]+)/);
    if (match) name = match[1];
  } else if (text.includes("const") || text.includes("let") || text.includes("var")) {
    const match = text.match(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)/);
    if (match) name = match[1];
  }

  result.exports.push({
    file: filePath,
    name,
    type,
    isDefault,
    line: node.startPosition.row + 1,
  });
}

function extractClass(node, code, filePath, result) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode ? getNodeText(nameNode, code) : "AnonymousClass";

  let superClass = null;
  const heritageNode = node.children.find((c) => c.type === "class_heritage");
  if (heritageNode) {
    superClass = getNodeText(heritageNode, code).replace(/^extends\s+/, "").trim();
  }

  const methods = [];
  const bodyNode = node.childForFieldName("body");
  if (bodyNode) {
    for (let i = 0; i < bodyNode.childCount; i++) {
      const child = bodyNode.child(i);
      if (child.type === "method_definition") {
        const mNameNode = child.childForFieldName("name");
        if (mNameNode) {
          methods.push(getNodeText(mNameNode, code));
        }
      }
    }
  }

  result.classes.push({
    file: filePath,
    name,
    superClass,
    methods,
    line: node.startPosition.row + 1,
  });
}

function extractRouteCall(node, code, filePath, result) {
  const callee = node.childForFieldName("function");
  if (!callee || callee.type !== "member_expression") return;

  const propNode = callee.childForFieldName("property");
  if (!propNode) return;

  const method = getNodeText(propNode, code).toUpperCase();
  const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "ALL", "USE"]);

  if (!HTTP_METHODS.has(method)) return;

  const argsNode = node.childForFieldName("arguments");
  if (!argsNode || argsNode.childCount === 0) return;

  const firstArg = argsNode.namedChild(0);
  let pathStr = "";
  if (firstArg && firstArg.type === "string") {
    pathStr = getNodeText(firstArg, code).replace(/['"]/g, "");
  }

  if (pathStr || method === "USE") {
    const objNode = callee.childForFieldName("object");
    const objectName = objNode ? getNodeText(objNode, code) : "app";

    result.routes.push({
      file: filePath,
      framework: "express",
      method,
      path: pathStr || "/",
      object: objectName,
      line: node.startPosition.row + 1,
    });
  }
}

function extractJsModel(node, code, filePath, result) {
  const text = getNodeText(node, code);
  // Mongoose model detection: mongoose.model('User', userSchema)
  if (text.includes("mongoose.model") || text.includes("new Schema(")) {
    const match = text.match(/mongoose\.model\s*\(\s*['"]([^'"]+)['"]/);
    const modelName = match ? match[1] : filePath.substring(filePath.lastIndexOf("/") + 1).replace(/\.[jt]sx?$/, "");
    result.models.push({
      file: filePath,
      name: modelName,
      framework: "mongoose",
      line: node.startPosition.row + 1,
    });
  }
}

function extractParams(paramsNode, code) {
  if (!paramsNode) return [];
  const text = getNodeText(paramsNode, code);
  return text
    .replace(/[\(\)\{\}\s]/g, "")
    .split(",")
    .filter(Boolean);
}
