# Identifying Project Language

## 1. Overview

ArchMind AI must automatically identify the primary programming language or technology stack of a project after the user provides the project through either:

* ZIP file upload
* GitHub repository URL

The language-identification process must happen as part of the project-analysis pipeline and must **not depend on the user manually selecting the programming language**.

The detected language/stack will later be used by the analysis system to determine how the project should be analyzed and which language-specific analysis strategies should be applied.

---

## 2. Where This Feature Fits in the Architecture

The language-identification process should be placed **after project ingestion/extraction and before the main AI analysis**.

The expected pipeline is:

```text
User
  │
  ├── Upload ZIP
  │
  └── GitHub Repository URL
          │
          ▼
   Project Ingestion
          │
          ▼
   Project Files Available
          │
          ▼
   Project Language Detection
          │
          ▼
   Project Metadata
          │
          ▼
   Codebase Analysis
          │
          ▼
   Report Generation
```

The important point is that language detection should operate on the **actual project files**, not on the ZIP filename, GitHub repository name, or user-provided description.

---

## 3. Input

The language detector should receive the normalized project directory produced by the ingestion layer.

For example:

```text
project/
├── src/
├── package.json
├── README.md
├── requirements.txt
└── ...
```

The detector should be able to inspect:

* File extensions
* Project configuration files
* Dependency/manifest files
* Build configuration
* Framework-specific files
* Directory structure

The detector should avoid analyzing files that do not provide useful language information, such as:

```text
.git/
node_modules/
dist/
build/
coverage/
.cache/
vendor/
```

Large generated or dependency directories should not influence the detected project language.

---

## 4. Detection Strategy

Language detection should use a **multi-signal approach** instead of relying only on file extensions.

### Signal 1 — File Extensions

Scan source files and count occurrences of supported programming-language extensions.

Example:

```text
.js       → JavaScript
.jsx      → JavaScript / React
.ts       → TypeScript
.tsx      → TypeScript / React
.py       → Python
.java     → Java
.go       → Go
.rs       → Rust
.cpp      → C++
.c        → C
.cs       → C#
.php      → PHP
.rb       → Ruby
.kt       → Kotlin
.swift    → Swift
```

File-extension detection should be weighted according to the number of meaningful source files rather than raw file count.

---

### Signal 2 — Project Manifest Files

Check for well-known project manifests and configuration files.

Examples:

```text
package.json
requirements.txt
pyproject.toml
Pipfile
pom.xml
build.gradle
go.mod
Cargo.toml
composer.json
Gemfile
*.csproj
Package.swift
```

These files provide stronger evidence than ordinary source-file extensions.

For example:

```text
package.json
```

strongly indicates a JavaScript/TypeScript ecosystem.

Similarly:

```text
requirements.txt
```

or

```text
pyproject.toml
```

indicates a Python project.

---

### Signal 3 — Framework Detection

The detector should also identify commonly used frameworks where possible.

Examples:

```text
React
Next.js
Vue
Angular
Express
NestJS
Django
Flask
FastAPI
Spring Boot
Laravel
Rails
ASP.NET
```

Framework detection should be based primarily on dependency/configuration evidence.

For example, a `package.json` containing React dependencies can result in:

```json
{
  "language": "JavaScript",
  "framework": "React"
}
```

A TypeScript project using Next.js could result in:

```json
{
  "language": "TypeScript",
  "framework": "Next.js"
}
```

---

## 5. Primary Language vs Technology Stack

Do not treat the project as having only one technology.

A project can contain multiple languages.

For example:

```text
Frontend:
TypeScript + React

Backend:
Python + FastAPI

Database:
PostgreSQL

Configuration:
Docker + YAML
```

The system should therefore distinguish between:

### Primary Language

The dominant programming language used by the project.

### Secondary Languages

Other significant programming languages detected.

### Frameworks

Frameworks detected from dependencies and configuration.

### Supporting Technologies

Technologies such as:

* Docker
* PostgreSQL
* MongoDB
* Redis
* GraphQL
* REST
* Kubernetes

These should not incorrectly be classified as programming languages.

---

## 6. Detection Result

The detector should return structured metadata rather than only a string.

Example:

```json
{
  "primaryLanguage": "TypeScript",
  "secondaryLanguages": [
    "JavaScript"
  ],
  "frameworks": [
    "React",
    "Node.js"
  ],
  "confidence": 0.96
}
```

