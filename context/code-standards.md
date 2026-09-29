# Code Standards

## General

- Keep modules small, focused, and single-purpose across both client (`client/src/`) and server (`server/src/`) directories.
- Write declarative, readable code that clearly expresses intent rather than clever one-liners.
- Favor composition over inheritance; build complex behaviors from small, reusable functions.
- Fix root causes rather than layering workarounds—address issues at their source.
- Separate concerns: keep business logic, UI rendering, and data fetching in distinct modules.

## JavaScript & ES Modules

- Use modern ES module syntax (`import`/`export`) consistently throughout both frontend and backend codebases.
- Always use `type: "module"` in `package.json` for ES modules (already configured in both client and server).
- Declare variables with `const` by default; use `let` only when reassignment is necessary. Avoid `var`.
- Use destructuring for cleaner code: `const { name, email } = user` instead of multiple assignments.
- Leverage modern JavaScript features: optional chaining (`?.`), nullish coalescing (`??`), template literals, and async/await.
- Validate and sanitize all external input (user uploads, GitHub URLs, request bodies) at system boundaries before processing.

## React 19 & Vite 8

### Component Architecture

- Keep components **small and focused**—each should have a single responsibility.
- Use **functional components** with hooks exclusively (no class components).
- Group components by feature in `components/LandingPage/`, `components/layout/`, etc.
- Export components as default exports for pages and named exports for reusable components.
- Use `React.memo()` for expensive render optimizations, but only when profiling shows a need.

### Component Structure

```jsx
// 1. Imports
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// 2. Component definition
export default function ComponentName({ prop1, prop2 }) {
  // 3. Hooks (state, effects, context)
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // side effects
  }, [dependencies]);

  // 4. Event handlers
  const handleClick = () => {
    // logic
  };

  // 5. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### State Management

- Use local state (`useState`) for component-specific data.
- Use Context API (`client/src/context/`) for shared state across multiple components.
- Delegate complex async operations to custom hooks in `hooks/`.
- Keep `pages/` components thin—they should orchestrate, not implement logic.

### Data Fetching

- Isolate all API calls in dedicated service modules (`services/`).
- Never place HTTP requests directly in components—always use services.
- Handle loading, error, and success states consistently across all data-fetching flows.

## Styling

### Tailwind CSS v4

- Use **Tailwind utility classes** exclusively for styling—avoid inline style objects.
- Reference theme values from `client/src/themes/colors.js` and `client/src/themes/fonts.js` for consistency.
- Follow the established dark-mode design system documented in `context/ui-context.md`:
  - **Backgrounds**: `#04060b`, `#070c16`, `#090e1b` (layered depth)
  - **Accents**: Cyan (`#06b6d4`), Blue (`#3b82f6`), Indigo (`#6366f1`)
  - **Text**: white, slate-100–600 for hierarchy
  - **Borders**: `border-white/5`, `border-white/10`, `border-cyan-500/30`
- Use established utility classes:
  - `.archmind-glass` — glassmorphic surfaces with backdrop blur
  - `.archmind-gradient-text` — animated gradient text
  - `.archmind-hover` — performance-safe hover transforms

### Animations

- Use **Framer Motion** for interactive animations (hover, tap, scroll reveals).
- Use **CSS animations** (defined in `index.css`) for ambient effects: `.animate-aurora-*`, `.animate-shimmer`, `.animate-pulse-ring`.
- Always respect `prefers-reduced-motion` using `useReducedMotion()` from Framer Motion.
- Animate only `transform` and `opacity` for optimal performance—avoid animating layout properties.
- Use the established easing curve: `[0.16, 1, 0.3, 1]` for consistent motion feel.

### Responsive Design

- Design **mobile-first**, then add breakpoints: `sm:`, `md:`, `lg:`, `xl:`.
- Test all components at mobile (375px), tablet (768px), and desktop (1440px) widths.
- Use Tailwind's responsive utilities: `hidden md:flex`, `text-sm md:text-base`.

## API Routes & Controllers (Express 5)

### Request Handling

- Validate request params, query strings, and body payloads **before** executing business logic.
- Use middleware for cross-cutting concerns: authentication, logging, error handling.
- Return consistent JSON response shapes:
  ```javascript
  // Success
  { success: true, data: {...} }
  
  // Error
  { success: false, error: "Error message" }
  ```

### Authentication

- Use **Clerk JWT middleware** (`middleware/auth.middleware.js`) on all protected routes.
- Access authenticated user via `req.auth.userId` after middleware validation.
- Never trust client-provided user IDs—always use server-verified authentication.

