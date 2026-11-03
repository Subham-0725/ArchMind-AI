// server/src/rie/api/routeExtractor.js
//
// Repository Intelligence Engine — API Route Extractor
//
// Statically extracts HTTP endpoint declarations across Node.js/TypeScript (Express, Fastify,
// NestJS, Koa) and Python (FastAPI, Flask, Django) codebases.
//
// Produces normalized route records with stable identifiers, exact 1-based source line ranges,
// parameter parsing, middleware/guard detection, and auth classification.

import path from "path";
import crypto from "crypto";
import { parseJsTsFile } from "../parsers/jsTsParser.js";
import { parsePythonFile } from "../parsers/pythonParser.js";

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "ALL"]);

const AUTH_MIDDLEWARE_KEYWORDS = new Set([
  "auth", "authenticate", "requireauth", "checkauth", "verifytoken", "jwt",
  "protect", "isauthenticated", "authorized", "authorize", "guard", "session",
  "ensureauthenticated", "verifyuser", "clerk", "passport", "loginrequired"
]);

/**
 * Generates a stable, deterministic route identifier.
 */
export function generateRouteId(method, routePath, sourceFile, startLine = 1) {
  const normPath = (routePath || "/").replace(/[^a-zA-Z0-9_-]/g, "_");
  const normFile = (sourceFile || "route").replace(/[^a-zA-Z0-9_-]/g, "_");
  const hash = crypto
    .createHash("sha1")
    .update(`${method.toUpperCase()}:${routePath}:${sourceFile}:${startLine}`)
    .digest("hex")
    .slice(0, 8);
  return `route_${method.toLowerCase()}_${normPath.slice(0, 20)}_${hash}`;
}

/**
 * Normalizes relative file paths to standard forward slashes.
 */
function normalizePath(p) {
  if (!p) return "";
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Extracts route parameters from a path string.
 * Supports Express/Fastify `:id` and FastAPI/Flask/Django `{user_id}` or `<int:user_id>`.
 */
export function extractPathParams(routePath = "") {
  const params = [];
  // Express/Fastify :param
  const expressMatches = routePath.matchAll(/:([a-zA-Z0-9_]+)/g);
  for (const match of expressMatches) {
    if (match[1]) params.push(match[1]);
  }
  // Python {param} or <param> or <type:param>
  const pythonMatches = routePath.matchAll(/\{([a-zA-Z0-9_]+)\}|<(?:\w+:)?([a-zA-Z0-9_]+)>/g);
  for (const match of pythonMatches) {
    const p = match[1] || match[2];
    if (p && !params.includes(p)) params.push(p);
  }
  return params;
}

/**
 * Heuristically detects whether a route is protected by authentication.
 */
export function isRouteAuthProtected(middlewareList = [], decorators = [], rawText = "") {
  for (const mw of middlewareList) {
    const clean = String(mw).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const kw of AUTH_MIDDLEWARE_KEYWORDS) {
      if (clean.includes(kw)) return true;
    }
  }

  for (const dec of decorators) {
    const clean = String(dec).toLowerCase();
    if (
      clean.includes("useguards") ||
      clean.includes("authguard") ||
      clean.includes("roles") ||
      clean.includes("login_required") ||
      clean.includes("authenticated")
    ) {
      return true;
    }
  }

  const lowerText = String(rawText).toLowerCase();
  if (
    lowerText.includes("requireauth") ||
    lowerText.includes("ensureauthenticated") ||
    lowerText.includes("depends(auth") ||
    lowerText.includes("depends(get_current_user")
  ) {
    return true;
  }

  return false;
}

/**
 * Statically evaluates simple string constants or template prefixes in route definitions.
 * Example: const API_PREFIX = "/api/v1"; router.get(`${API_PREFIX}/users`, ...)
 */