For a full-stack project:

```json
{
  "primaryLanguage": "TypeScript",
  "secondaryLanguages": [
    "Python"
  ],
  "frameworks": [
    "React",
    "FastAPI"
  ],
  "confidence": 0.91
}
```

The exact schema should remain consistent throughout the backend.

---

## 7. Confidence Calculation

The detector should calculate a confidence value based on the available evidence.

For example:

```text
Extension evidence
        +
Manifest evidence
        +
Dependency evidence
        +
Framework evidence
        ↓
Confidence score
```

Strong evidence should have greater weight than weak evidence.

For example:

```text
package.json
        >
.js files
```

when determining whether a project belongs to the Node.js ecosystem.

The confidence score should help the downstream analysis system determine whether the detected result is reliable.

Do not use an arbitrary confidence value such as `1.0` for every project.

---

## 8. Handling Multiple Languages

The implementation must support polyglot projects.

For example:

```text
frontend/
├── .tsx files

backend/
├── .py files

scripts/
├── .js files
```

The system should not incorrectly report only:

```text
Python
```

because Python happens to have the largest number of files.

Instead, it should preserve the complete technology picture:

```json
{
  "primaryLanguage": "TypeScript",
  "secondaryLanguages": [
    "Python",
    "JavaScript"
  ]
}
```

The primary language should be selected using a combination of:

* Number of source files
* Source-code volume where available
* Project manifests
* Dependency information
* Framework evidence
* Application structure

---

## 9. Special Cases

### Empty or Unsupported Project

If no supported programming language can be confidently detected:

```json
{
  "primaryLanguage": null,
  "secondaryLanguages": [],
  "frameworks": [],
  "confidence": 0
}
```

The system should not invent a language.

---

### Documentation-Only Repository

A repository containing only:

```text
README.md
docs/
*.md
```

should not be classified as a programming-language project.

---

### Configuration-Heavy Project

Files such as:

```text
.yaml
.yml
.json
.xml
.toml
```

should not automatically become the project's primary programming language.

They are supporting configuration formats.

---

### Generated Code

Generated directories such as:

```text
dist/
build/
generated/
coverage/
```

should not dominate the detection result.

---

### Dependencies

Directories such as:

```text
node_modules/
vendor/
.venv/
```

must be excluded from language detection because they represent third-party dependencies rather than the project's own source code.

---

## 10. Backend Implementation

Create the language-detection logic as an independent backend module.

For example:

```text
server/
└── src/
    ├── controllers/
    ├── routes/
    ├── services/
    │   ├── projectAnalyzer/
    │   │   ├── languageDetector.js
    │   │   └── ...
    │   └── ...
    └── ...
```

The exact location should follow the existing backend architecture rather than creating a duplicate or parallel architecture.

The detector should expose a clear interface similar to:

```javascript
detectProjectLanguage(projectPath)
```

and return the structured metadata described above.

The detector should contain **no UI-specific logic**.

---

## 11. Integration With ZIP Upload

After the ZIP file is uploaded:

```text
ZIP Upload
    ↓
Validate ZIP
    ↓
Extract Project
    ↓
Identify Project Root
    ↓
Detect Language / Stack
    ↓
Store Project Metadata
    ↓
Continue Analysis
```

Language detection must happen against the extracted project directory.

It must not analyze the ZIP binary directly.

The existing ZIP upload functionality must remain intact; this feature should integrate with the new ZIP ingestion implementation rather than replacing the upload feature itself.

---

## 12. Integration With GitHub

The GitHub ingestion flow should use the same detector.

```text
GitHub URL
    ↓
Clone / Fetch Repository
    ↓
Identify Project Root
    ↓
Detect Language / Stack
    ↓
Store Project Metadata
    ↓
Continue Analysis
```

The ZIP and GitHub flows should therefore converge into the same analysis pipeline:

```text
             ZIP
              │
              ▼
        Project Files
              ▲
              │
GitHub ───────┘
              │
              ▼
      Language Detector
              │
              ▼
       Project Metadata
              │
              ▼
        AI Analysis
```

This avoids implementing language detection twice.

---

## 13. Persistence

The detected project metadata should be stored with the project analysis record.

Example:

