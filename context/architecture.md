# Architecture Context

## Stack

| Category | Purpose | Technology / Package |
| --- | --- | --- |
| Frontend Language | Build frontend | JavaScript / JSX |
| Frontend Framework | Build UI | React 19 |
| Build Tool | Development & production builds | Vite 8 |
| CSS | Styling | Tailwind CSS 4 |
| Tailwind Integration | Integrate Tailwind with Vite | `@tailwindcss/vite` |
| Authentication | Login & Signup | Clerk + `@clerk/clerk-react` |
| Routing | Page navigation | React Router DOM 7 |
| Animations | UI animations | Framer Motion |
| Smooth Scrolling | Smooth page scrolling | Lenis |
| Backend Language | Server-side development | JavaScript |
| Backend Runtime | Run server | Node.js |
| Backend Framework | REST API | Express.js |
| Database | Store users, projects, analysis, chat, reports | MongoDB Atlas |
| Database Package | MongoDB interaction | Mongoose |
| Repository Upload | Upload ZIP files | Multer |
| ZIP Extraction | Extract repositories | `adm-zip` |
| GitHub Repository Import | Import repositories | GitHub REST API |
| Repository Scanner | Read files & folders | Node.js `fs` + `path` |
| Technology Detection | Detect languages/frameworks/dependencies | Custom JavaScript + package/config file parsers |
| Code Parsing | Understand source-code structure | Tree-sitter |
| AI | Repository analysis, review, generation, chat | Gemini API/Groq API |
| Architecture Diagram | Interactive architecture visualization | React Flow |
| ER Diagram | Database relationship visualization | React Flow |
| Sequence Diagram | Visualize request/service flow | React Flow |
| Documentation Rendering | Render generated Markdown | `react-markdown` |
| AI Code Review | Analyze code | Gemini API/Groq API + Tree-sitter |
| Security Audit | Find security issues | `npm audit` + custom checks |
| Performance Analysis | Find potential performance issues | Custom JavaScript analysis + Gemini/Groq API |
| Refactoring Suggestions | Suggest improvements | Gemini API/Groq API |
| Dockerfile Generator | Generate Dockerfiles | Gemini API/Groq API |
| CI/CD Generator | Generate GitHub Actions | Gemini API/Groq API |
| Kubernetes Generator | Generate Kubernetes YAML | Gemini API/Groq API |
| Test Generator | Generate tests | Gemini API/Groq API |
| Repository AI Chat | Ask questions about repository | Gemini API/Groq API + repository context |
| Code Viewer | Display source code | Monaco Editor |
| Charts | Dashboard statistics | Recharts |
| Frontend API Calls | Frontend ↔ Backend communication | Axios |
| PDF Report | Export reports | `jsPDF` |
| Environment Variables | Manage API keys/configuration | `dotenv` |
| Linting | Find JavaScript/React issues | ESLint |
| Frontend Testing | Test React application | Vitest |
| End-to-End Testing | Test complete user flows | Playwright |

## System Boundaries

- `client/src/components/` — Owns reusable UI primitives, layout shells, React Flow visualizers, Monaco code views, and repository chat widgets.
- `client/src/pages/` — Owns top-level route views (Landing, Dashboard, Repository, Architecture, Documentation, CodeReview, AIChat, Settings).
- `server/src/models/` — Owns Mongoose database schemas (`Project`, `Architecture`, `DevOpsManifest`, `Analysis`, `ChatHistory`) defining domain persistence.
- `server/src/rie/` — Owns the **Repository Intelligence Engine**: ZIP/Git extractors, file tree scanners, noise filters, secret detectors, AST parsers, and structured LLM prompt context builders.
- `server/src/storage/` — Owns ephemeral server workspace directories (`uploads/`, `extracted/`, `generated/`) for staging files during ingestion and analysis.

## Storage Model

- **Database (MongoDB Atlas)**: Stores user account references, repository metadata, structured project blueprints, node-edge graph coordinates for React Flow, security audit results, DevOps manifests, and threaded AI chat logs.
- **Blob / Ephemeral Disk Storage (`server/src/storage/`)**: Temporarily holds raw incoming `.zip` files, unzipped codebase directory trees during AST parsing, and staged generated exports (PDFs, YAML files) prior to delivery.

## Auth and Access Model

- Every user registers and authenticates via Clerk SDK (`@clerk/clerk-react`) on the client side, passing a Clerk JWT in the `Authorization: Bearer <token>` header on backend API requests.
- Backend routes are guarded by the Clerk authentication middleware (`auth.middleware.js`), which verifies incoming JWTs before executing controller logic.
- Every project blueprint, architecture topology, and chat history document is bound to a specific `userId` (Clerk User ID) in MongoDB to ensure strict multi-tenant isolation.

## Invariants

1. The Repository Intelligence Engine (RIE) must deterministically parse, scan, and filter code noise (`node_modules`, `.git`, `.env`) **before** sending context payloads to the Gemini API/Groq API .
2. LLM response payloads for architecture topologies and code audits must conform strictly to JSON schemas so the frontend can parse React Flow nodes and Monaco editor manifests without crashing.
3. Raw uploaded `.zip` archives and extracted temporary source files inside `server/src/storage/` must be sandboxed and cleaned up to prevent server disk pollution.
4. AI Chat responses must anchor assertions with direct repository file paths and line number citations whenever answering questions about codebase logic.