export function resolveStaticRoutePath(rawPath, constantsMap = new Map()) {
  if (!rawPath) return { path: "/", notes: null };

  let trimmed = rawPath.trim().replace(/^['"`]|['"`]$/g, "");

  // If already a clean literal
  if (!trimmed.includes("${") && !trimmed.includes("+")) {
    const clean = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return { path: clean, notes: null };
  }

  // Handle template literals: `${PREFIX}/items`
  const templateMatch = trimmed.match(/^\$\{([a-zA-Z0-9_]+)\}(.*)$/);
  if (templateMatch) {
    const varName = templateMatch[1];
    const rest = templateMatch[2] || "";
    if (constantsMap.has(varName)) {
      const resolvedPrefix = constantsMap.get(varName).replace(/\/$/, "");
      const full = `${resolvedPrefix}${rest.startsWith("/") ? rest : `/${rest}`}`;
      return { path: full, notes: `Resolved prefix from constant '${varName}'` };
    }
    return {
      path: `[${varName}]${rest}`,
      notes: `Dynamic route segment '${varName}' evaluated symbolically`,
    };
  }

  // Handle concatenation: PREFIX + "/items"
  const concatMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\+\s*['"`]([^'"`]+)['"`]$/);
  if (concatMatch) {
    const varName = concatMatch[1];
    const rest = concatMatch[2] || "";
    if (constantsMap.has(varName)) {
      const resolvedPrefix = constantsMap.get(varName).replace(/\/$/, "");
      const full = `${resolvedPrefix}${rest.startsWith("/") ? rest : `/${rest}`}`;
      return { path: full, notes: `Resolved prefix from constant '${varName}'` };
    }
    return {
      path: `[${varName}]${rest}`,
      notes: `Dynamic route segment '${varName}' evaluated symbolically`,
    };
  }

  return { path: trimmed, notes: "Complex dynamic route path expression" };
}

/**
 * Extracts top-level string constants from source code to assist prefix resolution.
 */
function extractStringConstants(code) {
  const map = new Map();
  const constRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = constRegex.exec(code)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

/**
 * Extracts Express / Fastify / Koa routes from JavaScript and TypeScript files.
 * @param {string} filePath
 * @param {string} code
 * @param {string} [basePrefix=""] - Router mount prefix from app.use('/prefix', router)
 */
function extractJsTsRoutes(filePath, code, basePrefix = "") {
  const routes = [];
  const constants = extractStringConstants(code);
  const lines = code.split(/\r?\n/);

  const applyBasePrefix = (rawResolved) => {
    if (!basePrefix) return rawResolved;
    const cleanPrefix = basePrefix.replace(/\/$/, "");
    if (!rawResolved || rawResolved === "/") return cleanPrefix;
    return `${cleanPrefix}${rawResolved.startsWith("/") ? rawResolved : `/${rawResolved}`}`;
  };

  // 1. App/Router method calls: app.get("/path", mw1, mw2, handler) or router.post(...)
  // Handles: app.get, router.post, server.delete, api.patch, etc.
  const routeCallRegex =
    /(?:^|\s)(?:export\s+)?(?:const\s+\w+\s*=\s*)?([a-zA-Z0-9_$]+)\.(get|post|put|delete|patch|options|head|all)\s*\(\s*(['"`][^'"`]+['"`]|\$\{[^}]+\}|[a-zA-Z0-9_]+(?:\s*\+\s*['"`][^'"`]+['"`])?)\s*(?:,\s*([\s\S]*?))?\)(?:;|\s*$)/gm;

  let match;
  while ((match = routeCallRegex.exec(code)) !== null) {
    const routerObj = match[1];
    const method = match[2].toUpperCase();
    const rawPath = match[3];
    const restArgs = match[4] || "";

    // Skip utility methods like Promise.all, Object.get, etc.
    if (["Promise", "Object", "Reflect", "Map", "Set", "console"].includes(routerObj)) {
      continue;
    }

    const { path: resolvedPath, notes } = resolveStaticRoutePath(rawPath, constants);
    const finalPath = applyBasePrefix(resolvedPath);
    const startLine = code.substring(0, match.index).split("\n").length;
    const matchLines = match[0].split("\n").length;
    const endLine = startLine + matchLines - 1;

    // Parse handlers and middleware from rest arguments
    const argTokens = restArgs
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a && !a.startsWith("//") && !a.startsWith("/*"));

    let handlerName = "anonymous";
    const middleware = [];

    if (argTokens.length > 0) {
      const last = argTokens[argTokens.length - 1];
      if (/^[a-zA-Z0-9_$]+$/.test(last)) {
        handlerName = last;
      } else if (last.includes("=>") || last.includes("function")) {
        handlerName = "inlineHandler";
      }

      for (let i = 0; i < argTokens.length - 1; i++) {
        const mw = argTokens[i];
        if (/^[a-zA-Z0-9_$]+(?:\([^)]*\))?$/.test(mw)) {
          middleware.push(mw.replace(/\(.*\)/, ""));
        }
      }
    }

    const params = extractPathParams(finalPath);
    const isAuth = isRouteAuthProtected(middleware, [], match[0]);

    routes.push({
      routeId: generateRouteId(method, finalPath, filePath, startLine),
      method,
      path: finalPath,
      framework: "express",
      sourceFile: normalizePath(filePath),
      lineRange: { startLine, endLine },
      handlerName,
      controllerName: null,
      routerName: routerObj,
      middleware,
      params,
      queryParams: [],
      requestBodySchema: method === "POST" || method === "PUT" || method === "PATCH" ? { type: "json" } : null,
      responseInfo: null,
      isAuthProtected: isAuth,
      confidence: notes ? "medium" : "high",
      notes: basePrefix ? `Mounted at '${basePrefix}'` : notes,
    });
  }

  // 2. Chained router routes: router.route('/users').get(list).post(create)
  const chainedRegex =
    /([a-zA-Z0-9_$]+)\.route\s*\(\s*(['"`][^'"`]+['"`])\s*\)((?:\s*\.(?:get|post|put|delete|patch)\s*\([^)]*\))+)/gm;

  let chainMatch;
  while ((chainMatch = chainedRegex.exec(code)) !== null) {
    const routerObj = chainMatch[1];
    const rawPath = chainMatch[2];
    const chainedCalls = chainMatch[3];
    const { path: resolvedPath, notes } = resolveStaticRoutePath(rawPath, constants);
    const finalPath = applyBasePrefix(resolvedPath);
    const startLine = code.substring(0, chainMatch.index).split("\n").length;
    const endLine = startLine + chainMatch[0].split("\n").length - 1;
    const params = extractPathParams(finalPath);

    const subMethodRegex = /\.(get|post|put|delete|patch)\s*\(\s*([^)]*)\)/gi;
    let subMatch;
    while ((subMatch = subMethodRegex.exec(chainedCalls)) !== null) {
      const method = subMatch[1].toUpperCase();
      const handlerArg = subMatch[2].trim();
      const handlerName = /^[a-zA-Z0-9_$]+$/.test(handlerArg) ? handlerArg : "inlineHandler";

      routes.push({
        routeId: generateRouteId(method, finalPath, filePath, startLine),
        method,
        path: finalPath,
        framework: "express",
        sourceFile: normalizePath(filePath),
        lineRange: { startLine, endLine },
        handlerName,
        controllerName: null,
        routerName: routerObj,
        middleware: [],
        params,
        queryParams: [],
        requestBodySchema: null,
        responseInfo: null,
        isAuthProtected: false,
        confidence: "high",
        notes: basePrefix ? `Mounted at '${basePrefix}'` : notes,
      });
    }
  }

  // 3. NestJS Decorator Routes: @Controller('users') class UserController { @Get(':id') get() {} }
  if (code.includes("@Controller") || code.includes("@Get") || code.includes("@Post")) {
    const controllerMatch = code.match(/@Controller\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)\s*(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
    const controllerPrefix = controllerMatch ? (controllerMatch[1] ? `/${controllerMatch[1].replace(/^\//, "")}` : "") : "";
    const controllerName = controllerMatch ? controllerMatch[2] : null;

    const methodRegex =
      /@(Get|Post|Put|Delete|Patch|Options|Head|All)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)(?:[\s\S]*?)(?:async\s+)?([a-zA-Z0-9_$]+)\s*\(/g;

    let nMatch;
    while ((nMatch = methodRegex.exec(code)) !== null) {
      const method = nMatch[1].toUpperCase();
      const subPath = nMatch[2] ? (nMatch[2].startsWith("/") ? nMatch[2] : `/${nMatch[2]}`) : "";
      const methodName = nMatch[3];
      const fullPath = `${controllerPrefix}${subPath}` || "/";
      const startLine = code.substring(0, nMatch.index).split("\n").length;
      const endLine = startLine + nMatch[0].split("\n").length - 1;
      const params = extractPathParams(fullPath);
      const isAuth = code.substring(Math.max(0, nMatch.index - 200), nMatch.index).includes("@UseGuards");

      routes.push({
        routeId: generateRouteId(method, fullPath, filePath, startLine),
        method,
        path: fullPath,
        framework: "nestjs",
        sourceFile: normalizePath(filePath),
        lineRange: { startLine, endLine },
        handlerName: methodName,
        controllerName,
        routerName: null,
        middleware: isAuth ? ["AuthGuard"] : [],
        params,
        queryParams: [],
        requestBodySchema: null,
        responseInfo: null,
        isAuthProtected: isAuth,
        confidence: "high",
        notes: controllerName ? `Extracted from NestJS controller '${controllerName}'` : null,
      });
    }
  }

  // 4. Fastify route declarations: fastify.route({ method: 'GET', url: '/users', handler: ... })
  const fastifyRouteRegex =
    /fastify\.route\s*\(\s*\{[\s\S]*?method\s*:\s*['"`]([A-Z]+)['"`][\s\S]*?url\s*:\s*['"`]([^'"`]+)['"`][\s\S]*?\}\s*\)/gi;
  let fMatch;
  while ((fMatch = fastifyRouteRegex.exec(code)) !== null) {
    const method = fMatch[1].toUpperCase();
    const fPath = fMatch[2];
    const startLine = code.substring(0, fMatch.index).split("\n").length;
    const endLine = startLine + fMatch[0].split("\n").length - 1;

    routes.push({
      routeId: generateRouteId(method, fPath, filePath, startLine),
      method,
      path: fPath,
      framework: "fastify",
      sourceFile: normalizePath(filePath),
      lineRange: { startLine, endLine },
      handlerName: "fastifyHandler",
      controllerName: null,
      routerName: "fastify",
      middleware: [],
      params: extractPathParams(fPath),
      queryParams: [],
      requestBodySchema: null,
      responseInfo: null,
      isAuthProtected: false,
      confidence: "high",
      notes: "Extracted from fastify.route declaration",
    });
  }

  return routes;
}

/**
 * Extracts Python routes from Flask, FastAPI, and Django files.
 */
function extractPythonRoutes(filePath, code) {
  const routes = [];

  // 1. FastAPI / Flask Decorators: @app.get('/users/{user_id}') or @router.post('/login')
  const pyDecoratorRegex =
    /@([a-zA-Z0-9_$]+)\.(get|post|put|delete|patch|options|head|route)\s*\(\s*(['"][^'"]+['"])(?:[^)]*)\)\s*(?:\n\s*@\w+[^\n]*)*\s*(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gm;

  let match;
  while ((match = pyDecoratorRegex.exec(code)) !== null) {
    const routerObj = match[1];
    let method = match[2].toUpperCase();
    const rawPath = match[3].replace(/['"]/g, "");
    const funcName = match[4];
    const funcArgs = match[5] || "";

    // In Flask @app.route('/path', methods=['POST'])
    if (method === "ROUTE") {
      const methodsMatch = match[0].match(/methods\s*=\s*\[([^\]]+)\]/i);
      method = methodsMatch ? methodsMatch[1].replace(/['"\s]/g, "").split(",")[0].toUpperCase() : "GET";
    }

    const startLine = code.substring(0, match.index).split("\n").length;
    const endLine = startLine + match[0].split("\n").length - 1;
    const params = extractPathParams(rawPath);
    const isAuth = isRouteAuthProtected([], [], match[0]);
    const framework = routerObj.includes("router") || code.includes("FastAPI") ? "fastapi" : "flask";

    routes.push({
      routeId: generateRouteId(method, rawPath, filePath, startLine),
      method,
      path: rawPath.startsWith("/") ? rawPath : `/${rawPath}`,
      framework,
      sourceFile: normalizePath(filePath),
      lineRange: { startLine, endLine },
      handlerName: funcName,
      controllerName: null,
      routerName: routerObj,
      middleware: isAuth ? ["auth_dependency"] : [],
      params,
      queryParams: [],
      requestBodySchema: null,
      responseInfo: null,
      isAuthProtected: isAuth,
      confidence: "high",
      notes: null,
    });
  }

  // 2. Django URL patterns: path('users/<int:user_id>/', views.get_user, name='get_user')
  if (code.includes("urlpatterns") || code.includes("path(") || code.includes("re_path(")) {
    const djangoPathRegex =
      /(?:path|re_path)\s*\(\s*['"]([^'"]*)['"]\s*,\s*([a-zA-Z0-9_$.]+)(?:[\s\S]*?\))/g;

    let djMatch;
    while ((djMatch = djangoPathRegex.exec(code)) !== null) {
      const rawPath = djMatch[1];
      const handlerTarget = djMatch[2];
      const fullPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
      const startLine = code.substring(0, djMatch.index).split("\n").length;
      const endLine = startLine + djMatch[0].split("\n").length - 1;
      const params = extractPathParams(fullPath);

      routes.push({
        routeId: generateRouteId("ALL", fullPath, filePath, startLine),
        method: "ALL", // Django paths typically handle all methods inside the view
        path: fullPath,
        framework: "django",
        sourceFile: normalizePath(filePath),
        lineRange: { startLine, endLine },
        handlerName: handlerTarget,
        controllerName: handlerTarget.includes(".") ? handlerTarget.split(".")[0] : null,
        routerName: "urlpatterns",
        middleware: [],
        params,
        queryParams: [],
        requestBodySchema: null,
        responseInfo: null,
        isAuthProtected: false,
        confidence: "high",
        notes: "Extracted from Django urlpatterns declaration",
      });
    }
  }

  return routes;
}

/**
 * Deduplicates and sorts route records.
 */
export function deduplicateRoutes(routes = []) {
  if (!Array.isArray(routes)) return [];
  const map = new Map();

  for (const r of routes) {
    if (!r || !r.method || !r.path || !r.sourceFile) continue;
    // Composite key: method + normalized path + source file + start line
    const key = `${r.method.toUpperCase()}:${r.path}:${r.sourceFile}:${r.lineRange?.startLine || 1}:${r.handlerName || ""}`;
    if (!map.has(key)) {
      map.set(key, r);
    }
  }

  const unique = Array.from(map.values());
  // Sort alphabetically by path, then method
  unique.sort((a, b) => {
    const cmp = a.path.localeCompare(b.path);
    if (cmp !== 0) return cmp;
    return a.method.localeCompare(b.method);
  });
  return unique;
}

/**
 * Main Entry Point: Scans repository tree and extracts structured API route definitions.
 *
 * @param {Array<Object>} tree - Sanitized repository file tree
 * @param {Object} options
 * @param {string} [options.extractionPath] - Local folder where files reside (for ZIP)
 * @param {Function} [options.fileFetcher] - Async loader for GitHub blobs
 * @param {Object} [options.ast] - Pre-parsed AST metadata if available
 * @returns {Promise<{ routes: Array<Object>, totalCount: number, frameworks: Array<string>, summary: Object }>}
 */
export async function extractApiRoutes(tree = [], options = {}) {
  const { extractionPath = null, fileFetcher = null } = options;
  const rawRoutes = [];
  const detectedFrameworks = new Set();

  const fs = await import("fs");

  const getCode = async (normPath, sha, initialContent) => {
    if (initialContent && typeof initialContent === "string") return initialContent;
    if (extractionPath) {
      try {
        const fullDiskPath = path.resolve(extractionPath, normPath);
        if (fullDiskPath.startsWith(path.resolve(extractionPath)) && fs.existsSync(fullDiskPath)) {
          return fs.readFileSync(fullDiskPath, "utf8");
        }
      } catch {
        return null;
      }
    }
    if (fileFetcher && sha) {
      try {
        return await fileFetcher(normPath, sha);
      } catch {
        return null;
      }
    }
    return null;
  };

  // Pre-pass: Scan application files for router mounts (e.g. app.use('/api/v1/resumes', resumesRoute))
  const routerMountMap = new Map();

  for (const node of tree) {
    if (!node || node.type === "dir" || !node.path) continue;
    const normPath = normalizePath(node.path);
    const ext = path.extname(normPath).toLowerCase();
    if (![".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].includes(ext)) continue;

    const baseName = path.basename(normPath).toLowerCase();
    if (baseName.includes("app") || baseName.includes("server") || baseName.includes("index") || baseName.includes("route")) {
      const code = await getCode(normPath, node.sha, node.content);
      if (code && (code.includes(".use(") || code.includes("Router("))) {
        // Collect imports
        const importRegex = /(?:import\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+)['"]|const\s+([a-zA-Z0-9_$]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
        const varToRel = new Map();
        let im;
        while ((im = importRegex.exec(code)) !== null) {
          const v = im[1] || im[3];
          const p = im[2] || im[4];
          if (v && p && p.startsWith(".")) {
            varToRel.set(v, p);
          }
        }

        // Collect app.use('/prefix', routerVar)
        const mountRegex = /(?:[a-zA-Z0-9_$]+)\.use\s*\(\s*['"]([^'"]+)['"]\s*,\s*([a-zA-Z0-9_$]+)\s*\)/g;
        let mm;
        const dir = path.posix.dirname(normPath);
        while ((mm = mountRegex.exec(code)) !== null) {
          const prefix = mm[1];
          const v = mm[2];
          const rel = varToRel.get(v);
          if (rel && prefix.startsWith("/")) {
            const targetNorm = path.posix.normalize(path.posix.join(dir, rel)).replace(/\.(js|jsx|mjs|cjs|ts|tsx)$/i, "");
            routerMountMap.set(targetNorm.toLowerCase(), prefix);
          }
        }
      }
    }
  }

  for (const node of tree) {
    if (!node || node.type === "dir" || !node.path) continue;
    const normPath = normalizePath(node.path);
    const ext = path.extname(normPath).toLowerCase();

    if (![".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py"].includes(ext)) {
      continue;
    }

    const code = await getCode(normPath, node.sha, node.content);
    if (!code || typeof code !== "string") continue;

    if (ext === ".py") {
      const extracted = extractPythonRoutes(normPath, code);
      for (const r of extracted) {
        rawRoutes.push(r);
        detectedFrameworks.add(r.framework);
      }
    } else {
      const cleanKey = normPath.replace(/\.(js|jsx|mjs|cjs|ts|tsx)$/i, "").toLowerCase();
      const mountPrefix = routerMountMap.get(cleanKey) || "";
      const extracted = extractJsTsRoutes(normPath, code, mountPrefix);
      for (const r of extracted) {
        rawRoutes.push(r);
        detectedFrameworks.add(r.framework);
      }
    }
  }

  const routes = deduplicateRoutes(rawRoutes);

  // Compile summary statistics
  const byMethod = {};
  for (const r of routes) {
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }

  return {
    routes,
    totalCount: routes.length,
    frameworks: Array.from(detectedFrameworks),
    summary: {
      total: routes.length,
      byMethod,
      authProtectedCount: routes.filter((r) => r.isAuthProtected).length,
    },
  };
}

