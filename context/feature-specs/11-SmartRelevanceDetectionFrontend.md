# ArchMind AI — Smart Relevance Detection Frontend Spec

## Objective

Implement the frontend portion of **Smart Relevance Detection / Capability Matrix** using the `capabilities` data provided directly by the backend API.

The Project Workspace dynamically communicates which analysis modules are relevant to the current repository without performing capability re-detection on the frontend.

---

## Architecture & Configuration

1. **Centralized Workspace Tabs (`client/src/constants/workspaceTabs.js`)**:
   - `topology`: Topology Canvas (Always Enabled)
   - `erd`: ER Diagram (`hasDatabase` / `erd`)
   - `apis`: API Sequences (`hasApis`)
   - `devops`: DevOps & CI/CD (`hasDevops` / `devops`)
   - `security`: Security Audit (`hasSecuritySensitiveCode`)

2. **Project Header (`client/src/components/project/ProjectHeader.jsx`)**:
   - Reads `project.capabilities` and dynamically styles capability tab buttons.
   - Renders technology badges (e.g. `[MongoDB]`, `[Express.js]`, `[Docker]`) or capability status pills (`Relevant`, `Not Available`).
   - Supports horizontal scrolling for responsive layout across screen widths.

3. **Capability Panel & Empty States (`client/src/components/project/CapabilityTabPanel.jsx`)**:
   - **Enabled Capability**: Shows active module card with technology stack pills (`capabilities.details`) and active status glow.
   - **Disabled Capability**: Shows clear, explanatory empty state detailing why the feature is not available for the repository (e.g. *"No database schemas detected in this repository..."*).
   - **Security Terminology**: Strictly uses *"Security-sensitive code detected"* / *"Security Analysis Relevant"* (never claims vulnerability counts).

4. **Loading State**:
   - Displays `"Loading project capabilities..."` while fetching workspace data to avoid flashing false empty states before API response hydration.

---

## Verification & Acceptance Criteria

- **Case 1**: `hasDatabase: true`, `hasApis: true`, `hasDevops: false`, `hasSecuritySensitiveCode: true` -> ERD, APIs, Security enabled; DevOps disabled with explanatory empty state.
- **Case 2**: All capabilities false -> Topology enabled; ERD, APIs, DevOps, Security show clear `[Not Available]` empty states.
- **Case 3**: All capabilities true -> All tabs enabled with technology badges.
- **Build**: `npm run build` completed cleanly without errors.
