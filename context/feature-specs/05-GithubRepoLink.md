# GitHub Repository Integration (Feature 05)

## Status: Completed ✅

## Overview
Allows authenticated users to provide a GitHub repository link, fetch metadata and recursive file structures via the GitHub REST API (with RIE noise filtering), and persist the project in MongoDB Atlas associated with the user's Clerk ID.

---

## Requirements & Implementation Status

- [x] **1. Backend API Endpoint**: Created `POST /api/projects/github` to accept repository URLs.
- [x] **2. URL Validation**: Built `server/src/utils/githubUrl.js` with regex validation for GitHub usernames and repo names.
- [x] **3. Extraction of Owner & Repo**: Normalizes and extracts owner and repo across formats (`https://github.com/owner/repo`, `owner/repo`, `.git`, `/tree/main`).
- [x] **4. Repository Metadata Fetching**: `fetchRepoMetadata` in `server/src/services/githubService.js` fetches stars, forks, open issues, language, topics, default branch, license, and privacy status.
- [x] **5. Repository File & Folder Tree**: `fetchRepoTree` retrieves recursive tree via the GitHub Git Trees API.
- [x] **6. Public & Private Access**: Supports public repositories without authentication and private/high-rate-limit repositories via optional `GITHUB_TOKEN`.
- [x] **7. API Error Handling**: Normalizes GitHub 404 (not found / private), 401 (invalid token), and 403 / 429 rate limit exceeded errors with reset timestamps.
- [x] **8. MongoDB Persistence**: Schema in `server/src/models/Project.js` stores metadata, filtered file tree, and summary statistics.
- [x] **9. Clerk User Association**: Strict multi-tenant isolation keyed on `req.auth.userId`.
- [x] **10. Duplicate Prevention & Upserts**: Compound unique index `{ userId: 1, "github.fullName": 1 }` with atomic `findOneAndUpdate` upserts to refresh repository metadata without duplicates.
- [x] **11. Frontend Payload**: Returns sanitized project object via `toSafeObject()` and populates `RecentProjects` list.
- [x] **12. Auth Guard**: Protected with `requireAuth` middleware validating Clerk JWTs.
- [x] **13. Rate Limit Handling**: Captures `x-ratelimit-remaining` and `x-ratelimit-reset` headers.
- [x] **14. Secure Secrets**: `GITHUB_TOKEN` loaded from server environment via centralized `server/src/config/env.js`.
- [x] **15. RIE Noise Filtering**: Filters out `node_modules`, `.git`, `dist`, `build`, `.next`, `venv`, `__pycache__`, lockfiles, and binary assets before persistence.
- [x] **16. Verification**: Verified valid URLs (`facebook/react`, `Subham-0725/CVNexus`), invalid formats, non-existent repos (404), and live browser sync.

---

## Technical Deliverables

| Component | File Path | Responsibility |
| --- | --- | --- |
| **URL Parser** | `server/src/utils/githubUrl.js` | Parses and validates GitHub URLs across all standard formats |
| **GitHub Service** | `server/src/services/githubService.js` | REST API communication, recursive tree fetching, RIE noise filter, rate limit handling |
| **Project Model** | `server/src/models/Project.js` | Mongoose schema with multi-tenant isolation, GitHub metadata, and sanitized tree |
| **Project Controller** | `server/src/controllers/project.controller.js` | `importGithub`, `getProjects`, and `getProjectById` handlers |
| **Project Routes** | `server/src/routes/project.routes.js` | Authenticated Express routes mounted at `/api/projects` |
| **Frontend Service** | `client/src/services/projectService.js` | Axios API client for GitHub repository import and recent project listing |
| **Dashboard UI** | `client/src/pages/Dashboard.jsx` | Smart prefix stripping, scanning state, feedback banners, and real recent project list |
