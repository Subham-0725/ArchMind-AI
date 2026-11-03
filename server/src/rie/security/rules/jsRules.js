// server/src/rie/security/rules/jsRules.js
//
// AST Security Rules for JavaScript and TypeScript source code using Tree-sitter.

function getNodeText(node, code) {
  if (!node) return "";
  return code.substring(node.startIndex, node.endIndex);
}

function getRedactedSnippet(code, node, maxLen = 140) {
  if (!node) return "";
  const snippet = code.substring(node.startIndex, node.endIndex).trim().replace(/\r?\n\s*/g, " ");
  return snippet.length > maxLen ? snippet.slice(0, maxLen - 3) + "..." : snippet;
}

export const JS_AST_RULES = [
  // 1. Dynamic Code Evaluation (eval / Function constructor)
  {
    id: "js-eval-injection",
    name: "Unsafe Dynamic Code Evaluation",
    category: "Unsafe Dynamic Evaluation",
    description: "Calling eval() or new Function() with dynamic expressions allows arbitrary code execution.",
    language: "javascript",
    severity: "Critical",
    confidence: "High",
    recommendation: "Avoid eval() or new Function(). Use JSON.parse() for structured data or refactor to deterministic logic.",
    references: ["https://owasp.org/www-community/attacks/Code_Injection", "CWE-95"],
    check: (node, code) => {
      // Direct call: eval(...)
      if (node.type === "call_expression") {
        const fnNode = node.childForFieldName("function");
        const argsNode = node.childForFieldName("arguments");
        if (!fnNode || !argsNode) return null;

        const fnName = getNodeText(fnNode, code).trim();
        if (fnName === "eval" || fnName === "window.eval" || fnName === "global.eval") {
          // Check if argument is a dynamic expression (not a single static string literal)
          const args = argsNode.namedChildren || [];
          if (args.length > 0) {
            const firstArg = args[0];
            const isLiteralString = firstArg.type === "string";
            return {
              confirmed: true,
              confidence: isLiteralString ? "Medium" : "High",
              node,
              redactedEvidence: getRedactedSnippet(code, node),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            };
          }
        }
      }

      // new Function(...)
      if (node.type === "new_expression") {
        const constructorNode = node.childForFieldName("constructor");
        if (constructorNode && getNodeText(constructorNode, code).trim() === "Function") {
          return {
            confirmed: true,
            confidence: "High",
            node,
            redactedEvidence: getRedactedSnippet(code, node),
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          };
        }
      }

      return null;
    },
  },

  // 2. Command Injection (child_process.exec, execSync, spawn with shell: true)
  {
    id: "js-command-injection",
    name: "OS Command Injection Risk",
    category: "Command Injection",
    description: "Executing shell commands with dynamic input allows attackers to execute unauthorized operating system commands.",
    language: "javascript",
    severity: "Critical",
    confidence: "High",
    recommendation: "Use child_process.execFile() or spawn() with explicit arguments arrays and ensure shell: false.",
    references: ["https://owasp.org/www-community/attacks/Command_Injection", "CWE-78"],
    check: (node, code) => {
      if (node.type !== "call_expression") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnText = getNodeText(fnNode, code).trim();
      const isExec =
        fnText === "exec" ||
        fnText === "execSync" ||
        fnText.endsWith(".exec") ||
        fnText.endsWith(".execSync");

      const isSpawn = fnText === "spawn" || fnText === "spawnSync" || fnText.endsWith(".spawn") || fnText.endsWith(".spawnSync");

      const args = argsNode.namedChildren || [];
      if (args.length === 0) return null;

      if (isExec) {
        const firstArg = args[0];
        // If first argument is dynamic (binary_expression, template_string with subs, or identifier)
        const isDynamic =
          firstArg.type === "binary_expression" ||
          firstArg.type === "identifier" ||
          (firstArg.type === "template_string" && firstArg.children.some((c) => c.type === "template_substitution"));

        return {
          confirmed: isDynamic,
          confidence: isDynamic ? "High" : "Medium",
          node,
          redactedEvidence: getRedactedSnippet(code, node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        };
      }

      if (isSpawn) {
        // Check options argument for shell: true
        const optionsArg = args[args.length - 1];
        if (optionsArg && optionsArg.type === "object") {
          const text = getNodeText(optionsArg, code);
          if (/shell\s*:\s*true/i.test(text)) {
            return {
              confirmed: true,
              confidence: "High",
              node,
              redactedEvidence: getRedactedSnippet(code, node),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            };
          }
        }
      }

      return null;
    },
  },

  // 3. Path Traversal
  {
    id: "js-path-traversal",
    name: "Arbitrary File Access & Path Traversal",
    category: "Path Traversal",
    description: "Passing user-controlled input to file system operations without boundary validation may allow reading or writing sensitive files.",
    language: "javascript",
    severity: "High",
    confidence: "Medium",
    recommendation: "Normalize paths using path.resolve() and verify the target path resides within an allowed base directory.",
    references: ["https://owasp.org/www-community/attacks/Path_Traversal", "CWE-22"],
    check: (node, code) => {
      if (node.type !== "call_expression") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnText = getNodeText(fnNode, code).trim();
      const isFsMethod =
        fnText === "readFile" ||
        fnText === "readFileSync" ||
        fnText === "writeFile" ||
        fnText === "writeFileSync" ||
        fnText === "createReadStream" ||
        fnText.endsWith(".readFile") ||
        fnText.endsWith(".readFileSync") ||
        fnText.endsWith(".writeFile") ||
        fnText.endsWith(".createReadStream") ||
        fnText.endsWith(".sendFile");

      if (!isFsMethod) return null;

      const args = argsNode.namedChildren || [];
      if (args.length === 0) return null;

      const pathArgText = getNodeText(args[0], code);
      // Check if path argument directly concatenates or derives from request parameters
      const hasUserInput = /req\.(query|params|body|url)/.test(pathArgText) ||
        /\.\.\//.test(pathArgText);

      if (hasUserInput) {
        return {
          confirmed: true,
          confidence: "High",
          node,
          redactedEvidence: getRedactedSnippet(code, node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        };
      }

      return null;
    },
  },

  // 4. Insecure Cryptography (MD5, SHA-1, createCipher)
  {
    id: "js-insecure-crypto",
    name: "Weak Cryptographic Primitive / Algorithm",
    category: "Insecure Cryptography",
    description: "Use of broken cryptographic hash algorithms (MD5, SHA1) or deprecated cipher modes leaves data vulnerable to collisions or attacks.",
    language: "javascript",
    severity: "Medium",
    confidence: "High",
    recommendation: "Use SHA-256 or SHA-512 for checksums, bcrypt/argon2 for password hashing, and crypto.createCipheriv() with AES-256-GCM for encryption.",
    references: ["https://cwe.mitre.org/data/definitions/327.html", "CWE-327"],
    check: (node, code) => {
      if (node.type !== "call_expression") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnText = getNodeText(fnNode, code).trim();

      // crypto.createCipher(...) (deprecated, lacks IV)
      if (fnText === "crypto.createCipher" || fnText.endsWith(".createCipher")) {
        return {
          confirmed: true,
          confidence: "High",
          node,
          redactedEvidence: getRedactedSnippet(code, node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        };
      }

      // crypto.createHash("md5") or crypto.createHash("sha1")
      if (fnText === "crypto.createHash" || fnText.endsWith(".createHash")) {
        const args = argsNode.namedChildren || [];
        if (args.length > 0) {
          const argVal = getNodeText(args[0], code).toLowerCase().replace(/["']/g, "");
          if (argVal === "md5" || argVal === "sha1") {
            return {
              confirmed: true,
              confidence: "High",
              node,
              redactedEvidence: getRedactedSnippet(code, node),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            };
          }
        }
      }

      return null;
    },
  },

  // 5. NoSQL Injection ($where clause)
  {
    id: "js-nosql-injection",
    name: "NoSQL Injection Risk ($where evaluation)",
    category: "Injection Vulnerabilities",
    description: "MongoDB $where expressions evaluate JavaScript strings on the database server, leading to NoSQL injection and DoS risks.",
    language: "javascript",
    severity: "High",
    confidence: "High",
    recommendation: "Avoid $where operators. Use standard BSON query operators ($eq, $in, $gte) with parameterized inputs.",
    references: ["https://owasp.org/www-community/attacks/Testing_for_NoSQL_Injection", "CWE-943"],
    check: (node, code) => {
      if (node.type === "pair" || node.type === "property") {
        const keyNode = node.childForFieldName("key");
        if (keyNode) {
          const keyText = getNodeText(keyNode, code).replace(/["']/g, "").trim();
          if (keyText === "$where") {
            return {
              confirmed: true,
              confidence: "High",
              node,
              redactedEvidence: getRedactedSnippet(code, node),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            };
          }
        }
      }
      return null;
    },
  },

  // 6. Prototype Pollution
  {
    id: "js-prototype-pollution",
    name: "Prototype Pollution Vulnerability",
    category: "Prototype Pollution",
    description: "Modifying Object.prototype or setting __proto__ properties dynamically allows attackers to alter application object behavior globally.",
    language: "javascript",
    severity: "High",
    confidence: "Medium",
    recommendation: "Prevent prototype pollution by validating keys against '__proto__', 'constructor', and 'prototype', or use Object.create(null).",
    references: ["https://owasp.org/www-community/attacks/Prototype_Pollution", "CWE-1321"],
    check: (node, code) => {
      if (node.type === "assignment_expression") {
        const leftNode = node.childForFieldName("left");
        if (leftNode) {
          const leftText = getNodeText(leftNode, code);
          if (leftText.includes("__proto__") || leftText.includes("Object.prototype.")) {
            return {
              confirmed: true,
              confidence: "High",
              node,
              redactedEvidence: getRedactedSnippet(code, node),
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
            };
          }
        }
      }
      return null;
    },
  },
];

