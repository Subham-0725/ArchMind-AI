# ArchMind AI

## Overview

ArchMind AI is an AI-powered Repository Intelligence Platform that automatically understands a software project's architecture, codebase, and development workflow. By transforming uploaded `.zip` archives or connected GitHub repositories into an intelligent workspace, it replaces manual file-by-file exploration with automated visualizations, security audits, living documentation, and deployable infrastructure resources. It is built for developers, software architects, open-source contributors, and teams who want to learn, onboard, and build faster.

## Goals

1. Eliminate manual repository onboarding time by generating an interactive system topology and database ER diagram within seconds of ingestion.
2. Provide grounded, context-aware AI answers with file and line-number citations to prevent generic LLM hallucinations.
3. Automate infrastructure and pipeline boilerplate by synthesizing validated Dockerfiles, GitHub Actions workflows, and Kubernetes manifests directly from detected project stacks.

## Core User Flow

1. User registers or logs in via Clerk authentication.
2. User uploads a `.zip` repository archive or provides a GitHub repository URL.
3. The Repository Intelligence Engine (RIE) extracts, scans, and parses the project's structure, files, dependencies, and schemas.
4. RIE compiles a unified Repository Blueprint context payload.
5. System renders the interactive Dashboard featuring dynamic system topology, database ER diagrams, Abstract Syntax Tree(AST) code reviews, security audits, and generated DevOps manifests.
6. User interacts with the codebase via repository-aware AI chat, or exports analysis reports and visual diagrams.

## Features

### Ingestion & Intelligence Engine (RIE)

- Dual ingestion via `.zip` archive upload (Multer) or GitHub REST API integration.
- Noise filtering (`node_modules`, `.git`, `dist`, `venv`) and secret scanning.
- Automatic language, framework, database, and dependency detection (`package.json`, `requirements.txt`).
- Repository Blueprint creation for structured LLM context grounding.

### Architecture & Visualizations

- Interactive system architecture visualization powered by React Flow and Gemini/Groq APIs.
- Automated Database ER Diagram generation from ORM schemas and models.
- Sequence diagram and API route structure generation.

### Code Quality & Security Audits

- Automated AST security audit to detect leaks, vulnerabilities, and anti-patterns.
- Code review with performance bottleneck detection and refactoring suggestions.
- Unit and API test case generation.

### DevOps & Infrastructure Automation

- Automated Dockerfile generation tailored to detected runtimes.
- Automated CI/CD pipeline generation (GitHub Actions workflows).
- Kubernetes manifest (YAML) synthesis.

### Developer Workspace & Tools

- Context-grounded repository AI chat with conversation history stored in MongoDB Atlas.
- Embedded Monaco Code Editor for viewing source files and generated manifests.
- PDF report export capability using `jsPDF`.

## Scope

### In Scope

- Web dashboard supporting Clerk authentication and multi-project management.
- ZIP and GitHub public/private repository ingestion pipelines.
- Repository Intelligence Engine (RIE) scanning, technology detection, and blueprint aggregation.
- Interactive React Flow topology graphs and ER diagrams.
- Gemini / Groq API orchestration for security reviews, API docs, and DevOps manifests.
- Repository-grounded chat drawer and PDF exports.

### Out of Scope

- Multi-user live collaborative editing inside Monaco editor (Google Docs style real-time cursor syncing).
- Direct automated PR creation/committing back into GitHub repositories (Phase 1–5 focus is on analysis and artifact generation).
- Local IDE extension plugins (e.g., VS Code extension — dashboard is web-native).

## Success Criteria

1. A registered user can successfully upload a `.zip` file or enter a valid GitHub URL and view an extracted file tree within 10 seconds.
2. The Repository Intelligence Engine accurately detects core languages, frameworks, and database dependencies from manifest files.
3. The platform renders zoomable, interactive React Flow nodes for service architecture and database ER diagrams without UI crashing.
4. Generated Dockerfiles and GitHub Actions YAML manifests pass syntax validation checks.
5. AI Chat responses reliably provide correct source code file path citations when queried about repository logic.