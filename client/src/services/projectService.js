// src/services/projectService.js
//
// Axios calls for project and repository integration endpoints.
// All requests send the Clerk JWT in the Authorization header.

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000, // 30s for large repository scans
});

/**
 * Import or refresh a GitHub repository by URL.
 *
 * @param {string} token   - Clerk JWT from useAuth().getToken()
 * @param {string} repoUrl - Full GitHub repository URL (e.g. "https://github.com/owner/repo")
 * @returns {Promise<Object>} Created/updated Project document
 */
export const importGithubProject = async (token, repoUrl) => {
  const { data } = await api.post(
    "/api/projects/github",
    { repoUrl },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return data.data;
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
 * @returns {Promise<Object>} Created/updated Project document
 */
export const uploadZipRepository = async (token, file, onProgress) => {
  const formData = new FormData();
  formData.append("repository", file);

  // Use axios directly — bypasses the instance-level Content-Type: application/json
  // default so axios can auto-set "multipart/form-data; boundary=..." correctly.
  const { data } = await axios.post(
    `${API_BASE_URL}/api/projects/upload`,
    formData,
    {
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

  return data.data;
};


/**
 * Fetch the authenticated user's recent projects.
 *
 * @param {string} token - Clerk JWT from useAuth().getToken()
 * @returns {Promise<Array<Object>>} List of projects (without large trees)
 */
export const fetchRecentProjects = async (token) => {
  const { data } = await api.get("/api/projects", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.data || [];
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
export const runFullAnalysis = async (token, projectId) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/analyze`,
    {},
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
 * @returns {Promise<Object>} Module analysis result
 */
export const runModuleAnalysis = async (token, projectId, moduleName) => {
  const { data } = await api.post(
    `/api/projects/${projectId}/${moduleName}`,
    {},
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

