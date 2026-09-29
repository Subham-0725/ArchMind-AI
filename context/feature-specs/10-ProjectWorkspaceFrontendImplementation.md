# Project Workspace Frontend Implementation

## 1. Overview

This feature specification defines the **frontend workspace implementation** for ArchMind AI.

The workspace is rendered at route `/project/:id` and provides an interactive IDE-like environment. It consumes the backend Workspace API contract (`GET /api/projects/:id`) to display:
* Project overview metrics & file statistics
* Multi-signal language detection confidence ratings
* Categorized technology stack breakdown
* Nested file tree explorer with real-time search filtering
* Interactive System Topology canvas powered by React Flow & Dagre
* Feature capability-aware workspace tabs (`Architecture`, `ER Diagram`, `Code Review`, `DevOps`)

---

## 2. UI Layout Architecture

The Workspace uses a responsive split layout (30% Sidebar / 70% Canvas):

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ProjectHeader (Title, Source Badge, Status Pill, Workspace Feature Tabs)    │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Left Sidebar (~30% Desktop)          │ Right Main Canvas (~70% Desktop)     │
│                                      │                                      │
│  ├── ProjectOverviewCard             │  ├── Architecture Tab                │
│  │   (Files, Dirs, Size, Languages)  │  │   └── TopologyCanvas (React Flow) │
│  │                                   │  │                                   │
│  ├── TechStackCard                   │  ├── ER Diagram Tab (Capability)     │
│  │   (Frameworks, DBs, DevOps)       │  │                                   │
│  │                                   │  ├── Code Review Tab                 │
│  └── FileTreeExplorer                │  │                                   │
│      (Collapsible tree + Search)     │  └── DevOps Tab                      │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 3. Routing & Navigation Rules

1. **Route Declaration** (`AppRoutes.jsx`):
   ```jsx
   <Route
     path="/project/:id"
     element={
       <PrivateRoute>
         <ProjectWorkspace />
       </PrivateRoute>
     }
   />
   ```

2. **Ingestion Redirection** (`Dashboard.jsx`):
   * Successful ZIP Upload $\rightarrow$ `navigate('/project/' + project.id)`
   * Successful GitHub Import $\rightarrow$ `navigate('/project/' + project.id)`
   * Clicking a card in `RecentProjects` $\rightarrow$ `navigate('/project/' + project.id)`

---

## 4. Dependencies & Graph Rendering Stack

* **`@xyflow/react` (`^12.1.2`)**: Handles canvas zoom, pan, node selection, edge rendering, background grid, and minimap.
* **`dagre` (`^0.8.5`)**: Calculates 2D node coordinates (`x`, `y`) in memory to ensure nodes do not overlap. Default orientation is Left-to-Right (`LR`).

### Service Node Contract (`ServiceNode.jsx`)

Custom React Flow node registered as `nodeTypes = { customService: ServiceNode }`:

```json
{
  "id": "backend",
  "type": "customService",
  "position": { "x": 250, "y": 300 },
  "data": {
    "label": "Express.js API",
    "technology": "Node.js / Express.js",
    "tier": "Backend"
  }
}
```

#### Tier Visual Badges & Glow Tokens

* **`Frontend`**: Cyan glow (`border-cyan-500/40 bg-[#091526]/90 text-cyan-300`)
* **`Backend`**: Indigo glow (`border-indigo-500/40 bg-[#10102b]/90 text-indigo-300`)
* **`Database`**: Emerald glow (`border-emerald-500/40 bg-[#081a17]/90 text-emerald-300`)
* **`DevOps`**: Amber glow (`border-amber-500/40 bg-[#1c1407]/90 text-amber-300`)

---

## 5. Component Structure & Responsibilities

### 1. `ProjectWorkspace.jsx`
Main page component. Fetches data via `fetchProjectById(token, id)`, manages active feature tab state, renders loading spinner during hydration, and shows error/retry card on failure.

### 2. `ProjectHeader.jsx`
Sticky header displaying:
* Back-to-dashboard navigation button (`← Dashboard`)
* Project display name & GitHub/ZIP source badge
* Processing status pill (`uploaded`, `completed`)
* Workspace feature tabs bar (`Architecture`, `ER Diagram`, `Code Review`, `DevOps`)

### 3. `ProjectOverviewCard.jsx`
Displays:
* File count, directory count, formatted total size
* Primary language badge & secondary language tags
* Language detection confidence percentage
* Top extension distribution tags

### 4. `TechStackCard.jsx`
Categorized tech stack display:
* Frameworks & Libraries
* Databases & ORMs
* DevOps & Infrastructure
* Programming Languages

### 5. `FileTreeExplorer.jsx`
Nested collapsible directory tree:
* Converts flat RIE tree items (`[{ path: "src/App.jsx", type: "file" }]`) into a nested tree object via `buildNestedTree()`
* Real-time search input for filtering files and folders
* Expand/collapse folder toggles
* File size badges

### 6. `TopologyCanvas.jsx`
React Flow canvas component:
* Integrates Dagre auto-layout algorithm (`topologyUtils.js`)
* Renders custom `ServiceNode` instances
* Interactive controls: Fit View, Zoom (+/-), Orientation toggle (`Horizontal` / `Vertical`), MiniMap, and dot grid background

---

## 6. Capability-Aware Feature Tabs

The right canvas panel displays content dynamically based on backend `capabilities`:

* **`Architecture`**: Always active; renders `TopologyCanvas`.
* **`ER Diagram`**: If `capabilities.erd` is `true`, surfaces database readiness & schema metadata; if `false`, renders *"No database schema detected"*.
* **`Code Review`**: Placeholder card for future automated security audit & code quality phase.
* **`DevOps`**: If `capabilities.devops` is `true`, surfaces container/CI pipeline metadata; if `false`, renders *"No DevOps configuration detected"*.

---

## 7. Quality & Verification Invariants

1. **Production Build Verified**: Passed `npm run build` in `client/` with 0 compilation errors.
2. **Zero Client-Side Inference**: Reads all stack and topology data directly from the backend API response without client-side guessing.
3. **No Breaking Changes**: Existing auth guards (`PrivateRoute`, `PublicOnlyRoute`) and Dashboard cards remain 100% operational.
