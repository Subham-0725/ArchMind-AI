# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Phase 1 — Frontend Foundation & Authentication (In Progress)

## Current Goal

- Feature 09 — Repository Intelligence Engine: Tree-sitter AST parsing & Repository Blueprint aggregator.

## Completed

- upto 11-SmartRelevanceDetectionFrontend.md and Smart Relevance Integration Testing

### Frontend Foundation
- ✅ Landing Page fully implemented:
  - `HeroSection.jsx` — Hero with animated gradients and CTAs
  - `FeaturesSection.jsx` — Feature cards with icons
  - `WorkflowSection.jsx` — Step-by-step workflow visualization
  - `CtaSection.jsx` — Call-to-action with sign-up prompt
  - `Footer.jsx` — Footer with social links and branding
  - `LandingPage.jsx` — Main landing page composition
- ✅ Navigation & Layout:
  - `Navbar.jsx` — Responsive navigation with routing
  - App routing structure with React Router DOM 7
- ✅ Styling & Animation:
  - Tailwind CSS v4 integrated with custom theme tokens
  - `client/src/themes/` — Color and font constants
  - Framer Motion animations configured
  - Lenis smooth scrolling setup
  - Custom utility classes (`.archmind-glass`, `.archmind-gradient-text`, `.archmind-hover`)

### Authentication
- ✅ Clerk authentication fully integrated:
  - Frontend SDK (`@clerk/clerk-react`) configured
  - Sign-in/Sign-up flows connected (Clerk hosted + modal)
  - `UserButton` component integrated
- ✅ Route guards implemented (`client/src/routes/`):
  - `PrivateRoute.jsx` — Blocks unauthenticated access; shows branded loading screen during JWT hydration, then uses Clerk's `<RedirectToSignIn />` to send unauth users to the hosted sign-in page (with post-login redirect back)
  - `PublicOnlyRoute.jsx` — Blocks authenticated users from public-only pages; redirects them to `/dashboard` so they skip the marketing funnel
  - `AppRoutes.jsx` — Refactored to use both guards declaratively; no more inline `<SignedIn>/<SignedOut>` noise per route
- ✅ Dashboard page fully implemented (`client/src/pages/Dashboard.jsx`):
  - Glassmorphic sticky header with ArchMind AI branding and Clerk `UserButton`
  - Ambient aurora background (cyan/blue/indigo glows)
  - ZIP drag-and-drop upload card with counter-based drag tracking, file-selected state, file name/size display, and clear action
  - OR divider separating input methods
  - GitHub URL input card with inline `github.com/` prefix badge, focus glow ring, and clear button
  - Analyze Project button (enabled only when file or URL provided) with shimmer/gradient animation
  - Trust indicators row (Architecture Diagrams, Security Audits, DevOps Manifests)
  - Clerk loading spinner during hydration
  - Framer Motion stagger reveals; respects `prefers-reduced-motion`

### Documentation
- ✅ Context documentation complete:
  - `project-overview.md` — Product vision, goals, features, scope
  - `architecture.md` — Stack, boundaries, storage, auth model, invariants
  - `code-standards.md` — React, styling, API, naming, file organization conventions
  - `ui-context.md` — Design system, color tokens, animations
  - `ai-workflow-rules.md` — AI development workflow and scoping rules
  - `progress-tracker.md` — This file

### Backend Foundation
- ✅ Express.js server structure:
  - `server/src/server.js` — Server entry point
  - `server/src/app.js` — Express app with CORS, JSON parsing, Clerk middleware, 404 + global error handlers
  - Folder structure created: `config/`, `controllers/`, `middleware/`, `models/`, `routes/`, `services/`, `utils/`
- ✅ MongoDB User sync implemented (Feature 04):
  - `server/src/models/User.js` — Mongoose schema keyed on `clerkId`; `toSafeObject()` method strips internal fields
  - `server/src/middleware/auth.middleware.js` — `requireAuth` guard using `getAuth(req)` from `@clerk/express`
  - `server/src/controllers/user.controller.js` — `syncUser` (upsert via `findOneAndUpdate`) + `getMe` handlers
  - `server/src/routes/user.routes.js` — `POST /api/users/sync` and `GET /api/users/me`
  - `client/src/services/userService.js` — Axios functions for both endpoints; JWT passed in by caller
  - `client/src/hooks/useUserSync.js` — Fires once on Dashboard mount; gets Clerk JWT → posts to sync endpoint → stores DB user in state
  - `client/src/pages/Dashboard.jsx` — Wired `useUserSync`; dismissible amber banner shown if sync fails

