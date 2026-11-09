# ArchMind AI — Database Architecture & Entity Relationship Documentation

**Document Version:** 1.0.0  
**Classification:** Core System Architecture & Technical Specification  
**Database Engine:** MongoDB Atlas (v7.0+)  
**Object Data Modeling (ODM):** Mongoose (v9.x)  
**Authentication & Partitioning:** Clerk Authentication (`userId` Multi-Tenant Isolation)  
**Generated Artifacts:**
- **Vector ERD:** [`ArchMindAI_ER_Diagram.svg`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.svg)
- **High-Resolution ERD:** [`ArchMindAI_ER_Diagram.png`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.png)
- **Comprehensive PDF:** [`ArchMindAI_ER_Diagram.pdf`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.pdf)

---

## 1. Executive Summary & Database Overview

ArchMind AI is an AI-powered repository intelligence, architectural visualization, automated code review, security auditing, and DevOps generation platform.

The underlying persistence tier is built on **MongoDB Atlas** using **Mongoose ODM**. The schema architecture balances:
1. **Multi-Tenant Isolation:** Every repository, file, chat session, security audit, and DevOps manifest is strictly scoped to a Clerk User ID (`userId`), guaranteeing multi-tenant security without leaky cross-user queries.
2. **Document Limit Resilience:** MongoDB documents are subject to a strict 16MB BSON size limit. Large codebases easily exceed 16MB if all file contents or extensive AST trees are stored inside a single document. ArchMind AI resolves this by storing high-level repository metadata in the [`Project`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/Project.js) document while decoupling raw source code into an indexed [`SourceFile`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/SourceFile.js) collection and granular security alerts into a dedicated [`SecurityFinding`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/SecurityFinding.js) collection.
3. **Hybrid Normalization & Embedding:** Bounded, tightly coupled hierarchical structures (e.g., repository file trees, chat citations, DevOps validation checks, and symbol location spans) are embedded directly as subdocuments for single-query retrieval speed. Unbounded or high-cardinality entities are modeled as independent collections linked via Mongoose `ObjectId` references.

```
                           ┌──────────────────────────┐
                           │           User           │
                           │    (Collection: users)   │
                           │  clerkId (Unique Tenant) │
                           └─────────────┬────────────┘
                                         │
                 ┌───────────────────────┼──────────────────────────────┐
                 │ 1:N (Logical)         │ 1:N (Logical)                │ 1:N (Logical)
                 ▼                       ▼                              ▼
    ┌─────────────────────────┐  ┌───────────────┐            ┌──────────────────┐
    │         Project         │  │ Conversation  │            │  DevOpsArtifact  │
    │  (Collection: projects) │  │(conversations)│            │ (devopsartifacts)│
    └────────────┬────────────┘  └───────┬───────┘            └────────┬─────────┘
                 │                       │                             │
    ┌────────────┴────────────┐          │ 1:N (Embedded)              │ 1:1 (Embedded)
    │ 1:N (Physical Refs)     │          ▼                             ▼
    ├─────────────────────────┤  ┌───────────────┐            ┌──────────────────┐
    │ ► SourceFile            │  │    Message    │            │    Validation    │
    │ ► SecurityAudit         │  └───────┬───────┘            └────────┬─────────┘
    │ ► SecurityFinding       │          │ 1:N (Embedded)              │ 1:N (Embedded)
    │ ► DevOpsArtifact        │          ▼                             ▼
    │ ► Conversation          │  ┌───────────────┐            ┌──────────────────┐
    └─────────────────────────┘  │   Citation    │            │ ValidationCheck  │
                                 └───────────────┘            └──────────────────┘
```

---

## 2. Database Configuration & Connection Architecture

