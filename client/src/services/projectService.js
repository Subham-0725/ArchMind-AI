// src/services/projectService.js
//
// Axios calls for project and repository integration endpoints.
// All requests send the Clerk JWT in the Authorization header.

import axios from "axios";

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // 30s for large repository scans
});

/**
 * Import or refresh a GitHub repository by URL.
 *
 * @param {string} token          - Clerk JWT from useAuth().getToken()
 * @param {string} repoUrl        - Full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @param {Object} [options]      - Options, e.g. { force: true }
 * @returns {Promise<Object>} Created/updated Project document with cache metadata
 */
export const importGithubProject = async (token, repoUrl, options = {}) => {
  const params = options.force ? { force: "true" } : {};
  const { data } = await api.post(
    "/api/projects/github",
    { repoUrl },
    {
      params,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 120000, // 2 minutes - matches ZIP upload buffer for archive download & extraction
    }
  );

  const projectData = data.data || {};
  if (data.message) {
    projectData.message = data.message;
    projectData.isCached = Boolean(data.message.includes("cached analysis"));
  }
  return projectData;
};

/**
 * Upload a ZIP repository archive for analysis.
 *
 * Uses axios directly (NOT the shared `api` instance) because the instance
 * has a default Content-Type: application/json header that corrupts FormData
 * by overriding the multipart/form-data boundary that axios generates.
 *
 * @param {string}   token        - Clerk JWT from useAuth().getToken()
 * @param {File}     file         - The ZIP File object from the file input / drop zone
 * @param {function} [onProgress] - Optional upload progress callback (receives 0–100)
 * @param {Object}   [options]    - Options, e.g. { force: true }
 * @returns {Promise<Object>} Created/updated Project document with cache metadata
 */
export const uploadZipRepository = async (token, file, onProgress, options = {}) => {
  const formData = new FormData();
  formData.append("repository", file);

  const params = options.force ? { force: "true" } : {};

  // Use axios directly — bypasses the instance-level Content-Type: application/json
  // default so axios can auto-set "multipart/form-data; boundary=..." correctly.
  const { data } = await axios.post(
    `${API_BASE_URL}/api/projects/upload`,
    formData,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        // No Content-Type override — axios sets multipart + boundary automatically
      },
      timeout: 120000, // 2 min — large ZIPs take time to extract + scan server-side
      onUploadProgress: onProgress
        ? (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(pct);
            }
          }
        : undefined,
    }
  );

  const projectData = data.data || {};
  if (data.message) {
    projectData.message = data.message;
    projectData.isCached = Boolean(data.message.includes("cached analysis"));
  }
  return projectData;
};

/**
 * Retrieve a single source file's content and metadata from repository storage.
 *
 * @param {string} token            - Clerk JWT from useAuth().getToken()
 * @param {string} projectId        - MongoDB Project ObjectId
 * @param {string} filePath         - Relative path in repository tree
 * @param {AbortSignal} [signal]    - Optional AbortSignal to cancel pending request
 * @returns {Promise<Object>} File metadata and content
 */
