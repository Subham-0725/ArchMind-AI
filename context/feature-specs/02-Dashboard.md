# Dashboard UI Specification

## Overview

Design the Dashboard page for ArchMind AI. The Dashboard is where users submit their project for analysis.

For now, implement **only the UI and navigation**. The actual project analysis functionality will be added later.

## Navigation Flow

**Landing Page → Login / Sign Up → Dashboard**

After successful authentication, the user should be redirected to:

`/dashboard`

## Dashboard

**File:**
`client/src/pages/Dashboard.jsx`

### UI Requirements

The Dashboard should provide two clear ways to submit a project:

#### 1. Upload Project ZIP

Create a prominent drag-and-drop upload area where users can:

* Drag and drop their project `.zip` file.
* Click the upload area to browse and select a ZIP file.
* Show a simple visual state when a file has been selected.

The upload area should clearly communicate that **ZIP files are supported**.

#### 2. GitHub Project URL

Provide a separate input section where users can:

* Paste their GitHub repository/project URL.
* Submit the URL for analysis.

The two options should be visually separated so users can immediately understand that they can choose **either ZIP upload or GitHub URL**.

### Analyze Button

Include a primary **Analyze Project** button below the input options.

For this stage, the button only needs to be part of the UI. It does not need to perform the actual analysis.

### General Layout

The Dashboard should have:

* ArchMind AI branding/header.
* A clear heading and short description explaining that users can submit their project for analysis.
* ZIP drag-and-drop/upload section.
* GitHub URL input section.
* Analyze Project button.
* Clean spacing and responsive layout.
* Appropriate hover, focus, upload, and selected-file states.

### Theme and Styling

Use the existing theme files located in the **`themes` folder** when building the Dashboard UI.

Follow the existing:

* Colors
* Typography
* Spacing
* Borders
* Components
* Visual style

Do not introduce a separate design system or unrelated styling.

## Scope

For this stage:

* Build the Dashboard UI only.
* Implement navigation from Login / Sign Up to Dashboard.
* Support the UI for ZIP upload and drag-and-drop.
* Support the UI for entering a GitHub project URL.
* Do not implement GitHub repository fetching.
* Do not implement ZIP processing.
* Do not implement AI analysis or report generation.