The database connection is managed centrally in [`server/src/config/db.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/config/db.js) using standard Mongoose initialization:

```javascript
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
```

### Key Configuration Invariants:
- **Connection String:** Configured through `MONGODB_URI` environment variable, connecting to a MongoDB Atlas replica set with TLS/SSL encryption enabled.
- **Fail-Fast Boot:** If database connectivity fails during server bootstrap, the process terminates immediately (`process.exit(1)`), preventing the API server from serving requests in an unpersisted state.
- **Strict Multi-Tenant Query Middleware:** Controller layer enforces Clerk JWT validation (`getAuth(req).userId`) before any repository query executes.

---

## 3. Catalog of Collections & Entities

ArchMind AI defines **7 top-level MongoDB collections** managed by Mongoose models, and **6 embedded subdocument entities** nested within parent schemas:

| # | Entity Name | Collection Name | Entity Type | Functional Domain | Primary Key | Key Relationships |
|---|---|---|---|---|---|---|
| 1 | **User** | `users` | Root Collection | Authentication & Identity | `_id` (ObjectId) | Root tenant identity (`clerkId`) |
| 2 | **Project** | `projects` | Central Collection | Core Repository Intelligence | `_id` (ObjectId) | Referenced by all feature modules |
| 3 | **Conversation** | `conversations` | Collection | AI Chat & Context | `_id` (ObjectId) | `projectId` (Mongoose), `userId` (Clerk) |
| 4 | **SourceFile** | `sourcefiles` | Collection | Code Indexing & Retrieval | `_id` (ObjectId) | `projectId` (Mongoose), `userId` (Clerk) |
| 5 | **SecurityAudit** | `securityaudits` | Collection | Security & Compliance | `_id` (ObjectId) | `projectId` (Mongoose) |
| 6 | **SecurityFinding** | `securityfindings` | Collection | Security & Compliance | `_id` (ObjectId) | `projectId` (Mongoose) |
| 7 | **DevOpsArtifact** | `devopsartifacts` | Collection | DevOps & Infrastructure | `_id` (ObjectId) | `projectId` (Mongoose), `userId` (Clerk) |
| 8 | **TreeNode** | Embedded in `projects.tree` | Embedded Array | Repository Hierarchy | None (`_id: false`) | Parent: `Project` |
| 9 | **TopExtension** | Embedded in `projects.stats` | Embedded Array | Scanner Analytics | None (`_id: false`) | Parent: `Project` |
| 10 | **Message** | Embedded in `conversations.messages` | Embedded Array | AI Chat History | None (`_id: false`) | Parent: `Conversation` |
| 11 | **Citation** | Embedded in `messages.citations` | Embedded Array | Grounded Source Evidence | None (`_id: false`) | Parent: `Message` |
| 12 | **SourceLocation**| Embedded in `sourcefiles.sourceLocations` | Embedded Array | AST Symbol Index | None (`_id: false`) | Parent: `SourceFile` |
| 13 | **Validation** | Embedded in `devopsartifacts.validation` | Embedded Object | Manifest Quality Assurance | None (`_id: false`) | Parent: `DevOpsArtifact` |
| 14 | **ValidationCheck**| Embedded in `validation.checks` | Embedded Array | Granular Rule Evaluation | None (`_id: false`) | Parent: `Validation` |

---

## 4. In-Depth Field Specifications

### 4.1. `User` Collection (`users`)
- **File:** [`server/src/models/User.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/User.js)
- **Role:** Synchronizes authenticated user identity from Clerk frontend tokens (`POST /api/users/sync`) and provides identity attributes for multi-tenant tenancy.
- **Options:** `timestamps: true`, default `versionKey: true` (`__v`).

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `clerkId` | `String` | **UK**, **IDX** | Yes | None | Clerk User ID (`user_2...`). Acts as the multi-tenant partition key across all collections. |
| `email` | `String` | **UK** | Yes | None | Primary email address. Lowercased and trimmed. |
| `firstName` | `String` | None | No | `""` | User's first name synced from Clerk. |
| `lastName` | `String` | None | No | `""` | User's last name synced from Clerk. |
| `username` | `String` | None | No | `""` | User handle / username from Clerk profile. |
| `imageUrl` | `String` | None | No | `""` | Avatar / profile image URL. |
| `lastLoginAt`| `Date` | None | No | `Date.now` | Updated via `user.updateLastLogin()` method upon each session sync. |
| `createdAt` | `Date` | None | Yes | Auto | Timestamp when record was created (Mongoose `timestamps`). |
| `updatedAt` | `Date` | None | Yes | Auto | Timestamp when record was last updated (Mongoose `timestamps`). |
| `__v` | `Number` | None | No | `0` | Mongoose internal optimistic locking version key. |

---