export const fetchProjectFile = async (token, projectId, filePath, signal) => {
  const { data } = await api.get(`/api/projects/${projectId}/file`, {
    params: { path: filePath },
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  return data.file;
};

// Alias for file retrieval
export const getProjectFile = fetchProjectFile;


/**
 * Normalizes backend error responses into a consistent UI error object.
 * Format: { message: string, code: string, status: number, details: any }
 *
 * @param {Error|any} err
 * @returns {{ message: string, code: string, status: number, details: any }}
 */
export const normalizeApiError = (err) => {
  if (!err) {
    return {
      message: "An unexpected error occurred.",
      code: "UNKNOWN_ERROR",
      status: 500,
      details: null,
    };
  }

  // Network / Timeout
  if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
    return {
      message: "Request timed out. The server took too long to respond.",
      code: "REQUEST_TIMEOUT",
      status: 408,
      details: null,
    };
  }
  if (!err.response) {
    return {
      message: err.message || "Network error. Please check your internet connection.",
      code: "NETWORK_ERROR",
      status: 0,
      details: null,
    };
  }

  const { status, data } = err.response;
  let message = "An unexpected server error occurred.";
  let code = "SERVER_ERROR";
  let details = null;

  if (typeof data === "string") {
    message = data;
  } else if (data) {
    if (typeof data.error === "string") {
      message = data.error;
    } else if (data.error && typeof data.error.message === "string") {
      message = data.error.message;
      if (data.error.code) code = data.error.code;
    }

    if (data.errorDetail) {
      if (data.errorDetail.message) message = data.errorDetail.message;
      if (data.errorDetail.code) code = data.errorDetail.code;
      if (data.errorDetail.details) details = data.errorDetail.details;
    } else if (data.code) {
      code = data.code;
    }
  }

  // Sanitize message: strip server filesystem paths (e.g. C:\... or /home/...)
  message = message.replace(/[A-Z]:\\[^:\s]+/gi, "[REDACTED_PATH]");

  return { message, code, status, details };
};

/**
 * Fetch the authenticated user's projects with pagination, sorting, and search.
 *
 * @param {string} token          - Clerk JWT from useAuth().getToken()
 * @param {Object} [options]      - Query options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string} [options.sortBy="updatedAt"]
 * @param {string} [options.order="desc"]
 * @param {string} [options.search=""]
 * @param {AbortSignal} [signal]  - Optional AbortSignal for request cancellation
 * @returns {Promise<{ projects: Array<Object>, pagination: { total: number, page: number, limit: number, totalPages: number } }>}
 */
export const fetchProjects = async (token, options = {}, signal) => {
  const { page = 1, limit = 10, sortBy = "updatedAt", order = "desc", search = "" } = options;
  const params = { page, limit, sortBy, order };
  if (search && typeof search === "string" && search.trim()) {
    params.search = search.trim();
  }

  const { data } = await api.get("/api/projects", {
    params,
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  const projects = data.data || [];
  const pagination = data.pagination || {
    total: projects.length,
    page,
    limit,
    totalPages: Math.ceil(projects.length / limit) || 1,
  };

  return { projects, pagination };
};

/**
 * Fetch the authenticated user's recent projects (backward-compatible).
 *
 * @param {string} token - Clerk JWT from useAuth().getToken()
 * @returns {Promise<Array<Object>>} List of projects (without large trees)
 */
export const fetchRecentProjects = async (token) => {
  const { projects } = await fetchProjects(token, { page: 1, limit: 20 });
  return projects;
};

/**
 * Updates user-permitted metadata for an existing project.
 *
 * @param {string} token      - Clerk JWT
 * @param {string} projectId  - Project ObjectId
 * @param {Object} metadata   - Allowed fields: { name, description }
 * @returns {Promise<Object>} Updated project object
 */
export const updateProjectMetadata = async (token, projectId, metadata = {}) => {
  const trimmedName = String(metadata.name || "").trim();
  if (!trimmedName) {
    const err = new Error("Project name cannot be empty.");
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // Whitelist editable fields strictly (never pass status, userId, blueprint, etc.)
  const payload = { name: trimmedName };
  if (metadata.description !== undefined) {
    payload.description = String(metadata.description).trim();
  }

  const { data } = await api.patch(`/api/projects/${projectId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.data;
};

/**
 * Permanently deletes a project and cascade cleans all child resources on server.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - Project ObjectId
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteProject = async (token, projectId) => {
  const { data } = await api.delete(`/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data;
};

/**
 * Reanalyzes an existing project repository.
 * Increments analysis version, pulls fresh source, flushes cache, and runs RIE pipeline.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - Project ObjectId
 * @returns {Promise<Object>} Reanalysis result with safe updated project data
 */
export const reanalyzeProject = async (token, projectId) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/reanalyze`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 180000, // 3 minutes for full reanalysis pipeline
    }
  );

  return data;
};

/**
 * Downloads a comprehensive repository architecture & security PDF report.
 * Streams as binary Blob and triggers browser download.
 *
 * @param {string} token       - Clerk JWT
 * @param {string} projectId   - Project ObjectId
 * @param {string} projectName - Project name for filename formatting
 * @returns {Promise<{ success: boolean, filename: string, blob: Blob }>}
 */
export const downloadProjectPdfReport = async (token, projectId, projectName = "repository") => {
  try {
    const response = await api.get(`/api/projects/${projectId}/report/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "blob",
      timeout: 60000,
    });

    // Check if error JSON was returned inside a Blob
    if (response.data.type === "application/json") {
      const text = await response.data.text();
      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { error: text };
      }
      const err = new Error(parsed.error?.message || parsed.error || "Failed to generate PDF report.");
      err.response = { status: response.status, data: parsed };
      throw err;
    }

    const sanitized = (projectName || "repository")
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
    const filename = `ArchMind-Report-${sanitized}.pdf`;

    const blob = new Blob([response.data], { type: "application/pdf" });

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }

    return { success: true, filename, blob };
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        err.response.data = parsed;
      } catch {
        // ignore JSON parse error
      }
    }
    throw normalizeApiError(err);
  }
};