- ✅ GitHub Repository Integration implemented (Feature 05):
  - `server/src/utils/githubUrl.js` — Normalizes and validates URLs across formats (`https://github.com/owner/repo`, `owner/repo`, `.git`, subpaths)
  - `server/src/services/githubService.js` — Fetches metadata & recursive Git tree via GitHub REST API with RIE noise filtering (`node_modules`, `.git`, `dist`, `build`, `.next`, `venv`, lockfiles, binary media) and rate limit handling
  - `server/src/models/Project.js` — Mongoose schema for projects with multi-tenant isolation (`userId` from Clerk), GitHub metadata, filtered file tree, and compound unique index
  - `server/src/controllers/project.controller.js` — `importGithub` (atomic upsert), `getProjects` (recent list), and `getProjectById` handlers
  - `server/src/routes/project.routes.js` — Guarded `/api/projects` endpoints
  - `client/src/services/projectService.js` — Axios client for GitHub import and project list
  - `client/src/pages/Dashboard.jsx` — Wired GitHub repository submission with active scanning states, error/success banners, and real recent project cards

- ✅ ZIP Repository Upload implemented (Feature 06):
  - `server/src/config/multer.js` — Disk-storage Multer config; `.zip`-only MIME+ext guard; 50 MB limit; collision-safe filenames
  - `server/src/storage/uploads/` — Ephemeral upload staging directory
  - `server/src/storage/extracted/` — Ephemeral extraction workspace
  - `server/src/rie/zipExtractor.js` — Magic-byte ZIP validation, `adm-zip` extraction, job-scoped output directory, typed error codes (`INVALID_ZIP`, `EMPTY_ZIP`, `EXTRACT_ERROR`)
  - `server/src/rie/repoScanner.js` — Recursive `fs`/`path` walker, RIE noise filter, file tree stats, multi-language tech stack detection (Node/Python/Java/Go/Rust/PHP/Ruby + Docker/K8s/CI)
  - `server/src/models/Project.js` — Added `zip` metadata block + `techStack` sub-document; exposed in `toSafeObject()`
  - `server/src/controllers/project.controller.js` — `uploadZip` handler: RIE pipeline → MongoDB upsert → guaranteed cleanup in `finally`
  - `server/src/routes/project.routes.js` — `POST /api/projects/upload` with `handleMulterErrors` wrapper converting Multer errors to JSON

