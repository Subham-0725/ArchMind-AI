# AI Workflow Rules

## Approach

Build ArchMind AI incrementally using a spec-driven, context-grounded workflow. Context files (`project-overview.md`, `architecture.md`, `code-standards.md`, and `ui-context.md`) define what to build, how to build it, and the design system. Always implement features strictly against these specs — do not infer, invent, or guess behavior from scratch.

---

## Scoping Rules

- Work on one feature unit at a time (e.g., repository upload/extraction, React Flow architecture visualizations, Clerk auth integration, or Gemini/Groq API orchestration).
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step (e.g., modifying `client/src/components/` while editing `server/src/controllers/` or `server/src/services/`).

---

## When to Split Work

Split an implementation step if it combines:

- UI components (`client/src/components/`, `client/src/pages/`) and backend processing (`server/src/controllers/`, `server/src/services/`, or `server/src/rie/`).
- Multiple unrelated Express API routes (e.g., updating repository upload endpoints alongside AI chat endpoints).
- Frontend visualization logic (React Flow diagrams, Monaco Editor integration) with backend LLM orchestration.
- Behavior not clearly defined or specified in the active context files.

If a change cannot be manually or programmatically verified end-to-end within 5 minutes, the scope is too broad — split it immediately.

---

## Handling Missing Requirements

- Do not invent product features, API schemas, or UI behavior not explicitly defined in the context files.
- If a requirement is ambiguous, resolve and clarify it in the relevant context file (`project-overview.md`, `architecture.md`, or `ui-context.md`) before writing code.
- If a requirement is missing entirely, ask the user for clarification before continuing implementation.

---

## Protected Files

Do not modify the following files or directories unless explicitly instructed:

- `client/src/components/LandingPage/` — Custom-crafted landing page sections (`HeroSection.jsx`, `FeaturesSection.jsx`, `WorkflowSection.jsx`, `CtaSection.jsx`, `Footer.jsx`).
- `client/src/themes/` — Consolidated color and font tokens.
- `node_modules/` and third-party library internals (e.g., React Flow, Monaco Editor, Clerk SDK, Framer Motion).
- Root workspace configurations (`package.json`, `.gitignore`, `README.md`).

---

## Keeping Docs in Sync

Update the relevant context file whenever implementation decisions modify:

- System architecture, folder structures, or boundary responsibilities (`architecture.md`).
- Storage models, database schema updates, or authentication flows (`architecture.md`).
- Code conventions, package additions, styling patterns, or animation guidelines (`code-standards.md`).
- UI design tokens, component patterns, or visual system rules (`ui-context.md`).
- Product features, user flows, or success criteria (`project-overview.md`).

---

## Before Moving to the Next Unit

1. The current unit functions correctly end-to-end within its defined scope.
2. No invariant defined in `architecture.md` was violated (e.g., RIE filters noise before LLM calls, Clerk `userId` multi-tenant isolation is intact).
3. All relevant context files (`architecture.md`, `code-standards.md`, `ui-context.md`, `project-overview.md`) accurately reflect the completed work.
4. `npm run dev` or `npm run build` checks pass without unhandled errors or broken imports in both `client/` and `server/` workspaces.

---

## Current Project State

### Completed Components
- Landing page with hero, features, workflow, CTA sections, and footer
- Navbar with routing and layout structure
- Dashboard page structure
- Clerk authentication integration (frontend setup)
- Tailwind CSS v4 with custom theme tokens
- Framer Motion animations and Lenis smooth scrolling

### Server Foundation
- Express.js server setup (`server.js`, `app.js`)
- Folder structure: `config/`, `controllers/`, `middleware/`, `models/`, `services/`, `utils/`
- MongoDB configuration foundation

### Next Priority Areas
1. **Repository Intelligence Engine (RIE)**: `server/src/rie/` directory needs to be created with:
   - ZIP extractor (using `adm-zip`)
   - GitHub API integration
   - File tree scanner (Node.js `fs` + `path`)
   - Noise filter (exclude `node_modules/`, `.git/`, etc.)
   - Technology detection engine
   - Repository Blueprint aggregator

2. **Backend Routes & Controllers**:
   - Repository upload endpoint (Multer middleware)
   - GitHub import endpoint
   - Analysis orchestration endpoints

3. **Database Models** (`server/src/models/`):
   - User/Project schema
   - Architecture topology schema
   - Analysis results schema
   - Chat history schema
   - DevOps manifest schema

4. **AI Integration** (`server/src/services/`):
   - Gemini/Groq API client setup
   - Architecture diagram generation service
   - Code review service
   - DevOps manifest generation service

5. **Frontend Features**:
   - Repository upload UI
   - React Flow architecture visualizer
  - AI chat interface
   - Dashboard data display
   <!-- - Monaco Editor code viewer -->
