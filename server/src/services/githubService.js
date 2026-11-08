// src/services/githubService.js
//
// GitHub REST API client service.
// Handles repository metadata fetching, recursive file tree retrieval,
// noise filtering (RIE invariant), rate-limit / authorization error normalization,
// resilient retries with exponential backoff, and streaming repository archive downloads.

import fs from "fs";
import { pipeline } from "stream/promises";
import { Readable, Transform } from "stream";
import { safeUnlink } from "../config/storage.js";
import { GITHUB_TOKEN } from "../config/env.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Transform stream that enforces a hard byte limit on downloaded payloads.
 */
class SizeLimitTransform extends Transform {
  constructor(maxBytes) {
    super();
    this.maxBytes = maxBytes;
    this.totalBytes = 0;
  }

  _transform(chunk, encoding, callback) {
    this.totalBytes += chunk.length;
    if (this.totalBytes > this.maxBytes) {
      const err = new Error(
        `Repository archive exceeds maximum permitted size of ${Math.round(this.maxBytes / (1024 * 1024))} MB.`
      );
      err.code = "PAYLOAD_TOO_LARGE";
      err.status = 413;
      return callback(err);
    }
    callback(null, chunk);
  }
}

/**
 * Promise-based delay helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * @param {Record<string, string>} [customHeaders={}]
 * @returns {HeadersInit}
 */
const getHeaders = (customHeaders = {}) => {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ArchMind-AI/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...customHeaders,
  };

  const token = (process.env.GITHUB_TOKEN || GITHUB_TOKEN)?.trim();
  if (token && token !== "YOUR_GITHUB_TOKEN") {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Executes a GitHub API request with automated exponential backoff and jitter.
 * Automatically retries transient upstream failures (502, 503, 504) and network timeouts.
 *
 * @param {string} url - Request target
 * @param {RequestInit} [options={}] - Standard fetch options
 * @param {Object} [config={}] - Retry & timeout configuration
 * @param {number} [config.maxRetries=3] - Maximum retry attempts
 * @param {number} [config.timeoutMs=15000] - Per-attempt timeout in ms
 * @param {number} [config.baseDelayMs=1500] - Base backoff delay in ms
 * @returns {Promise<Response>}
 */
export const fetchWithRetry = async (url, options = {}, config = {}) => {
  const {
    maxRetries = 3,
    timeoutMs = 15000,
    baseDelayMs = 1500,
  } = config;

  let attempt = 0;
  let delay = baseDelayMs;
  // Clean URL for safe logging (remove sensitive tokens if any query string exists)
  const sanitizedUrl = url.replace(/([?&]access_token=)[^&]+/i, "$1[REDACTED]");

  while (attempt < maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle retryable status codes: 502, 503, 504
      if ([502, 503, 504].includes(response.status)) {
        if (attempt < maxRetries) {
          // Drain response body so connection can be reused
          await response.text().catch(() => {});
          const jitter = Math.floor(Math.random() * 300);
          const backoff = delay + jitter;
          console.warn(
            `[githubService] Transient ${response.status} from GitHub on ${sanitizedUrl}. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`
          );
          await sleep(backoff);
          delay *= 2;
          continue;
        }
      }

      // Handle transient rate limit with Retry-After if <= 10s
      if ([403, 429].includes(response.status)) {
        const retryAfterHeader = response.headers.get("retry-after");
        if (retryAfterHeader) {
          const retrySec = parseInt(retryAfterHeader, 10);
          if (!isNaN(retrySec) && retrySec <= 10 && attempt < maxRetries) {
            await response.text().catch(() => {});
            console.warn(
              `[githubService] GitHub rate limit Retry-After: ${retrySec}s on ${sanitizedUrl}. Retrying attempt ${attempt}/${maxRetries}...`
            );
            await sleep(retrySec * 1000);
            continue;
          }
        }
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === "AbortError";
      const isNetworkError =
        err.name === "TypeError" ||
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "UND_ERR_CONNECT_TIMEOUT";

      if ((isTimeout || isNetworkError) && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 300);
        const backoff = delay + jitter;
        console.warn(
          `[githubService] Network issue (${isTimeout ? `Timeout after ${timeoutMs}ms` : err.message}) on ${sanitizedUrl}. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`
        );
        await sleep(backoff);
        delay *= 2;
        continue;
      }

      if (isTimeout) {
        const timeoutError = new Error(
          `GitHub request timed out after ${timeoutMs}ms for ${sanitizedUrl}.`
        );
        timeoutError.status = 504;
        timeoutError.code = "GITHUB_UPSTREAM_TIMEOUT";
        timeoutError.retryable = true;
        throw timeoutError;
      }

      throw err;
    }
  }
};

