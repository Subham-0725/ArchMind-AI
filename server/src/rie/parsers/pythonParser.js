// server/src/rie/parsers/pythonParser.js
//
// Tree-sitter AST parser for Python (.py) files.
// Extracts imports, functions, classes, methods, routes (FastAPI/Flask/Django), and database models.

import Parser from "tree-sitter";
import Python from "tree-sitter-python";

let pyParser = null;

function getPythonParser() {
  if (!pyParser) {
    pyParser = new Parser();
    pyParser.setLanguage(Python);
  }
  return pyParser;
}

function getNodeText(node, code) {
  if (!node) return "";
  return code.substring(node.startIndex, node.endIndex);
}

/**
 * Extracts Python AST metadata from source code.
 *
 * @param {string} filePath - Relative file path in repository
 * @param {string} code - File source code text
 * @returns {Object} Extracted Python metadata
 */
export function parsePythonFile(filePath, code) {
  const parser = getPythonParser();
  const tree = parser.parse(code);
  const root = tree.rootNode;

  const result = {
    file: filePath,
    language: "python",
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    routes: [],
    models: [],
    entryPoints: [],
  };

  function visit(node) {
    if (!node) return;

    const type = node.type;

    // 1. Import statements
    if (type === "import_statement") {
      extractPythonImport(node, code, filePath, result);
    } else if (type === "import_from_statement") {
      extractPythonFromImport(node, code, filePath, result);
    }
    // 2. Decorated definition (e.g. @app.get(...))
    else if (type === "decorated_definition") {
      extractPythonDecorated(node, code, filePath, result);
    }
    // 3. Function definitions: def foo(bar): ...
    else if (type === "function_definition") {
      extractPythonFunction(node, code, filePath, result);
    }
    // 4. Class definitions: class User(Base): ...
    else if (type === "class_definition") {
      extractPythonClass(node, code, filePath, result);
    }

    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i));
    }
  }

  visit(root);

  // Check if main entry point
  if (
    /main\.py$|app\.py$|server\.py$|wsgi\.py$|manage\.py$/i.test(filePath) ||
    code.includes('if __name__ == "__main__":') ||
    code.includes("if __name__ == '__main__':")
  ) {
    result.entryPoints.push({
      file: filePath,
      type: "python-app",
    });
  }

  return result;
}

// ── Extraction Helpers ────────────────────────────────────────────────────────

function extractPythonImport(node, code, filePath, result) {
  const text = getNodeText(node, code);
  const nameNode = node.childForFieldName("name") || node.children.find((c) => c.type === "dotted_name");
  const moduleName = nameNode ? getNodeText(nameNode, code) : text.replace(/^import\s+/, "").split(",")[0].trim();

  if (moduleName) {
    const isInternal = moduleName.startsWith(".") || moduleName.includes("app.") || moduleName.includes("src.");
    result.imports.push({
      file: filePath,
      source: moduleName,
      isInternal,
      specifiers: [moduleName],
      raw: text,
    });
  }
}

function extractPythonFromImport(node, code, filePath, result) {
  const text = getNodeText(node, code);
  const moduleNameNode = node.childForFieldName("module_name") || node.children.find((c) => c.type === "dotted_name" || c.type === "relative_import");
  const source = moduleNameNode ? getNodeText(moduleNameNode, code) : "";

  const specifiers = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "import_prefix" || child.type === "dotted_name" || child.type === "identifier") {
      if (child !== moduleNameNode) {
        specifiers.push(getNodeText(child, code));
      }
    }
  }

  if (source) {
    const isInternal = source.startsWith(".") || source.includes("app") || source.includes("models") || source.includes("services");
    result.imports.push({
      file: filePath,
      source,
      isInternal,
      specifiers: specifiers.slice(1),
      raw: text,
    });
  }
}

function extractPythonFunction(node, code, filePath, result) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode ? getNodeText(nameNode, code) : "anonymous";
  const paramsNode = node.childForFieldName("parameters");
  const paramsStr = paramsNode ? getNodeText(paramsNode, code).replace(/[\(\)\s]/g, "") : "";
  const params = paramsStr.split(",").filter(Boolean);

  const isAsync = node.text.trim().startsWith("async");

  // Prevent duplicate if handled by extractPythonDecorated
  if (node.parent && node.parent.type === "decorated_definition") return;

  result.functions.push({
    file: filePath,
    name,
    params,
    isAsync,
    line: node.startPosition.row + 1,
  });
}

function extractPythonDecorated(node, code, filePath, result) {
  const defNode = node.childForFieldName("definition");
  const funcNode = (defNode && defNode.type === "function_definition") ? defNode : node.children.find((c) => c.type === "function_definition");

  let funcName = "anonymous";
  let isAsync = false;
  let params = [];

  if (funcNode) {
    const nameNode = funcNode.childForFieldName("name");
    if (nameNode) funcName = getNodeText(nameNode, code);
    const paramsNode = funcNode.childForFieldName("parameters");
    if (paramsNode) {
      params = getNodeText(paramsNode, code).replace(/[\(\)\s]/g, "").split(",").filter(Boolean);
    }
    isAsync = funcNode.text.trim().startsWith("async");

    result.functions.push({
      file: filePath,
      name: funcName,
      params,
      isAsync,
      line: funcNode.startPosition.row + 1,
    });
  }

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "decorator") {
      const decText = getNodeText(child, code);
      const routeMatch = decText.match(/@(\w+)\.(get|post|put|delete|patch|options|head|route)\s*\(\s*['"]([^'"]+)['"]/i);
      if (routeMatch) {
        result.routes.push({
          file: filePath,
          framework: "fastapi/flask",
          method: routeMatch[2].toUpperCase(),
          path: routeMatch[3],
          handler: funcName,
          line: child.startPosition.row + 1,
        });
      }
    }
  }
}

function extractPythonClass(node, code, filePath, result) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode ? getNodeText(nameNode, code) : "AnonymousClass";

  let superClass = null;
  const superNode = node.childForFieldName("superclasses");
  if (superNode) {
    superClass = getNodeText(superNode, code).replace(/[\(\)\s]/g, "").trim();
  }

  const methods = [];
  const bodyNode = node.childForFieldName("body");
  if (bodyNode) {
    for (let i = 0; i < bodyNode.childCount; i++) {
      const child = bodyNode.child(i);
      if (child.type === "function_definition") {
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

  // Check if ORM model
  if (superClass && (superClass.includes("Model") || superClass.includes("Base") || superClass.includes("db.Model"))) {
    result.models.push({
      file: filePath,
      name,
      framework: superClass.includes("models.Model") ? "django" : "sqlalchemy",
      line: node.startPosition.row + 1,
    });
  }
}