### Error Handling

- Use try-catch blocks in all async route handlers.
- Return appropriate HTTP status codes:
  - `200` OK
  - `201` Created
  - `400` Bad Request
  - `401` Unauthorized
  - `404` Not Found
  - `500` Internal Server Error
- Log errors server-side but return safe, user-friendly messages to clients.

## Data and Storage

### Database (MongoDB + Mongoose)

- Define all schemas in `server/src/models/` with proper validation and indexes.
- Use Mongoose virtuals, methods, and statics for business logic tied to models.
- Always validate data before saving to the database.
- Use `.lean()` for read-only queries that don't need Mongoose document methods.
- Store structured data only:
  - User profiles and authentication references
  - Project metadata and configurations
  - Analysis results and AI chat histories
  - Generated architecture diagrams (as JSON node/edge data)

### File Storage

- **Never store large files or binary data in MongoDB**—use file system or object storage.
- Temporary uploads, extracted archives, and generated exports belong in ephemeral server directories.
- Clean up temporary files after processing to prevent disk bloat.

## Code Quality

### Naming Conventions

- **Variables/Functions**: camelCase (`getUserData`, `isLoading`)
- **Components**: PascalCase (`HeroSection`, `NavBar`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_FILE_SIZE`)
- **Files**: Match the default export name (`HeroSection.jsx`, `userService.js`)
- Use descriptive names that reveal intent—avoid abbreviations unless universally understood.

### Comments

- Write **self-documenting code** that doesn't need comments to be understood.
- Use comments to explain **why**, not **what**:
  ```javascript
  // ❌ Bad: Increment counter
  counter++;
  
  // ✅ Good: Cache miss requires refetch after 5 minutes
  if (Date.now() - lastFetch > 300000) {
    refetch();
  }
  ```
- Add JSDoc comments for exported functions in services and utilities:
  ```javascript
  /**
   * Fetch repository metadata from GitHub API
   * @param {string} repoUrl - Full GitHub repository URL
   * @returns {Promise<Object>} Repository metadata
   */
  export const fetchRepoMetadata = async (repoUrl) => {...}
  ```

### Error Handling

- Use try-catch for all async operations.
- Provide context in error messages: what failed and why.
- Log errors with sufficient detail for debugging (timestamps, user IDs, request data).
- Never expose internal implementation details or stack traces to end users.

### Testing Mindset

- Write code that's easy to test: pure functions, clear inputs/outputs, minimal side effects.
- Keep functions small—if it's hard to name, it's doing too much.
- Avoid tight coupling—components and functions should work independently.

## File Organization

### Frontend

- `client/src/components/` — UI building blocks (common buttons/modals, layout shells, graph visualizers, code viewers, and chat widgets).
- `client/src/pages/` — Main view routes (Landing, Dashboard, Repository, Architecture, Documentation, CodeReview, AIChat, Settings).
- `client/src/context/` — Global state providers (Authentication/Clerk, Active Repository, Theme).
- `client/src/hooks/` — Custom React hooks (analysis triggers, repository fetching, chat actions, and file exports).
- `client/src/services/` — Axios API client calls connected to backend endpoints.
- `client/src/routes/` — App routing configurations and protected route guards.
- `client/src/utils/` — Helper functions, graph layout algorithms (Dagre/ELK), and storage utilities.
- `client/src/themes/` — Constant color and font codes
- `client/src/constants/` — API endpoint URLs, configuration maps, and static icons.
- `client/src/assets/` — Static images, illustrations, and technology SVG icons.

### Backend
- `server/src/config/` — Third-party configurations (MongoDB connection, Clerk SDK, Gemini/Groq LLM client, Multer).
- `server/src/middleware/` — Request interceptors (Clerk authentication guards, upload handlers, and global error handlers).
- `server/src/models/` — Mongoose database schemas (Users, Projects, Architectures, Audits, Chat History, DevOps Manifests).
- `server/src/controllers/` — Request/response orchestrators for each major feature.
- `server/src/routes/` — Express route definitions and endpoint mapping.
- `server/src/rie/` — Core Repository Intelligence Engine (extractors, scanners, parsers, context blueprint aggregators, and structured LLM prompt templates).
- `server/src/services/` — Business logic handlers (AI orchestration, GitHub API, PDF/Mermaid export services).
- `server/src/storage/` — Ephemeral server workspace directories (`uploads/`, `extracted/`, `generated/`).
- `server/src/utils/` — File helpers, markdown/JSON sanitizers, and server loggers.