```json
{
  "projectName": "Example Project",
  "primaryLanguage": "TypeScript",
  "secondaryLanguages": [
    "JavaScript"
  ],
  "frameworks": [
    "React",
    "Express"
  ],
  "languageDetectionConfidence": 0.94
}
```

The exact database schema should follow the existing project model.

Do not create a second project record solely for language detection.

---

## 14. Frontend Usage

The frontend should not ask the user to manually select the programming language if the system can detect it.

After analysis begins, the UI can display information such as:

```text
Detected Stack

TypeScript
React
Node.js
```

If detection confidence is low, the UI may display:

```text
Language detection: Low confidence
```

but should not claim a language that the backend could not reliably determine.

The frontend should consume the backend result rather than independently scanning the project.

---

## 15. Error Handling

Language detection must not cause the entire project analysis to fail unnecessarily.

If detection encounters an unsupported file or parsing problem:

```text
Language Detection Error
        ↓
Log Error
        ↓
Return Partial / Unknown Result
        ↓
Continue Analysis
```

Fatal ingestion errors should still stop the pipeline when the project itself cannot be accessed or analyzed.

---

## 16. Security Considerations

The detector must treat uploaded repositories as untrusted input.

It must:

* Never execute source-code files.
* Never execute project scripts.
* Never run package installation commands.
* Never run build commands solely for language detection.
* Avoid following symbolic links outside the extracted project directory.
* Respect upload/extraction limits.
* Ignore dependency directories.
* Avoid reading unnecessary sensitive files.

Language detection should be a **static inspection process**.

---

## 17. Performance Requirements

Language detection should be lightweight because it runs before the main AI analysis.

Prefer:

```text
Directory traversal
+
File metadata
+
Small configuration/manifest reads
```

instead of loading the entire project into memory.

Large source files should not need to be completely loaded just to determine their language.

The implementation should also avoid repeatedly scanning the same project directory.

---

## 18. Testing

The feature should include tests for at least:

### Single-language projects

```text
JavaScript
TypeScript
Python
Java
Go
Rust
C++
C#
PHP
Ruby
```

### Full-stack projects

```text
React + Node.js
React + Python
Next.js + Node.js
Frontend + Backend with different languages
```

### Edge cases

```text
Empty repository
Documentation-only repository
Unknown extensions
Generated code
Large node_modules directory
Multiple languages
Missing manifest
Malformed manifest
```

The tests should verify both:

1. Correct language detection.
2. Correct handling of unsupported/ambiguous projects.

---

## 19. Acceptance Criteria

The implementation is complete when:

* [ ] ZIP-uploaded projects can be analyzed for language automatically.
* [ ] GitHub projects use the same language-detection service.
* [ ] The detector operates on extracted/cloned project files.
* [ ] Dependency and generated directories are ignored.
* [ ] Primary and secondary languages can be identified.
* [ ] Frameworks can be identified where sufficient evidence exists.
* [ ] A confidence value is returned.
* [ ] Unsupported projects return an explicit unknown result.
* [ ] Language detection does not execute project code.
* [ ] Detection failures do not unnecessarily break project analysis.
* [ ] Detection metadata is available to downstream AI analysis.
* [ ] Existing ZIP-upload functionality continues to work.
* [ ] The frontend displays detected technology information using backend results.
* [ ] Automated tests cover normal, polyglot, and edge-case projects.

---

## 20. Important Implementation Principle

The language detector should be treated as a **reusable analysis service**, not as a feature belonging exclusively to the ZIP uploader.

Both ingestion methods must eventually provide a project directory to the same detector:

```text
                 ┌─────────────┐
                 │  ZIP Upload │
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   Project   │
                 │    Files    │
                 └──────┬──────┘
                        │
                        │
                 ┌──────▼──────┐
                 │   Language  │
                 │   Detector  │
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   Project   │
                 │   Metadata  │
                 └──────┬──────┘
                        │
                        ▼
                 ┌─────────────┐
                 │ AI Analysis │
                 └─────────────┘

                 ┌─────────────┐
                 │   GitHub    │
                 └──────┬──────┘
                        │
                        └──────────────► Same Pipeline
```

This separation is important because ArchMind AI is ultimately analyzing **projects**, not ZIP files or GitHub repositories. The ingestion method should only determine how the project enters the system; the analysis pipeline should remain shared.
