// server/src/rie/security/rules/pythonRules.js
//
// AST Security Rules for Python source code using Tree-sitter.

function getNodeText(node, code) {
  if (!node) return "";
  return code.substring(node.startIndex, node.endIndex);
}

function getRedactedSnippet(code, node, maxLen = 140) {
  if (!node) return "";
  const snippet = code.substring(node.startIndex, node.endIndex).trim().replace(/\r?\n\s*/g, " ");
  return snippet.length > maxLen ? snippet.slice(0, maxLen - 3) + "..." : snippet;
}

export const PYTHON_AST_RULES = [
  // 1. Dynamic Code Execution (eval / exec)
  {
    id: "py-eval-injection",
    name: "Unsafe Dynamic Code Execution (eval/exec)",
    category: "Unsafe Dynamic Evaluation",
    description: "Calling eval() or exec() executes arbitrary Python code in the current execution context.",
    language: "python",
    severity: "Critical",
    confidence: "High",
    recommendation: "Avoid eval() and exec(). Use ast.literal_eval() for safely parsing Python literals, or json.loads() for structured data.",
    references: ["https://owasp.org/www-community/attacks/Code_Injection", "CWE-95"],
    check: (node, code) => {
      if (node.type !== "call") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnName = getNodeText(fnNode, code).trim();
      if (fnName === "eval" || fnName === "exec" || fnName === "compile") {
        const args = argsNode.namedChildren || [];
        if (args.length > 0) {
          const firstArg = args[0];
          const isStringLiteral = firstArg.type === "string";
          return {
            confirmed: true,
            confidence: isStringLiteral ? "Medium" : "High",
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

  // 2. Command Injection (os.system, subprocess with shell=True)
  {
    id: "py-command-injection",
    name: "Subprocess Command Injection",
    category: "Command Injection",
    description: "Executing shell commands via os.system or subprocess with shell=True opens the application to command injection vulnerabilities.",
    language: "python",
    severity: "Critical",
    confidence: "High",
    recommendation: "Avoid shell=True. Pass command arguments as a list of strings: subprocess.run(['cmd', arg1, arg2], check=True).",
    references: ["https://owasp.org/www-community/attacks/Command_Injection", "CWE-78"],
    check: (node, code) => {
      if (node.type !== "call") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnName = getNodeText(fnNode, code).trim();

      // os.system(...) or os.popen(...)
      if (fnName === "os.system" || fnName === "os.popen") {
        return {
          confirmed: true,
          confidence: "High",
          node,
          redactedEvidence: getRedactedSnippet(code, node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        };
      }

      // subprocess.run(..., shell=True) or subprocess.Popen(..., shell=True)
      if (fnName.startsWith("subprocess.") || fnName === "Popen" || fnName === "run" || fnName === "call") {
        const argsText = getNodeText(argsNode, code);
        if (/shell\s*=\s*(?:True|1)/.test(argsText)) {
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

  // 3. Insecure Deserialization (pickle / yaml without SafeLoader)
  {
    id: "py-unsafe-deserialization",
    name: "Unsafe Object Deserialization (pickle/yaml)",
    category: "Insecure Deserialization",
    description: "Deserializing untrusted pickle streams or YAML without SafeLoader can result in arbitrary remote code execution via object reduction.",
    language: "python",
    severity: "Critical",
    confidence: "High",
    recommendation: "Never deserialize untrusted data with pickle. Use json, msgpack, or yaml.safe_load().",
    references: ["https://owasp.org/www-community/vulnerabilities/Deserialization_of_untrusted_data", "CWE-502"],
    check: (node, code) => {
      if (node.type !== "call") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnName = getNodeText(fnNode, code).trim();

      // pickle.loads / pickle.load / _pickle.loads
      if (
        fnName === "pickle.loads" ||
        fnName === "pickle.load" ||
        fnName === "_pickle.loads" ||
        fnName === "_pickle.load"
      ) {
        return {
          confirmed: true,
          confidence: "High",
          node,
          redactedEvidence: getRedactedSnippet(code, node),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        };
      }

      // yaml.load(...) without SafeLoader
      if (fnName === "yaml.load") {
        const argsText = getNodeText(argsNode, code);
        if (!argsText.includes("SafeLoader")) {
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

  // 4. Insecure Cryptography (MD5, SHA1)
  {
    id: "py-insecure-crypto",
    name: "Weak Hash Algorithm (hashlib.md5/sha1)",
    category: "Insecure Cryptography",
    description: "Using MD5 or SHA1 for hashing is vulnerable to collision attacks and inadequate for security-sensitive purposes.",
    language: "python",
    severity: "Medium",
    confidence: "High",
    recommendation: "Use hashlib.sha256() or hashlib.sha3_256() for secure cryptographic hashing.",
    references: ["https://cwe.mitre.org/data/definitions/327.html", "CWE-327"],
    check: (node, code) => {
      if (node.type !== "call") return null;

      const fnNode = node.childForFieldName("function");
      if (!fnNode) return null;

      const fnName = getNodeText(fnNode, code).trim();
      if (fnName === "hashlib.md5" || fnName === "hashlib.sha1") {
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

  // 5. SQL Injection via Dynamic String Formatting
  {
    id: "py-sql-injection",
    name: "SQL Injection via String Formatting",
    category: "SQL Injection",
    description: "Constructing SQL queries using f-strings, string concatenation, or % formatting exposes database queries to SQL injection.",
    language: "python",
    severity: "Critical",
    confidence: "High",
    recommendation: "Use parameterized queries with database driver parameter placeholders (e.g., cursor.execute('SELECT ... %s', (val,))).",
    references: ["https://owasp.org/www-community/attacks/SQL_Injection", "CWE-89"],
    check: (node, code) => {
      if (node.type !== "call") return null;

      const fnNode = node.childForFieldName("function");
      const argsNode = node.childForFieldName("arguments");
      if (!fnNode || !argsNode) return null;

      const fnName = getNodeText(fnNode, code).trim();
      if (fnName.endsWith(".execute") || fnName === "execute") {
        const args = argsNode.namedChildren || [];
        if (args.length > 0) {
          const firstArg = args[0];
          // Check for f-string (formatted_string or string with interpolation), binary % operator, or .format()
          const isFString =
            firstArg.type === "formatted_string" ||
            (firstArg.type === "string" && firstArg.children.some((c) => c.type === "interpolation"));
          const isFormatted = firstArg.type === "binary_operator" && getNodeText(firstArg, code).includes("%");
          const isDotFormat = firstArg.type === "call" && getNodeText(firstArg, code).includes(".format(");

          if (isFString || isFormatted || isDotFormat) {
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
