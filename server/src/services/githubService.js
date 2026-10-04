// src/services/githubService.js
//
// GitHub REST API client service.
// Handles repository metadata fetching, recursive file tree retrieval,
// noise filtering (RIE invariant), and rate-limit / authorization error normalization.

const GITHUB_API_BASE = "https://api.github.com";

// Directories to filter out from repository analysis (RIE noise filtering)
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  ".github",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "venv",
  ".venv",
  "env",
  "__pycache__",
  ".pytest_cache",
  ".turbo",
  "coverage",
  ".nyc_output",
  ".cache",
  ".idea",
  ".vscode",
  ".husky",
  "target",
  "bin",
  "obj",
  "vendor",
  "tmp",
  "temp",
]);

// Large binaries, lockfiles, and media files to omit from analysis tree
const IGNORED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".mp4",
  ".mp3",
  ".wav",
  ".mov",
  ".avi",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".map",
  ".lock",
]);

const IGNORED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "cargo.lock",
  "gemfile.lock",
  "poetry.lock",
  ".ds_store",
  "thumbs.db",
]);

/**
 * Builds standard GitHub API headers.
 * Uses GITHUB_TOKEN if available in environment for higher rate limits (5000/hr)
 * and access to authorized private repositories.
 *
 * @returns {HeadersInit}
 */