/**
 * Fetch full project details including the scanned file tree.
 *
 * @param {string} token     - Clerk JWT from useAuth().getToken()
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Project details with file tree
 */
export const fetchProjectById = async (token, projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.data;
};

/**
 * Run full analysis — queues all relevant modules.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Analysis queue result
 */
export const runFullAnalysis = async (token, projectId, options = {}) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/analyze`,
    { force: true, ...options },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

/**
 * Run analysis for a single module.
 *
 * @param {string} token      - Clerk JWT
 * @param {string} projectId  - MongoDB Project ObjectId
 * @param {string} moduleName - Module name (architecture, erd, api, security, devops)
 * @param {Object} [options]
 * @returns {Promise<Object>} Module analysis result
 */
export const runModuleAnalysis = async (token, projectId, moduleName, options = {}) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/${moduleName}`,
    { force: true, ...options },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

/**
 * Fetch analysis status for all modules.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Analysis status for all modules
 */
export const fetchAnalysisStatus = async (token, projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/analysis`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
};

/**
 * Fetch the dynamically extracted ArchMind AI Platform Database ERD (Mongoose schemas).
 *
 * @param {string} token - Clerk JWT
 * @returns {Promise<Object>} Platform ERD payload with entities, relationships, indexes, and stats
 */
export const fetchPlatformDatabaseErd = async (token) => {
  const { data } = await api.get("/api/projects/platform-erd", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
};

/**
 * Fetch the analyzed repository database ERD.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Repository ERD payload
 */
export const fetchProjectDatabaseErd = async (token, projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/erd`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
};

/**
 * Fetch project API routes with optional filtering.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {Object} [params]       - Filter query params (method, framework, search, file, auth)
 * @param {AbortSignal} [signal]  - Optional AbortSignal for request cancellation
 * @returns {Promise<Object>} Object with routes list, summary, frameworks, and counts
 */