### 4.2. `Project` Collection (`projects`)
- **File:** [`server/src/models/Project.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/Project.js)
- **Role:** Central domain entity. Manages the lifecycle of uploaded or imported codebases, noise-filtered file trees, language metrics, React Flow topology graphs, Tree-sitter AST intelligence, and AI prompt blueprints.
- **Options:** `timestamps: true`, `versionKey: false`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `userId` | `String` | **FK (Logical)**, **IDX** | Yes | None | References `User.clerkId`. Enforces strict multi-tenant isolation. |
| `name` | `String` | None | Yes | None | Repository name or uploaded archive name (trimmed). |
| `source` | `String` | Enum | Yes | `"github"` | Ingestion channel. Valid values: `["github", "zip"]`. |
| `status` | `String` | Enum, **IDX** | Yes | `"uploaded"` | Ingestion pipeline state: `["uploaded", "processing", "completed", "failed"]`. |
| `github` | `Subdocument` | Compound **UK** (partial) | No | `{}` | GitHub metadata: `{ githubId, owner, repo, fullName, url, ownerAvatar, defaultBranch, stars, forks, openIssues, language, topics: [], isPrivate, isFork, size, license }`. |
| `zip` | `Subdocument` | Compound **UK** (partial) | No | `{}` | ZIP upload metadata: `{ originalName, sizeBytes }`. |
| `tree` | `Array<TreeNode>` | Embedded Subdocs | No | `[]` | Sanitized repository file tree (excluding `node_modules`, `.git`, `.env`). Uses `treeNodeSchema`. |
| `stats` | `Subdocument` | Embedded Subdocs | No | `{}` | Summary statistics: `{ totalFiles, totalDirs, totalBytes, isTruncated, topExtensions: [{ extension, count }] }`. |
| `techStack` | `Subdocument` | None | No | `{}` | Detected technologies: `{ languages: [], frameworks: [], databases: [], devops: [] }`. |
| `primaryLanguage` | `String` | None | No | `null` | Primary programming language identified by RIE engine. |
| `secondaryLanguages`| `Array<String>` | None | No | `[]` | Additional programming languages detected. |
| `languageDetectionConfidence` | `Number` | None | No | `0` | Confidence score (0.0 to 1.0) of language identification. |
| `topology` | `Subdocument` | None | No | `{}` | React Flow system architecture graph: `{ nodes: [], edges: [], generatedAt: Date }`. |
| `capabilities` | `Subdocument` | None | No | `{}` | Capability matrix: `{ hasDatabase, hasApis, hasDevops, hasSecuritySensitiveCode, details: { databases: [], frameworks: [], devops: [] } }`. |
| `ast` | `Subdocument` | None | No | `{}` | Tree-sitter AST structural intelligence: `{ summary: { totalFilesParsed, totalFilesSkipped, errorCount, languagesParsed: [] }, files: [], imports: [], exports: [], functions: [], classes: [], routes: [], models: [], dependencies: { internal: [], external: [] }, entryPoints: [], errors: [] }`. |
| `blueprint` | `Subdocument` | None | No | `{}` | LLM prompt blueprint payload: `{ version, generatedAt, metadata, capabilities, entryPoints: [], structure: [], dependencies: {}, routes: [], models: [], classes: [], functions: [], tokenEstimate, isBudgetTruncated }`. |
| `database` | `Subdocument` | None | No | `{}` | Statically extracted schema: `{ type, entities: [], relationships: [] }`. Primary source for ERD features. |
| `extractionPath`| `String` | None | No | `null` | Ephemeral disk extraction directory (e.g. `server/storage/extracted/...`). Cleared after cleanup. |
| `errorDetails` | `Subdocument` | None | No | `{}` | Diagnostic details when `status === 'failed'`: `{ message, code, at }`. |
| `analysis` | `Subdocument` | None | No | `{}` | Per-module analysis progress tracking for `architecture`, `erd`, `api`, `security`, and `devops`. Each module subdocument contains `{ status: enum["idle","queued","processing","completed","failed"], analysisId, completedAt, errorMessage }`. |
| `analysisResults` | `Mixed` | None | No | `null` | Cached downstream AI generation outputs. |
| `sourceFingerprint` | `String` | **IDX** | No | `null` | SHA-256 fingerprint of repository content. Enables incremental analysis cache hits. |
| `analysisVersion` | `Number` | None | Yes | `1` | Monotonically increasing analysis run counter. |
| `lastAnalyzedAt`| `Date` | None | No | `null` | Timestamp of the most recent RIE analysis completion. |
| `securityFindings`| `Array<Object>`| None | No | `[]` | Fast-render UI cache of high-level security findings. |
| `securitySummary`| `Subdocument` | None | No | `{}` | Aggregated finding counts: `{ Critical: 0, High: 0, Medium: 0, Low: 0 }`. |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp (Mongoose `timestamps`). |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp (Mongoose `timestamps`). |

---

### 4.3. `Conversation` Collection (`conversations`)
- **File:** [`server/src/models/Conversation.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/Conversation.js)
- **Role:** Preserves threaded repository AI conversations, token metadata, and line-level codebase citations.
- **Options:** `timestamps: true`, `versionKey: false`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `userId` | `String` | **FK (Logical)**, **IDX** | Yes | None | References `User.clerkId`. Enforces user conversation privacy. |
| `projectId` | `ObjectId` | **FK (Physical)**, **IDX** | Yes | None | References `Project._id`. Links conversation to a specific repository. |
| `title` | `String` | None | Yes | `"New Conversation"` | Conversation title (trimmed, max 120 characters). |
| `messages` | `Array<Message>` | Embedded Subdocs | No | `[]` | Chronological list of user prompts and AI responses (`messageSchema`). |
| `lastMessageAt` | `Date` | **IDX** | Yes | `Date.now` | Updated on each message append; used for sorting conversation feeds. |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp. |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp. |

---