/**
 * Handles GitHub HTTP response status codes and converts to user-friendly typed errors.
 *
 * @param {Response} response
 * @param {string} entity
 */
export const handleApiError = async (response, entity = "Repository") => {
  if (response.ok) return;

  const status = response.status;
  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");
  const contentType = response.headers.get("content-type") || "";

  if (status === 403 && rateLimitRemaining === "0") {
    const resetDate = rateLimitReset
      ? new Date(parseInt(rateLimitReset, 10) * 1000).toLocaleTimeString()
      : "shortly";
    const error = new Error(
      `GitHub API rate limit exceeded. Resets at ${resetDate}. Configure a GITHUB_TOKEN in server/.env for 5,000 requests/hour.`
    );
    error.status = 429;
    error.code = "GITHUB_RATE_LIMITED";
    error.retryable = false;
    throw error;
  }

  if (status === 404) {
    const error = new Error(
      `${entity} not found. Please check the repository URL and ensure it is public (or configure GITHUB_TOKEN with appropriate repository access).`
    );
    error.status = 404;
    error.code = "GITHUB_NOT_FOUND";
    error.retryable = false;
    throw error;
  }

  if (status === 401) {
    const error = new Error(
      "GitHub authentication failed. The configured GITHUB_TOKEN is invalid or expired."
    );
    error.status = 401;
    error.code = "GITHUB_UNAUTHORIZED";
    error.retryable = false;
    throw error;
  }

  if (status === 504) {
    const error = new Error(
      `GitHub gateway timeout while accessing ${entity}. GitHub's edge gateway did not receive a timely response from its origin servers.`
    );
    error.status = 504;
    error.code = "GITHUB_UPSTREAM_TIMEOUT";
    error.retryable = true;
    throw error;
  }

  if (status === 502) {
    const error = new Error(
      `GitHub bad gateway while accessing ${entity}. The upstream GitHub service encountered a temporary error.`
    );
    error.status = 502;
    error.code = "GITHUB_BAD_GATEWAY";
    error.retryable = true;
    throw error;
  }

  if (status === 503) {
    const error = new Error(
      `GitHub service temporarily unavailable while accessing ${entity}. GitHub may be undergoing maintenance.`
    );
    error.status = 503;
    error.code = "GITHUB_SERVICE_UNAVAILABLE";
    error.retryable = true;
    throw error;
  }

  let message = `${entity} request failed with status ${status}.`;
  // Safe body inspection: only parse JSON when content-type indicates application/json
  if (contentType.includes("application/json")) {
    try {
      const errorBody = await response.json();
      if (errorBody.message) message = `GitHub Error: ${errorBody.message}`;
    } catch {
      // Ignore JSON parse errors on non-200 responses
    }
  } else {
    await response.text().catch(() => {});
  }

  const error = new Error(message);
  error.status = status >= 400 && status <= 504 ? status : 502;
  error.code = status >= 500 ? "GITHUB_SERVER_ERROR" : "GITHUB_API_ERROR";
  error.retryable = [502, 503, 504].includes(status);
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
 * Uses resilient fetchWithRetry to handle transient gateway errors and timeouts.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Object>} Formatted repository metadata
 */
export const fetchRepoMetadata = async (owner, repo) => {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: getHeaders(),
    },
    {
      maxRetries: 3,
      timeoutMs: 15000,
      baseDelayMs: 1500,
    }
  );

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
 * Uses resilient fetchWithRetry with an extended timeout for large trees.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} defaultBranch
 * @returns {Promise<{ tree: Array<Object>, stats: Object, isTruncated: boolean }>}
 */