export const fetchProjectApiRoutes = async (token, projectId, params = {}, signal) => {
  const { data } = await api.get(`/api/projects/${projectId}/api-routes`, {
    params,
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return data.data;
};

/**
 * Fetch detailed metadata and line-level citation for a specific route.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} routeId        - Deterministic route identifier
 * @param {AbortSignal} [signal]  - Optional AbortSignal
 * @returns {Promise<Object>} Detailed route data and citation
 */
export const fetchProjectApiRouteDetail = async (token, projectId, routeId, signal) => {
  const { data } = await api.get(`/api/projects/${projectId}/api-routes/${encodeURIComponent(routeId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return data.data;
};

/**
 * Fetch or generate request sequence diagram for an API route.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} routeId        - Deterministic route identifier
 * @param {AbortSignal} [signal]  - Optional AbortSignal
 * @returns {Promise<Object>} Sequence diagram with Mermaid string, participants, and citations
 */
export const fetchRouteSequenceDiagram = async (token, projectId, routeId, signal) => {
  const { data } = await api.get(`/api/projects/${projectId}/api-routes/${encodeURIComponent(routeId)}/sequence`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return data.data;
};

// =============================================================================
// REPOSITORY AI CHAT SERVICE (PHASE 3)
// =============================================================================

/**
 * Create a new repository AI chat conversation.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} [title]        - Optional custom conversation title
 * @returns {Promise<Object>} Created conversation document metadata
 */
export const createChatConversation = async (token, projectId, title) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/chat/conversations`,
    { title },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
};

/**
 * Fetch all chat conversations for the current user and project.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {AbortSignal} [signal]  - Optional AbortSignal
 * @returns {Promise<Array<Object>>} List of conversation metadata objects
 */
export const fetchChatConversations = async (token, projectId, signal) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/chat/conversations`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    }
  );
  return data.data || [];
};

/**
 * Retrieve complete message history and citations for a conversation.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} conversationId - MongoDB Conversation ObjectId
 * @param {AbortSignal} [signal]  - Optional AbortSignal
 * @returns {Promise<Object>} Conversation document with messages and citations
 */
export const fetchChatConversationHistory = async (token, projectId, conversationId, signal) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/chat/conversations/${conversationId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    }
  );
  return data.data;
};

/**
 * Send a user prompt to the Repository AI Chat backend and receive Groq completion.
 * Supports real-time Server-Sent Events (SSE) streaming when onStage or onToken callbacks are provided,
 * with graceful fallback to standard buffered REST.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} conversationId - MongoDB Conversation ObjectId
 * @param {string} message        - User's prompt text
 * @param {Object|AbortSignal} [options] - Options object { onStage, onToken, signal } or AbortSignal
 * @returns {Promise<Object>} Turn result with assistant message and verified citations
 */
export const sendChatMessage = async (token, projectId, conversationId, message, options = {}) => {
  const signal = options instanceof AbortSignal ? options : options.signal;
  const onStage = typeof options.onStage === "function" ? options.onStage : null;
  const onToken = typeof options.onToken === "function" ? options.onToken : null;

  // ── Streaming Mode (SSE) via native Fetch + ReadableStream ──────────────────
  if (onStage || onToken) {
    const url = `${API_BASE_URL}/api/projects/${projectId}/chat/conversations/${conversationId}/messages?stream=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
      signal,
    });

    if (!response.ok) {
      let errPayload;
      try {
        errPayload = await response.json();
      } catch {
        errPayload = { error: `Server error: ${response.statusText}` };
      }
      const err = new Error(errPayload.error || "Failed to process chat message.");
      err.status = response.status;
      err.code = errPayload.code;
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || ""; // Keep trailing partial block

      for (const block of blocks) {
        if (!block.trim()) continue;
        let event = "message";
        let dataStr = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6).trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            if (event === "stage") {
              onStage?.(parsed.label || parsed.stage);
            } else if (event === "token") {
              onToken?.(parsed.token);
            } else if (event === "done") {
              finalResult = parsed;
            } else if (event === "error") {
              const err = new Error(parsed.error || "Streaming error occurred.");
              err.code = parsed.code;
              err.status = parsed.status || 500;
              throw err;
            }
          } catch (jsonErr) {
            if (event === "error") throw jsonErr;
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error("Chat stream disconnected unexpectedly.");
    }

    return finalResult;
  }

  // ── Standard Buffered REST Mode ───────────────────────────────────────────
  const { data } = await api.post(
    `/api/projects/${projectId}/chat/conversations/${conversationId}/messages`,
    { message },
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
      timeout: 60000, // 60s for LLM context retrieval and Groq completion
    }
  );
  return data.data;
};

/**
 * Delete a chat conversation and all its messages.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} conversationId - MongoDB Conversation ObjectId
 * @returns {Promise<Object>} Success acknowledgement
 */
export const deleteChatConversation = async (token, projectId, conversationId) => {
  const { data } = await api.delete(
    `/api/projects/${projectId}/chat/conversations/${conversationId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
};

/**
 * Rename/update a conversation title.
 *
 * @param {string} token          - Clerk JWT
 * @param {string} projectId      - MongoDB Project ObjectId
 * @param {string} conversationId - MongoDB Conversation ObjectId
 * @param {string} title          - New conversation title
 * @returns {Promise<Object>} Updated title metadata
 */
export const updateChatConversationTitle = async (token, projectId, conversationId, title) => {
  const { data } = await api.patch(
    `/api/projects/${projectId}/chat/conversations/${conversationId}`,
    { title },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
};

// ── Phase 4: Security & Code Quality Services ───────────────────────────────

/**
 * Triggers a security scan against the repository.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Scan result summary
 */
export const triggerSecurityScan = async (token, projectId) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/security/scan`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 60000,
    }
  );
  return data.data;
};

/**
 * Retrieves the overall security summary for a project.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Object>} Security audit summary
 */
export const getSecuritySummary = async (token, projectId) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/security`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
};

/**
 * Retrieves paginated and filtered security findings.
 *
 * @param {string} token        - Clerk JWT
 * @param {string} projectId    - MongoDB Project ObjectId
 * @param {Object} [queryParams] - { severity, category, status, source, ruleId, filePath, page, limit }
 * @returns {Promise<Object>} { findings, pagination }
 */
export const getSecurityFindings = async (token, projectId, queryParams = {}) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/security/findings`,
    {
      params: queryParams,
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return {
    findings: data.data || [],
    pagination: data.pagination || { totalCount: 0, page: 1, limit: 50, totalPages: 1 },
  };
};

/**
 * Retrieves full details for a single security finding.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} findingId - MongoDB Finding ObjectId
 * @returns {Promise<Object>} Finding detail
 */