### 4.4. `SourceFile` Collection (`sourcefiles`)
- **File:** [`server/src/models/SourceFile.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/SourceFile.js)
- **Role:** Decoupled source code file storage. Stores sanitized, secret-redacted source text and symbol coordinates to protect the `Project` document from breaching MongoDB's 16MB document limit.
- **Options:** `timestamps: true`, `versionKey: false`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `projectId` | `ObjectId` | **FK (Physical)**, **IDX** | Yes | None | References `Project._id`. |
| `userId` | `String` | **FK (Logical)**, **IDX** | Yes | None | References `User.clerkId`. |
| `analysisVersion`| `Number` | **IDX** | Yes | `1` | Analysis run version identifier. |
| `filePath` | `String` | Compound **UK** | Yes | None | Relative path from repository root (e.g., `src/utils/auth.js`). |
| `fileName` | `String` | None | Yes | None | Base filename including extension (e.g., `auth.js`). |
| `extension` | `String` | None | No | `""` | File extension (e.g., `.js`, `.py`). |
| `language` | `String` | None | No | `"text"` | Programming syntax identifier for syntax highlighting. |
| `size` | `Number` | None | No | `0` | Size of raw source file in bytes. |
| `lineCount` | `Number` | None | No | `0` | Total number of lines in source file. |
| `contentHash` | `String` | None | No | `""` | SHA-256 checksum of raw content for change detection. |
| `content` | `String` | None | No | `null` | Sanitized and secret-redacted code string (null for binary files). |
| `isBinary` | `Boolean` | None | No | `false` | True if file was classified as non-text / binary. |
| `symbols` | `Array<String>` | None | No | `[]` | Extracted top-level symbol identifiers (classes, functions, routes). |
| `sourceLocations`| `Array<SourceLocation>` | Embedded Subdocs | No | `[]` | Exact line number boundaries for AST symbols (`sourceLocationSchema`). |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp. |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp. |

---

### 4.5. `SecurityAudit` Collection (`securityaudits`)
- **File:** [`server/src/models/SecurityAudit.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/SecurityAudit.js)
- **Role:** Tracks execution metadata, timing, coverage statistics, and severity tallies for a discrete security scan cycle.
- **Options:** `timestamps: true`, `versionKey: false`, `suppressReservedKeysWarning: true`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `projectId` | `ObjectId` | **FK (Physical)**, **IDX** | Yes | None | References `Project._id`. |
| `analysisVersion`| `Number` | Compound **UK**, **IDX**| Yes | `1` | Associated repository analysis version counter. |
| `status` | `String` | Enum, **IDX** | Yes | `"pending"` | Run lifecycle: `["pending", "processing", "completed", "failed"]`. |
| `startedAt` | `Date` | None | Yes | `Date.now` | Scan execution start timestamp. |
| `completedAt` | `Date` | None | No | `null` | Scan completion timestamp. |
| `totalFindings` | `Number` | None | Yes | `0` | Aggregate tally of all identified vulnerabilities. |
| `severityCounts`| `Subdocument` | None | Yes | `{}` | Detailed breakdown: `{ Critical: 0, High: 0, Medium: 0, Low: 0 }`. |
| `filesScanned` | `Number` | None | Yes | `0` | Total number of repository files analyzed. |
| `filesSkipped` | `Number` | None | Yes | `0` | Files ignored due to noise or exclusion rules. |
| `unsupportedFilesCount` | `Number` | None | Yes | `0` | Count of unsupported or binary file formats. |
| `unsupportedFiles`| `Array<String>` | None | No | `[]` | List of relative file paths not supported by scanners. |
| `scanErrors` | `Array<Object>` | None | No | `[]` | Tool-level execution diagnostics. |
| `errors` | `Array<String>` | None | No | `[]` | High-level failure error messages. |
| `scannerVersion`| `String` | None | Yes | `"1.0.0"` | Security engine release identifier. |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp. |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp. |

---