export const fetchRepoTree = async (owner, repo, defaultBranch = "main") => {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;

  const response = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: getHeaders(),
    },
    {
      maxRetries: 3,
      timeoutMs: 30000,
      baseDelayMs: 2000,
    }
  );

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
    treeSha: data.sha || null,
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
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: getHeaders(),
      },
      {
        maxRetries: 2,
        timeoutMs: 12000,
        baseDelayMs: 1000,
      }
    );

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

/**
 * Downloads a GitHub repository archive as a ZIP file stream directly to local disk.
 * Replaces multi-call Git Blobs/Tree queries with a single resilient streaming request.
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} [branch="main"] - Target branch or ref
 * @param {string} destinationPath - Absolute local path to write the .zip archive
 * @param {Object} [options={}] - Configurable download options
 * @param {number} [options.maxArchiveBytes=104857600] - Max allowed archive size (default 100 MB)
 * @param {number} [options.timeoutMs=60000] - Download timeout (default 60s)
 * @returns {Promise<{ downloadedBytes: number }>}
 */
export const downloadRepoArchive = async (
  owner,
  repo,
  branch = "main",
  destinationPath,
  options = {}
) => {
  const {
    maxArchiveBytes = 100 * 1024 * 1024, // 100 MB limit
    headerTimeoutMs = 25000,
    streamTimeoutMs = 60000,
  } = options;

  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/${encodeURIComponent(branch)}`;

  const tStart = performance.now();
  let response;
  try {
    response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: getHeaders({
          Accept: "application/vnd.github+json",
        }),
        redirect: "follow",
      },
      {
        maxRetries: 2,
        timeoutMs: headerTimeoutMs,
        baseDelayMs: 1500,
      }
    );
  } catch (err) {
    safeUnlink(destinationPath);
    throw err;
  }

  await handleApiError(response, `Repository Archive for '${owner}/${repo}' (${branch})`);

  if (!response.body) {
    safeUnlink(destinationPath);
    const err = new Error("GitHub archive response contained an empty body.");
    err.code = "EMPTY_ARCHIVE";
    err.status = 502;
    throw err;
  }

  const sizeLimiter = new SizeLimitTransform(maxArchiveBytes);
  const fileWriteStream = fs.createWriteStream(destinationPath);
  const streamController = new AbortController();
  const streamTimer = setTimeout(() => {
    streamController.abort(new Error(`Archive streaming timed out after ${streamTimeoutMs}ms`));
  }, streamTimeoutMs);

  try {
    await pipeline(
      Readable.fromWeb(response.body),
      sizeLimiter,
      fileWriteStream,
      { signal: streamController.signal }
    );
    clearTimeout(streamTimer);

    const durationSec = ((performance.now() - tStart) / 1000).toFixed(2);
    const mbDownloaded = (sizeLimiter.totalBytes / (1024 * 1024)).toFixed(2);
    const speedMbps = ((sizeLimiter.totalBytes / (1024 * 1024)) / Math.max(0.01, durationSec)).toFixed(2);
    console.log(
      `[githubService] Downloaded ${mbDownloaded} MB archive for ${owner}/${repo} in ${durationSec}s (${speedMbps} MB/s)`
    );

    return {
      downloadedBytes: sizeLimiter.totalBytes,
      durationMs: Math.round(performance.now() - tStart),
    };
  } catch (streamErr) {
    clearTimeout(streamTimer);
    safeUnlink(destinationPath);
    if (streamErr.name === "AbortError" || streamController.signal.aborted) {
      const timeoutErr = new Error(
        `Repository archive download from GitHub stalled or exceeded ${Math.round(streamTimeoutMs / 1000)}s.`
      );
      timeoutErr.code = "GITHUB_STREAM_TIMEOUT";
      timeoutErr.status = 504;
      timeoutErr.retryable = true;
      throw timeoutErr;
    }
    throw streamErr;
  }
};