export const getSecurityFindingDetail = async (token, projectId, findingId) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/security/findings/${findingId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
};

/**
 * Updates the review status of a finding (open, resolved, ignored).
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} findingId - MongoDB Finding ObjectId
 * @param {string} status    - "open" | "resolved" | "ignored"
 * @returns {Promise<Object>} Updated finding
 */
export const updateSecurityFindingStatus = async (token, projectId, findingId, status) => {
  const { data } = await api.patch(
    `/api/projects/${projectId}/security/findings/${findingId}`,
    { status },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.data;
};

/**
 * Requests an AI-assisted code review for a specific source file via Groq.
 *
 * @param {string} token        - Clerk JWT
 * @param {string} projectId    - MongoDB Project ObjectId
 * @param {string} filePath     - Relative repository path
 * @param {string} [customFocus] - Optional review focus (security, performance, maintainability, etc.)
 * @returns {Promise<Object>} Code review analysis
 */
export const triggerCodeReview = async (token, projectId, filePath, customFocus = "") => {
  const { data } = await api.post(
    `/api/projects/${projectId}/code-review`,
    { filePath, customFocus: customFocus.trim() || undefined },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 90000, // 90s for large file AST & Groq LLM processing
    }
  );
  return data.data;
};

/**
 * Requests unit test generation for a specific source file via Groq.
 *
 * @param {string} token     - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} filePath  - Relative repository path
 * @returns {Promise<Object>} Test generation preview
 */
export const triggerTestGeneration = async (token, projectId, filePath) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/tests/generate`,
    { filePath },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 90000, // 90s for test generation & validation
    }
  );
  return data.data;
};

// ── Phase 5: DevOps Artifact Generation Services ──────────────────────────────

/**
 * Generates DevOps deployment artifacts for a project.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string[]} [artifactTypes] - Array of "dockerfile" | "cicd" | "kubernetes"
 * @param {Object} [options] - Options (e.g. { includeKubernetesIngress: false })
 * @returns {Promise<Array<Object>>} List of generated DevOps artifacts
 */
export const generateDevOpsArtifacts = async (token, projectId, artifactTypes = null, options = {}) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/devops/generate`,
    { artifactTypes, options },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 120000, // 2m for multi-artifact Groq generation
    }
  );
  return data?.data?.artifacts || [];
};

/**
 * Lists all active (non-superseded) DevOps artifacts for a project.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @returns {Promise<Array<Object>>} List of artifacts
 */
export const fetchDevOpsArtifacts = async (token, projectId) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/devops/artifacts`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    }
  );
  return data?.data?.artifacts || [];
};

/**
 * Retrieves full details and content for a single DevOps artifact.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} artifactId - MongoDB DevOpsArtifact ObjectId
 * @returns {Promise<Object>} DevOps artifact detail
 */
export const fetchDevOpsArtifact = async (token, projectId, artifactId) => {
  const { data } = await api.get(
    `/api/projects/${projectId}/devops/artifacts/${artifactId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    }
  );
  return data?.data?.artifact || null;
};

/**
 * Regenerates a specific DevOps artifact using latest repository analysis.
 * Preserves history and increments version on the backend.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} artifactId - MongoDB DevOpsArtifact ObjectId
 * @param {Object} [options] - Regeneration options
 * @returns {Promise<Object>} Updated DevOps artifact
 */
export const regenerateDevOpsArtifact = async (token, projectId, artifactId, options = {}) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/devops/artifacts/${artifactId}/regenerate`,
    { options },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 90000,
    }
  );
  return data?.data?.artifact || null;
};

/**
 * Re-runs deterministic validation against a stored DevOps artifact.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} artifactId - MongoDB DevOpsArtifact ObjectId
 * @returns {Promise<Object>} Artifact with updated validation report
 */
export const validateDevOpsArtifact = async (token, projectId, artifactId) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/devops/artifacts/${artifactId}/validate`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    }
  );
  return data?.data?.artifact || null;
};

/**
 * Deletes a DevOps artifact from ArchMind AI.
 *
 * @param {string} token - Clerk JWT
 * @param {string} projectId - MongoDB Project ObjectId
 * @param {string} artifactId - MongoDB DevOpsArtifact ObjectId
 * @returns {Promise<boolean>} Success confirmation
 */
export const deleteDevOpsArtifact = async (token, projectId, artifactId) => {
  const { data } = await api.delete(
    `/api/projects/${projectId}/devops/artifacts/${artifactId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    }
  );
  return data?.success === true;
};