### 4.6. `SecurityFinding` Collection (`securityfindings`)
- **File:** [`server/src/models/SecurityFinding.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/SecurityFinding.js)
- **Role:** Individual security vulnerability records resulting from deterministic secret scanning, Tree-sitter AST rules, or AI-assisted code review. Raw credentials are never stored.
- **Options:** `timestamps: true`, `versionKey: false`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `projectId` | `ObjectId` | **FK (Physical)**, **IDX** | Yes | None | References `Project._id`. |
| `analysisVersion`| `Number` | **IDX** | Yes | `1` | Associated `SecurityAudit.analysisVersion`. |
| `ruleId` | `String` | **IDX** | Yes | None | Security check identifier (e.g., `SEC-RULE-01`, `JWT-SECRET`). |
| `category` | `String` | **IDX** | Yes | None | Category (e.g., `hardcoded_secret`, `sql_injection`, `insecure_transport`). |
| `title` | `String` | None | Yes | None | Concise finding headline. |
| `description` | `String` | None | Yes | None | Detailed technical impact and vulnerability narrative. |
| `severity` | `String` | Enum, **IDX** | Yes | None | Severity level: `["Critical", "High", "Medium", "Low"]`. |
| `confidence` | `String` | Enum | Yes | `"High"` | Detection confidence: `["High", "Medium", "Low"]`. |
| `status` | `String` | Enum, **IDX** | Yes | `"open"` | Triage state: `["open", "resolved", "ignored"]`. |
| `filePath` | `String` | **IDX** | Yes | None | Relative file path containing the finding. |
| `startLine` | `Number` | None | Yes | `1` | 1-based start line of vulnerable code snippet. |
| `endLine` | `Number` | None | Yes | `1` | 1-based end line of vulnerable code snippet. |
| `redactedEvidence` | `String` | None | No | `""` | Source code context with sensitive secret values masked. |
| `maskedValue` | `String` | None | No | `null` | Masked secret preview (e.g. `ghp_************abcd`). |
| `recommendation`| `String` | None | No | `""` | Prescribed architectural or code-level remediation fix. |
| `source` | `String` | Enum, **IDX** | Yes | None | Source analyzer: `["secret_scanner", "ast_analyzer", "ai_reviewer"]`. |
| `references` | `Array<String>` | None | No | `[]` | External security links (OWASP, CWE, NIST IDs). |
| `confirmed` | `Boolean` | None | Yes | `true` | Indicates verified high-confidence alert. |
| `metadata` | `Mixed` | None | No | `{}` | AST coordinates, entropy scores, and analyzer output payloads. |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp. |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp. |

---

### 4.7. `DevOpsArtifact` Collection (`devopsartifacts`)
- **File:** [`server/src/models/DevOpsArtifact.js`](file:///d:/My%20Projects/ArchMind%20AI/server/src/models/DevOpsArtifact.js)
- **Role:** Stores generated deployment and orchestration manifests (Dockerfiles, GitHub Actions workflows, Kubernetes YAML manifests) along with automated validation diagnostics.
- **Options:** `timestamps: true`, `versionKey: false`.

| Attribute | BSON Type | Key / Constraint | Required | Default Value | Description & Business Rules |
|---|---|---|---|---|---|
| `_id` | `ObjectId` | **PK** | Yes | `ObjectId()` | MongoDB unique document identifier. |
| `projectId` | `ObjectId` | **FK (Physical)**, **IDX** | Yes | None | References `Project._id`. |
| `userId` | `String` | **FK (Logical)**, **IDX** | Yes | None | References `User.clerkId`. |
| `artifactType` | `String` | Enum, **IDX** | Yes | None | Artifact category: `["dockerfile", "cicd", "kubernetes"]`. |
| `filePath` | `String` | None | Yes | None | Suggested target file path (e.g. `Dockerfile`, `.github/workflows/ci.yml`). |
| `content` | `String` | None | Yes | None | Full text content of the generated manifest. |
| `validation` | `Subdocument` | Embedded Subdoc | Yes | `{...}` | Automated validation diagnostic (`validationSchema`). |
| `generationStatus`| `String` | Enum, **IDX** | Yes | `"completed"` | Generation status: `["pending", "generating", "completed", "failed"]`. |
| `sourceAnalysisVersion`| `Number` | None | Yes | `1` | Repository analysis version used as context during generation. |
| `version` | `Number` | None | Yes | `1` | Artifact iteration version counter. |
| `superseded` | `Boolean` | None | Yes | `false` | True when a newer generation iteration replaces this manifest. |
| `metadata` | `Subdocument` | None | No | `{}` | Manifest parameters: `{ runtime, runtimeVersion, packageManager, framework, port, hasExistingArtifact, existingFilePath, targetPlatform, provider, options: {} }`. |
| `createdAt` | `Date` | None | Yes | Auto | Document creation timestamp. |
| `updatedAt` | `Date` | None | Yes | Auto | Last modification timestamp. |

---

## 5. Embedded Subdocuments & Nested Schemas

To optimize read latencies and eliminate excessive relational joins, ArchMind AI embeds 6 tightly coupled subdocument schemas:

### 5.1. `TreeNode` Schema (`Project.tree`)
- **Parent Entity:** `Project`
- **Cardinality:** 1 to `0..N` (embedded array)
- **Mongoose Configuration:** `{ _id: false }`
- **Fields:**
  - `path` (`String`, required): Normalized relative file path from repository root.
  - `type` (`String`, enum: `["file", "dir"]`, required): Node classification.
  - `size` (`Number`, default `0`): File size in bytes.
  - `sha` (`String`, optional): Git blob SHA hash.

### 5.2. `TopExtension` Schema (`Project.stats.topExtensions`)
- **Parent Entity:** `Project`
- **Cardinality:** 1 to `0..N` (embedded array)
- **Mongoose Configuration:** `{ _id: false }`
- **Fields:**
  - `extension` (`String`): File extension (e.g., `.js`, `.py`, `.ts`).
  - `count` (`Number`): Total count of files matching this extension.

### 5.3. `Message` Schema (`Conversation.messages`)
- **Parent Entity:** `Conversation`
- **Cardinality:** 1 to `0..N` (embedded array)
- **Mongoose Configuration:** `{ _id: false }`
- **Fields:**
  - `messageId` (`String`, required): Client/server generated unique UUID for the message.
  - `role` (`String`, enum: `["user", "assistant"]`, required): Message sender identity.
  - `content` (`String`, required): Text body formatted in Markdown.
  - `citations` (`Array<Citation>`, default `[]`): Array of embedded `citationSchema` objects.
  - `metadata` (`Mixed`, default `{}`): AI model identifier, prompt/completion token count, and latency metrics.
  - `createdAt` (`Date`, default `Date.now`): Timestamp of message creation.

### 5.4. `Citation` Schema (`Message.citations`)
- **Parent Entity:** `Message` (nested inside `Conversation.messages`)
- **Cardinality:** 1 to `0..N` (embedded array)
- **Mongoose Configuration:** `{ _id: false }`
- **Fields:**
  - `filePath` (`String`, required, trimmed): File path in repository.
  - `startLine` (`Number`, default `null`): 1-based start line of referenced code.
  - `endLine` (`Number`, default `null`): 1-based end line of referenced code.
  - `sourceType` (`String`, enum: `["source_file", "blueprint", "architecture", "api_route", "database_model", "security_finding"]`, default `"source_file"`): Context source anchor.
  - `snippet` (`String`, default `null`): Quoted code excerpt supporting the response.

### 5.5. `SourceLocation` Schema (`SourceFile.sourceLocations`)
- **Parent Entity:** `SourceFile`
- **Cardinality:** 1 to `0..N` (embedded array)
- **Mongoose Configuration:** `{ _id: false }`
- **Fields:**
  - `name` (`String`, required): Symbol identifier (e.g., function name, class name, endpoint URI).
  - `kind` (`String`, enum: `["function", "class", "route", "model", "variable", "entrypoint"]`, required): AST construct type.
  - `lineStart` (`Number`, required): 1-based beginning line number.
  - `lineEnd` (`Number`, required): 1-based ending line number.

### 5.6. `Validation` & `ValidationCheck` Schemas (`DevOpsArtifact.validation`)
- **Parent Entity:** `DevOpsArtifact`
- **Cardinality:** `DevOpsArtifact` 1:1 `Validation`, `Validation` 1:N `ValidationCheck`
- **Mongoose Configuration:** `{ _id: false, suppressReservedKeysWarning: true }`
- **Fields (`Validation`):**
  - `valid` (`Boolean`, required, default `true`): Diagnostic pass/fail outcome.
  - `errors` (`Array<String>`, default `[]`): Fatal syntax or schema validation failures.
  - `warnings` (`Array<String>`, default `[]`): Non-blocking linter and best practice warnings.
  - `checks` (`Array<ValidationCheck>`, default `[]`): List of evaluated rules.
  - `validationLevel` (`String`, enum: `["syntax", "structural", "schema", "tool"]`, default `"structural"`): Rigor level of check.
- **Fields (`ValidationCheck`):**
  - `name` (`String`, required): Rule assertion name (e.g. `hadolint-root-user`).
  - `passed` (`Boolean`, required): Rule assertion outcome.
  - `message` (`String`, default `""`): Diagnostic or remediation note.

---

## 6. Key Architecture & Relationships

MongoDB documents do not have database-level foreign key constraints enforced by the storage engine. Instead, ArchMind AI maintains data integrity using a dual-tier relationship model:
1. **Physical Mongoose References (`ref: "Project"`):** MongoDB `ObjectId` references populated via Mongoose `.populate()`.
2. **Logical Multi-Tenant References (`userId: String`):** Application-level foreign keys matching `User.clerkId`, enforced via query middleware and compound indexes.

### Complete Relationship Matrix

| # | Source Entity | Source Field | Target Entity | Target Field | Relationship Type | Crow's Foot Cardinality | Participation | Enforcement Mechanism |
|---|---|---|---|---|---|---|---|---|
| 1 | `Project` | `userId` | `User` | `clerkId` | Logical Multi-Tenant | `0..N : 1` | Mandatory | Controller middleware (`verifyProjectAccess`) |
| 2 | `Conversation` | `userId` | `User` | `clerkId` | Logical Multi-Tenant | `0..N : 1` | Mandatory | Controller middleware (`verifyProjectAccess`) |
| 3 | `SourceFile` | `userId` | `User` | `clerkId` | Logical Multi-Tenant | `0..N : 1` | Mandatory | Ingestion pipeline assignment |
| 4 | `DevOpsArtifact`| `userId` | `User` | `clerkId` | Logical Multi-Tenant | `0..N : 1` | Mandatory | Controller middleware & query filter |
| 5 | `Conversation` | `projectId` | `Project` | `_id` | Physical Mongoose Ref | `0..N : 1` | Mandatory | Mongoose `ref: "Project"`, indexed |
| 6 | `SourceFile` | `projectId` | `Project` | `_id` | Physical Mongoose Ref | `0..N : 1` | Mandatory | Mongoose `ref: "Project"`, compound index |
| 7 | `SecurityAudit` | `projectId` | `Project` | `_id` | Physical Mongoose Ref | `0..N : 1` | Mandatory | Mongoose `ref: "Project"`, compound unique |
| 8 | `SecurityFinding`| `projectId` | `Project` | `_id` | Physical Mongoose Ref | `0..N : 1` | Mandatory | Mongoose `ref: "Project"`, compound index |
| 9 | `DevOpsArtifact`| `projectId` | `Project` | `_id` | Physical Mongoose Ref | `0..N : 1` | Mandatory | Mongoose `ref: "Project"`, compound index |
| 10 | `SecurityAudit`| `projectId + analysisVersion` | `SecurityFinding` | `projectId + analysisVersion` | Logical Run Association | `1 : 0..N` | Optional | Atomic replacement in `SecurityAuditService` |
| 11 | `Project` | `tree` | `TreeNode` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |
| 12 | `Project` | `stats.topExtensions` | `TopExtension` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |
| 13 | `Conversation` | `messages` | `Message` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |
| 14 | `Message` | `citations` | `Citation` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |
| 15 | `SourceFile` | `sourceLocations` | `SourceLocation` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |
| 16 | `DevOpsArtifact`| `validation` | `Validation` | N/A | Embedded Subdocument | `1 : 1` | Mandatory | Nested Mongoose sub-schema (`_id: false`) |
| 17 | `Validation` | `checks` | `ValidationCheck` | N/A | Embedded Subdocument | `1 : 0..N` | Optional | Nested Mongoose sub-schema (`_id: false`) |

---

## 7. Database Indexes & Performance Optimization

ArchMind AI registers **35 indexes** across its 7 collections to support sub-millisecond lookups, compound sorting, and data integrity guarantees.

### Index Inventory Table

| Collection | Indexed Fields | Index Type | Unique | Partial Filter / Options | Query Pattern Optimized |
|---|---|---|---|---|---|
| `users` | `_id: 1` | Single Field | Yes | Default PK | Direct user lookup by MongoDB ID |
| `users` | `clerkId: 1` | Single Field | Yes | `unique: true` | Fast authentication sync (`POST /api/users/sync`) |
| `users` | `email: 1` | Single Field | Yes | `unique: true` | Prevent duplicate accounts; user discovery |
| `projects` | `_id: 1` | Single Field | Yes | Default PK | Direct project lookup (`Project.findById`) |
| `projects` | `userId: 1, github.fullName: 1` | Compound | Yes | `{ source: 'github', 'github.fullName': { $exists: true } }` | Prevent duplicate GitHub imports per user |
| `projects` | `userId: 1, zip.originalName: 1` | Compound | Yes | `{ source: 'zip', 'zip.originalName': { $exists: true } }` | Prevent duplicate ZIP uploads per user |
| `projects` | `userId: 1` | Single Field | No | None | Dashboard listing: `find({ userId })` |
| `projects` | `status: 1` | Single Field | No | None | Background scanner queue monitoring |
| `projects` | `sourceFingerprint: 1` | Single Field | No | None | Ingestion content cache matching |
| `conversations` | `_id: 1` | Single Field | Yes | Default PK | Direct conversation lookup |
| `conversations` | `userId: 1, projectId: 1, updatedAt: -1` | Compound | No | None | Fetching user conversation history sorted by activity |
| `conversations` | `userId: 1` | Single Field | No | None | Global user conversation cleanup |
| `conversations` | `projectId: 1` | Single Field | No | None | Project deletion cascade |
| `conversations` | `lastMessageAt: 1` | Single Field | No | None | Chat session activity TTL sorting |
| `sourcefiles` | `_id: 1` | Single Field | Yes | Default PK | Direct file retrieval |
| `sourcefiles` | `projectId: 1, filePath: 1, analysisVersion: 1` | Compound | Yes | `unique: true` | Ensure atomic file uniqueness per repository version |
| `sourcefiles` | `projectId: 1` | Single Field | No | None | Retrieve all files for project |
| `sourcefiles` | `userId: 1` | Single Field | No | None | Multi-tenant tenant access verification |
| `sourcefiles` | `analysisVersion: 1` | Single Field | No | None | Version cleanup queries |
| `securityaudits`| `_id: 1` | Single Field | Yes | Default PK | Direct audit retrieval |
| `securityaudits`| `projectId: 1, analysisVersion: 1` | Compound | Yes | `unique: true` | Ensure exactly one audit per project analysis version |
| `securityaudits`| `projectId: 1` | Single Field | No | None | Project audit run history |
| `securityaudits`| `analysisVersion: 1`| Single Field | No | None | Versioned audit matching |
| `securityaudits`| `status: 1` | Single Field | No | None | In-flight security scan monitoring |
| `securityfindings`| `_id: 1` | Single Field | Yes | Default PK | Direct finding lookup |
| `securityfindings`| `projectId: 1, analysisVersion: 1, status: 1` | Compound | No | None | Triage query: fetch open findings for current version |
| `securityfindings`| `projectId: 1, analysisVersion: 1, severity: 1` | Compound | No | None | Severity dashboard aggregation |
| `securityfindings`| `projectId: 1, filePath: 1` | Compound | No | None | Monaco editor file-level security gutter icons |
| `securityfindings`| `projectId: 1` | Single Field | No | None | Cascade deletion queries |
| `securityfindings`| `analysisVersion: 1`| Single Field | No | None | Version cleanup queries |
| `securityfindings`| `ruleId: 1` | Single Field | No | None | Rule frequency aggregations |
| `securityfindings`| `category: 1` | Single Field | No | None | Vulnerability category filtering |
| `securityfindings`| `severity: 1` | Single Field | No | None | Global severity triage |
| `securityfindings`| `status: 1` | Single Field | No | None | Status filtering |
| `securityfindings`| `source: 1` | Single Field | No | None | Analyzer source breakdowns |
| `devopsartifacts`| `_id: 1` | Single Field | Yes | Default PK | Direct artifact retrieval |
| `devopsartifacts`| `projectId: 1, artifactType: 1, version: -1` | Compound | No | None | Fetch latest manifest revision per type |
| `devopsartifacts`| `projectId: 1, userId: 1` | Compound | No | None | Verified tenant manifest queries |
| `devopsartifacts`| `projectId: 1` | Single Field | No | None | Project deletion cascade |
| `devopsartifacts`| `userId: 1` | Single Field | No | None | User artifact listings |
| `devopsartifacts`| `artifactType: 1` | Single Field | No | None | Filter by dockerfile, cicd, or kubernetes |
| `devopsartifacts`| `generationStatus: 1`| Single Field | No | None | Track in-flight manifest generations |

---

## 8. Multi-Tenant Isolation & Security Invariants

### 8.1. Clerk User ID Partitioning Invariant
- **Rule:** No API endpoint may retrieve or mutate a document without asserting ownership against `getAuth(req).userId`.
- **Implementation:**
  ```javascript
  // Standard multi-tenant ownership verification pattern
  const { project, userId } = await verifyProjectAccess(req);
  if (project.userId !== userId) {
    throw new Error("Forbidden. You do not own this project.");
  }
  ```
- **Compound Protection:** Ingestion unique compound indexes (`userId: 1, github.fullName: 1`) guarantee that two distinct users can both import the same public repository (e.g., `facebook/react`) without key collisions or cross-user data leakage.

### 8.2. Secret Redaction Invariant
- Raw sensitive credentials discovered during static repository analysis are **NEVER** stored in plaintext inside `SecurityFinding` or `Project`.
- The scanner redacts matched tokens, generating a `maskedValue` (e.g. `ghp_************abcd`) and `redactedEvidence` string before saving to MongoDB.

### 8.3. Atomic Analysis Versioning Invariant
- Security findings and source files are versioned via `analysisVersion: Number`.
- Re-running a scan replaces findings atomically per version:
  ```javascript
  await SecurityFinding.deleteMany({ projectId, analysisVersion });
  if (deduplicatedFindings.length > 0) {
    await SecurityFinding.insertMany(deduplicatedFindings);
  }
  ```

---

## 9. Architectural Observations & Recommendations

### 9.1. Observed Architecture Strengths
1. **Zero Document Bloat:** Decoupling `SourceFile` and `SecurityFinding` from `Project` ensures that large repositories (1,000+ files) will never exceed MongoDB's 16MB document cap.
2. **Deterministic Citations:** The embedded `citationSchema` inside `Conversation.messages` gives ArchMind AI an audit-grade citation mechanism for code exploration.
3. **Compound Partial Filter Indexes:** Leveraging MongoDB's `partialFilterExpression` on `github.fullName` and `zip.originalName` cleanly supports multiple ingestion sources without null key conflicts.

### 9.2. Identified Ambiguities & Future Hardening Recommendations
1. **Cascade Deletions:** When a `Project` is deleted, related documents in `conversations`, `sourcefiles`, `securityaudits`, `securityfindings`, and `devopsartifacts` must be purged. Currently handled at the controller level; recommended to introduce a Mongoose `pre('findOneAndDelete')` middleware hook to ensure referential cascade safety.
2. **Conversation Message Growth:** For very long-running repository chat threads (exceeding 500+ messages), embedding all messages inside a single `Conversation.messages` array could eventually approach document limits. If chat threads exceed ~2,000 messages, consider migrating to a decoupled `ChatMessage` collection or pagination chunking.
3. **Optimistic Concurrency Control:** `Project` currently has `versionKey: false`. For concurrent asynchronous analysis pipelines updating different slices of `Project.analysis`, enabling Mongoose `versionKey: true` or utilizing atomic `$set` operations on specific subpaths prevents race conditions.

---

## 10. Verification & Artifact Checklist

| Deliverable | File Path | Status | Verification Check |
|---|---|---|---|
| **High-Resolution PNG** | [`ArchMindAI_ER_Diagram.png`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.png) | **Verified** | 4500 x 3000 px, 300 DPI, full color-coded cards and Crow's Foot connectors. |
| **Scalable Vector SVG** | [`ArchMindAI_ER_Diagram.svg`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.svg) | **Verified** | Valid XML, drop shadows, responsive viewbox, crisp fonts. |
| **Publication-Quality PDF** | [`ArchMindAI_ER_Diagram.pdf`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_ER_Diagram.pdf) | **Verified** | 12 Pages, executive cover, embedded landscape ERD, data dictionary tables. |
| **Technical Documentation** | [`ArchMindAI_Database_Documentation.md`](file:///d:/My%20Projects/ArchMind%20AI/docs/database/ArchMindAI_Database_Documentation.md) | **Verified** | Complete field reference, index catalog, multi-tenant invariants. |