const getHeaders = () => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ArchMind-AI/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  if (token && token !== "YOUR_GITHUB_TOKEN") {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Handles GitHub HTTP response status codes and converts to user-friendly errors.
 *
 * @param {Response} response
 * @param {string} entity
 */
const handleApiError = async (response, entity = "Repository") => {
  if (response.ok) return;

  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");

  if (response.status === 403 && rateLimitRemaining === "0") {
    const resetDate = rateLimitReset ? new Date(parseInt(rateLimitReset, 10) * 1000).toLocaleTimeString() : "shortly";
    const error = new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}. Add a GITHUB_TOKEN to your server environment for 5,000 requests/hour.`);
    error.status = 429;
    throw error;
  }

  if (response.status === 404) {
    const error = new Error(`${entity} not found. Please check the repository URL and ensure it is public (or configure GITHUB_TOKEN with appropriate repository access).`);
    error.status = 404;
    throw error;
  }

  if (response.status === 401) {
    const error = new Error("GitHub authentication failed. The configured GITHUB_TOKEN is invalid or expired.");
    error.status = 401;
    throw error;
  }

  let message = `${entity} request failed with status ${response.status}.`;
  try {
    const errorBody = await response.json();
    if (errorBody.message) message = `GitHub Error: ${errorBody.message}`;
  } catch {
    // Ignore JSON parse errors on non-200 responses
  }

  const error = new Error(message);
  error.status = response.status >= 400 && response.status < 500 ? response.status : 502;
  throw error;
};

/**
 * Checks whether a repository path should be filtered out by RIE noise rules.
 *
 * @param {string} filePath
 * @returns {boolean} True if the file should be ignored
 */
export const isNoisePath = (filePath) => {
  if (!filePath) return true;

  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  // Check if any directory in the path matches an ignored directory
  for (let i = 0; i < segments.length - 1; i++) {
    const dir = segments[i].toLowerCase();
    if (IGNORED_DIRECTORIES.has(dir) || dir.startsWith(".")) {
      return true;
    }
  }

  const filename = segments[segments.length - 1].toLowerCase();

  // Check exact ignored filenames
  if (IGNORED_FILENAMES.has(filename)) return true;

  // Check hidden dot files/folders (except standard configs like .gitignore or .env.example)
  if (filename.startsWith(".") && filename !== ".gitignore" && filename !== ".editorconfig" && filename !== ".eslintrc.json" && filename !== ".prettierrc") {
    return true;
  }

  // Check ignored extensions
  for (const ext of IGNORED_EXTENSIONS) {
    if (filename.endsWith(ext)) return true;
  }

  return false;
};

/**
 * Fetches repository metadata from the GitHub REST API.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Object>} Formatted repository metadata
 */
export const fetchRepoMetadata = async (owner, repo) => {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  await handleApiError(response, `Repository '${owner}/${repo}'`);

  const data = await response.json();

  return {
    githubId: data.id,
    name: data.name,
    fullName: data.full_name,
    owner: {
      login: data.owner?.login || owner,
      avatarUrl: data.owner?.avatar_url || "",
      type: data.owner?.type || "User",
    },
    description: data.description || "",
    htmlUrl: data.html_url,
    defaultBranch: data.default_branch || "main",
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    openIssues: data.open_issues_count || 0,
    language: data.language || "Unknown",
    topics: Array.isArray(data.topics) ? data.topics : [],
    isPrivate: Boolean(data.private),
    isFork: Boolean(data.fork),
    size: data.size || 0, // In KB
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    license: data.license?.spdx_id || data.license?.name || null,
  };
};

/**
 * Fetches the recursive Git tree for a repository branch, applies noise filtering,
 * and compiles file tree statistics.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} defaultBranch
 * @returns {Promise<{ tree: Array<Object>, stats: Object, isTruncated: boolean }>}
 */
export const fetchRepoTree = async (owner, repo, defaultBranch = "main") => {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  await handleApiError(response, `Repository Tree for '${owner}/${repo}' (${defaultBranch})`);

  const data = await response.json();

  if (!Array.isArray(data.tree)) {
    throw new Error("Invalid tree response structure received from GitHub API.");
  }

  const isTruncated = Boolean(data.truncated);

  // Filter and sanitize tree nodes
  const filteredTree = [];
  let totalFiles = 0;
  let totalDirs = 0;
  let totalBytes = 0;
  const extensionCounts = {};

  for (const item of data.tree) {
    if (isNoisePath(item.path)) continue;

    const isDir = item.type === "tree";
    const isFile = item.type === "blob";

    if (isFile) {
      totalFiles++;
      totalBytes += item.size || 0;

      const ext = item.path.includes(".") ? `.${item.path.split(".").pop().toLowerCase()}` : "no_ext";
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    } else if (isDir) {
      totalDirs++;
    }

    filteredTree.push({
      path: item.path,
      type: isDir ? "dir" : "file",
      size: item.size || 0,
      sha: item.sha,
      mode: item.mode,
    });
  }

  // Top 5 file extensions by count
  const topExtensions = Object.entries(extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => ({ extension: ext, count }));

  return {
    tree: filteredTree,
    isTruncated,
    stats: {
      totalFiles,
      totalDirs,
      totalBytes,
      topExtensions,
    },
  };
};

/**
 * Fetches the raw content of a file blob from GitHub Git Data API using its SHA.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} sha
 * @returns {Promise<string|null>} UTF-8 text content or null
 */
export const fetchFileBlob = async (owner, repo, sha) => {
  if (!owner || !repo || !sha) return null;
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${sha}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) return null;
    const data = await response.json();

    if (data.encoding === "base64" && data.content) {
      // Remove any whitespace/newlines in base64 string
      const cleanBase64 = data.content.replace(/\s+/g, "");
      return Buffer.from(cleanBase64, "base64").toString("utf-8");
    }
    return null;
  } catch (err) {
    console.warn(`[githubService] fetchFileBlob error for ${sha}:`, err.message);
    return null;
  }
};

/**
 * Populates file content for key architectural, schema, and model files
 * directly into the tree data nodes for static analysis.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {Array<Object>} tree
 * @returns {Promise<Array<Object>>}
 */
export const populateKeyFileContents = async (owner, repo, tree = []) => {
  const isKeyFile = (p) => {
    if (!p) return false;
    const lower = p.toLowerCase();
    return (
      /(?:^|\/)(?:models?|schemas?|entities|db|database)\//i.test(lower) ||
      /\.(?:model|schema)\.[jt]sx?$/i.test(lower) ||
      lower.endsWith("schema.prisma") ||
      lower.endsWith("models.py") ||
      lower.endsWith("model.py") ||
      lower.endsWith(".sql") ||
      /^(?:server|app|index|main)\.[jt]sx?$/i.test(lower) ||
      lower.endsWith("/server.js") ||
      lower.endsWith("/app.js") ||
      lower.endsWith("/index.js") ||
      lower === "package.json"
    );
  };

  const keyFiles = tree.filter((f) => f.type !== "dir" && f.sha && isKeyFile(f.path)).slice(0, 40);

  await Promise.all(
    keyFiles.map(async (file) => {
      try {
        const content = await fetchFileBlob(owner, repo, file.sha);
        if (content) {
          file.content = content;
        }
      } catch (err) {
        console.warn(`[githubService] Failed to populate content for ${file.path}:`, err.message);
      }
    })
  );

  return tree;
};