- ✅ Repository Language & Framework Identification implemented (Feature 08):
  - `server/src/services/languageDetector.js` — Multi-signal static language & framework detector: extension mapping & size ratios, manifest/config file analysis (`package.json`, `tsconfig.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `composer.json`, `Gemfile`, `.csproj`), polyglot ranking, TypeScript preference, framework detection (React, Next.js, Vue, Angular, Express, NestJS, Fastify, Django, Flask, FastAPI, Spring Boot, Gin, Echo, Actix, Axum, Laravel, Rails, ASP.NET), and weighted confidence scoring (capped at 0.98; 0 for non-code/empty repos)
  - `server/src/models/Project.js` — Added `primaryLanguage`, `secondaryLanguages`, `languageDetectionConfidence` schema fields, updated `toSafeObject()` method
  - `server/src/controllers/project.controller.js` — Integrated `detectProjectLanguage` into `uploadZip` and `importGithub` controllers; exposed fields in `getProjects` and `getProjectById`
  - `client/src/pages/Dashboard.jsx` — Updated recent projects cards to display primary language badge, secondary language tags, framework tags, and language detection confidence percentage
  - `scratch/test-language-detector.js` — Comprehensive test suite verifying JS/React, TS/Next.js, Polyglot (Python+TS), and Docs-only edge cases

- ✅ Project Workspace Frontend implemented:
  - Installed `@xyflow/react` and `dagre` dependencies for React Flow node/edge rendering and graph layouting
  - `client/src/pages/ProjectWorkspace.jsx` — Implemented main workspace container (30%/70% layout), loading state, error retry state, and tab navigation
  - `client/src/components/project/ProjectHeader.jsx` — Header with back-to-dashboard link, project name, branch, source badge, status pill, and feature tabs
  - `client/src/components/project/ProjectOverviewCard.jsx` — Overview card displaying file metrics, size, primary/secondary language, detection confidence %, and top extensions
  - `client/src/components/project/TechStackCard.jsx` — Categorized technology stack breakdown (Frameworks, Databases, DevOps, Languages)
  - `client/src/components/project/FileTreeExplorer.jsx` — Nested collapsible file tree explorer with search filtering and file size badges
  - `client/src/components/project/topology/topologyUtils.js` — Dagre graph layout calculator supporting LR / TB orientations
  - `client/src/components/project/topology/ServiceNode.jsx` — Custom React Flow node component with tier badges (Frontend, Backend, Database, DevOps) and handles
  - `client/src/components/project/topology/TopologyCanvas.jsx` — React Flow canvas with custom nodes, controls, minimap, background grid, fitView, and orientation toggles
- ✅ Smart Relevance Detector / Feature Capability Matrix implemented:
  - `server/src/rie/relevanceDetector.js` — RIE module for detecting `hasDatabase`, `hasApis`, `hasDevops`, `hasSecuritySensitiveCode`, and `details` breakdown without LLM calls
  - `server/src/models/Project.js` — Added `capabilities` sub-document to Mongoose schema and exposed in `toSafeObject()`
  - `server/src/controllers/project.controller.js` — Integrated `detectCapabilities` into `uploadZip`, `importGithub`, and on-the-fly resolution in `getProjectById`
  - `scratch/test-relevance-detector.js` — Unit test suite verifying Database, API, DevOps, Security, and false-positive defense against documentation directories
  - `client/src/constants/workspaceTabs.js` — Centralized tab configuration (`topology`, `erd`, `apis`, `devops`, `security`) and capability helper functions
  - `client/src/components/project/ProjectHeader.jsx` — Dynamic capability tabs with technology badges (`[MongoDB]`, `[Express.js]`, `[Docker]`) and responsive horizontal scroll
  - `client/src/components/project/CapabilityTabPanel.jsx` — Capability module cards & explanatory disabled empty states ("No database schemas detected in this repository...")
  - `client/src/pages/ProjectWorkspace.jsx` — Integrated capability tab panels, default topology canvas view, and capability loading state
- ✅ Tree-sitter AST Parsing (Feature 12):
  - Added `tree-sitter`, `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-python` backend dependencies.
  - `server/src/rie/parsers/jsTsParser.js` — AST extractor for JS/TS/JSX/TSX (imports, exports, functions, classes, methods, Express routes, Mongoose models).
  - `server/src/rie/parsers/pythonParser.js` — AST extractor for Python (imports, functions, decorated definitions, FastAPI/Flask routes, SQLAlchemy/Django models).
  - `server/src/rie/astParser.js` — Central coordinator `parseRepository` with noise path exclusion, file size limits, error isolation, and internal/external dependency normalization.
  - `server/src/models/Project.js` — Added `ast` subdocument schema and exposed in `toSafeObject()`.
  - `server/src/controllers/project.controller.js` — Integrated AST extraction into `uploadZip` and `importGithub` ingestion controllers.
  - `server/test-ast-parser.js` — Comprehensive 22-assertion unit and integration test suite passing with 0 failures.

- ✅ Repository Blueprint Aggregator (Feature 13):
  - `server/src/rie/blueprintAggregator.js` — Core aggregation module combining Tree-sitter AST, File Tree, Language & Tech Stack, and Capabilities into a normalized, versioned JSON blueprint.
  - Implemented deduplication for imports, internal/external dependencies, API routes, database models, classes, and functions.
  - Configurable token-budget context optimization algorithm prioritizing metadata, capabilities, entry points, routes, and database models while truncating low-priority details if `maxTokens` limit is exceeded.
  - `server/src/models/Project.js` — Added `blueprint` subdocument to Project schema and exposed in `toSafeObject()`.
  - `server/src/controllers/project.controller.js` — Integrated `aggregateBlueprint` into `uploadZip` and `importGithub` controllers, and added `getProjectBlueprint` endpoint handler (`GET /api/projects/:id/blueprint`).
  - `server/test-blueprint-aggregator.js` — Unit test suite with 22 assertions verifying metadata aggregation, deduplication, path normalization, token budgeting, and empty/malformed AST edge cases.
  - `server/test-real-blueprint.js` — Integration test running full RIE pipeline against real codebase.

- ✅ LLM API Integration for Architecture & ERD Generation (Feature 14):
  - Installed `@google/genai` SDK dependency.
  - `server/src/services/llmService.js` — Core LLM service exposing `generateArchitecture(blueprint)` and `generateERD(blueprint)`.
  - Implemented strict schema validation and fallback JSON repair (`parseAndValidateJson`) ensuring valid React Flow `{ nodes, edges }` and ERD `{ entities, relationships }`.
  - Enforced Capability Guard: `generateERD` immediately returns `null` without making an LLM request if `blueprint.capabilities.hasDatabase` is false.
  - Included deterministic fallback generator for testing environments and missing API key configurations.
  - `server/src/controllers/analysis.controller.js` — Integrated asynchronous `executeModuleAnalysis` helper driving module lifecycle (`idle` → `queued` → `processing` → `completed` | `failed`) and caching results in `project.analysisResults`.
  - `server/src/models/Project.js` — Exposed `analysisResults` in `toSafeObject()`.
  - `server/test-llm-integration.js` — Unit & integration test suite with 12 assertions covering schema validation, edge filtering, ERD capability guards, mock generation, and malformed JSON error isolation.

- ✅ Repository Intelligence Engine (RIE) Stabilization & Phase 1 Backend Completion:
  - Unified RIE Analysis Pipeline (`server/src/rie/pipeline/analysisPipeline.js`) unifying both ZIP and GitHub ingestion.
  - Deterministic Secret Scanning & Redaction (`server/src/rie/security/secretScanner.js`, `secretPatterns.js`, `secretRedactor.js`).
  - Source File Indexing & Persistence (`server/src/models/SourceFile.js`, `server/src/rie/indexing/sourceIndexer.js`).
  - Strict Repository Blueprint Schema Validation (`server/src/rie/validation/blueprintValidator.js`).
  - Secure Source File Content Retrieval endpoint (`GET /api/projects/:id/file?path=...`).
  - Analysis Versioning & Cryptographic Source Fingerprint Cache Invalidation.

- ✅ Phase 1 Frontend RIE Integration & Stabilization:
  - Added `fetchProjectFile` and cache/force options to `client/src/services/projectService.js`.
  - Built zero-dependency syntax & secret token highlighter `client/src/components/project/editor/codeHighlighter.js`.
  - Built read-only source code viewer `client/src/components/project/editor/CodeEditorViewer.jsx` with line numbering, copy action, maximize toggle, jump-to-line pulse highlighting, binary file handling, loading skeletons, and error handling.
  - Upgraded `client/src/components/project/FileTreeExplorer.jsx` with interactive file selection, active path highlighting, and recursive ancestor expansion.
  - Built `client/src/components/project/security/SecurityAuditTab.jsx` with severity counters (Critical/High/Medium/Low), filter pills, search bar, masked secret evidence display, zero-leak guarantees, and click-to-open line navigation.
  - Integrated `SecurityAuditTab` into `client/src/components/project/CapabilityTabPanel.jsx` and workspace tabs.
  - Connected file retrieval, slide-in code viewer drawer, race condition defense (`AbortController` + monotonic active request ref), and forced re-analysis in `client/src/pages/ProjectWorkspace.jsx`.
  - Added honest cache reuse notifications and indeterminate loading states in `client/src/pages/Dashboard.jsx`.

- ✅ Phase 2 Backend: API Intelligence and Code Viewer Foundation:
  - API Route Extractor (`server/src/rie/api/routeExtractor.js`): Static AST & pattern extraction across Express, Fastify, NestJS, FastAPI, Flask, and Django with parameter extraction, constant prefix resolution, and auth classification.
  - Route Record Validation (`server/src/rie/api/routeValidator.js`): Strict validation for path traversal safety, line-range invariants, HTTP methods, and confidence levels.
  - API Request Sequence Diagram Generator (`server/src/rie/api/sequenceGenerator.js`): Static call graph tracing (Client -> Router -> Middleware -> Controller -> Service -> Database -> Response) with safety bounding (`MAX_CALL_DEPTH=4`, `MAX_PARTICIPANTS=10`, `MAX_MESSAGES=25`), line-level citations, and Mermaid output.
  - Route Explorer Controller & Endpoints (`server/src/controllers/apiRoute.controller.js`):
    - `GET /api/projects/:id/api-routes`: List extracted routes with multi-field filtering (`method`, `framework`, `search`, `file`, `auth`) and summary statistics.
    - `GET /api/projects/:id/api-routes/:routeId`: Detailed route metadata with line-level source citations.
    - `GET /api/projects/:id/api-routes/:routeId/sequence`: Static sequence diagram generation with `analysisVersion` cache invalidation.
  - Unified RIE Ingestion Integration (`server/src/rie/pipeline/analysisPipeline.js` & `server/src/controllers/project.controller.js`): Automatic extraction and persistence of API routes during both ZIP upload and GitHub import.
  - Verified with 4 new comprehensive test suites (22 new test assertions, 42/42 total backend test assertions passing).

## In Progress

- Frontend Workspace Diagram Rendering (React Flow Architecture & ERD visualizers).

## Next Up

### Immediate
1. Frontend integration for rendering generated architecture & ERD diagrams in workspace tabs
2. API Sequence & Security Audit module generators

### Phase 2 Frontend — API Explorer, Sequence Viewer & Source Navigation (Completed)
- ✅ API Explorer Workspace Tab (`client/src/constants/workspaceTabs.js`, `client/src/components/project/CapabilityTabPanel.jsx`):
  - Added "API Explorer" tab (`id: "apis"`, icon `⇄`, always enabled).
  - Handles repositories with detected endpoints as well as zero-endpoint codebases gracefully without false server errors.
- ✅ Route Explorer & Summary Bar (`client/src/components/project/api/RouteSummaryBar.jsx`, `RouteFilters.jsx`, `RouteList.jsx`):
  - Summary metrics: total endpoints, breakdown by HTTP method (GET, POST, PUT, PATCH, DELETE), auth-protected count, detected frameworks.
  - Multi-field filtering: debounced search (250ms), HTTP method chips, auth toggle (Protected / Public / All), framework dropdown.
  - Route card catalog: color-coded method badges, parameterized route highlighting (`:id`, `{user_id}`, `<int:id>`), handler & controller names, line-level source citations, auth locks, and active selection state.
- ✅ Route Detail View (`client/src/components/project/api/RouteDetailCard.jsx`):
  - Displays endpoint specifications, HTTP verb, route path, copy-to-clipboard button, controller & handler names, auth protection status, middleware chain, route parameters, schema validation badges, and extraction confidence.
  - Line-level source citation card linking directly to `CodeEditorViewer` with line range display (`L45–L68`).
- ✅ Sequence Diagram Viewer (`client/src/components/project/api/SequenceDiagramViewer.jsx`):
  - Sandboxed Mermaid sequence diagram visualizer (`securityLevel: 'strict'`).
  - Pan and Zoom controls (Zoom In, Zoom Out, Reset, 100% indicator).
  - Static approximation disclaimer banner and traversal safety truncation warnings (`isTruncated: true`).
  - Interactive Step-by-Step Execution Call Flow with line-level source citations and participant source links.
  - Fallback error boundary preventing malformed Mermaid syntax from crashing the application.
- ✅ Source Code Navigation (`client/src/pages/ProjectWorkspace.jsx`, `client/src/components/project/editor/CodeEditorViewer.jsx`):
  - Enhanced `CodeEditorViewer` to support line ranges (`highlightLine` to `highlightEndLine`) with animated pulse indicators and automatic smooth-scroll to startLine.
  - Single centralized source file retrieval endpoint (`GET /api/projects/:id/file?path=<path>`) reused without code duplication.
- ✅ Race Condition Guards & Monotonic State (`client/src/components/project/api/ApiExplorerTab.jsx`):
  - Monotonic request tracking and `AbortController` guards for route list, route details, and sequence diagrams. Rapid route switching prevents stale in-flight requests from overwriting newer user selections.
- ✅ Verification:
  - 10/10 Phase 2 Frontend assertions passed (`client/test-phase2-frontend.js`).
  - 52/52 total test assertions passed across backend and frontend test suites.
  - `npm --prefix client run lint` passed with 0 errors and 0 warnings.
  - `npm --prefix client run build` completed production build in 9.55s.

### ZIP Upload Stabilization & Watcher Fix (Completed)
- ✅ Root Cause Identified:
  - Ephemeral runtime storage was previously inside `server/src/storage/extracted/`, causing Nodemon to detect extracted files and restart mid-upload with `SIGUSR2` (`ERR_CONNECTION_REFUSED`).
  - After moving storage outside `src/`, a runtime identifier mismatch occurred in `server/src/controllers/project.controller.js`: the scoped variable was named `extractedPath`, but line 315 passed `extractionPath` (shorthand for `{ extractionPath: extractionPath }`) into `executeRiePipeline`, throwing `ReferenceError: extractionPath is not defined` as an HTTP 500 error.
- ✅ Resolved:
  - Moved ephemeral runtime storage to `server/storage/` (outside `src/`).
  - Configured `server/nodemon.json` to explicitly ignore `storage/**` and `src/storage/**`.
  - Configured dual-stack listening in `server/src/server.js` so both IPv6 `::1` and IPv4 `127.0.0.1` are supported.
  - Standardized variable naming in `server/src/controllers/project.controller.js` to `extractionPath` across extraction, scanning, pipeline execution, and `finally` cleanup.
  - Added stage-by-stage diagnostic logging (`[UPLOAD] Request received`, `Authentication passed`, `Multipart middleware completed`, `Controller started`, `ZIP extraction started`, `ZIP extraction completed`, `Analysis started`, `Upload pipeline failed`) and global exception handlers.
  - Cleaned up abandoned extraction directories and added `.gitignore` entries.
  - Verified with new automated test suite (`server/test-zip-upload-pipeline.js`) covering isolation, nodemon config, extraction, error states, Zip Slip rejection, and full end-to-end pipeline execution with `extractionPath`. All 8 tests passed.
  - Full regression test run: 60/60 assertions passed across 11 test suites.
  - `npm --prefix client run lint` passed with 0 errors and 0 warnings.
  - `npm --prefix client run build` completed production build in 1.77s.

### Backend Implementation (After Dashboard UI)
1. MongoDB Atlas connection and models setup
2. Multer middleware for file uploads
3. Repository upload API endpoint
4. GitHub API integration service
5. Repository Intelligence Engine (RIE) foundation

## Open Questions

- None at present.

## Architecture Decisions

- Decided to execute noise filtering (removing `node_modules`, `.git`, `dist`, `venv`) in RIE before LLM submission to prevent context window overflow and minimize API usage costs.
- Selected React Flow for service graph and ERD visualizations due to its custom node rendering and Dagre auto-layout capabilities.
- RIE module boundary: `server/src/rie/` re-declares noise filter sets locally (not importing from `server/src/services/`) to keep clean separation between service and RIE layers.
- ZIP upsert key: `(userId, zip.originalName, source='zip')` compound unique index prevents duplicate records; re-upload refreshes metadata.
- Multer errors are intercepted in the router layer (`handleMulterErrors` wrapper) to guarantee JSON error shapes even before the controller runs.
- Project status lifecycle: `uploaded` → `processing` → `completed` | `failed`. The `PATCH /api/projects/:id/status` endpoint drives transitions; `errorDetails` is cleared on non-failed transitions.

## Session Notes

- Frontend dependencies are configured with React 19, Vite 8, Tailwind CSS v4, Framer Motion v13, Lenis, and Clerk React SDK.
- Context specification files (`product-overview.md`, `architecture.md`, `code-standards.md`, `ai-workflow-rules.md`, `progress-tracker.md`) are now synchronized.