// scratch/generate_erd_pdf.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const DOCS_DIR = path.resolve("docs/database");
const PNG_PATH = path.join(DOCS_DIR, "ArchMindAI_ER_Diagram.png");
const PDF_PATH = path.join(DOCS_DIR, "ArchMindAI_ER_Diagram.pdf");

console.log(`Writing PDF to: ${PDF_PATH}`);

// Create PDF document (Portrait default, A4)
const doc = new PDFDocument({
  autoFirstPage: false,
  bufferPages: true,
});

const writeStream = fs.createWriteStream(PDF_PATH);
doc.pipe(writeStream);

// Colors matching ArchMind AI Design System
const C = {
  navy: "#0f172a",       // Primary Headings
  navyLight: "#1e293b",
  cyan: "#0891b2",       // Accent Cyan
  cyanLight: "#e0f2fe",
  body: "#334155",       // Slate text
  muted: "#64748b",      // Gray captions
  cardBg: "#f8fafc",     // Card Fill
  border: "#cbd5e1",     // Border
  borderLight: "#e2e8f0",
  white: "#ffffff",
  gold: "#b45309",
  emerald: "#047857",
  rose: "#be123c",
  purple: "#6d28d9",
};

// ── PAGE 1: TITLE & EXECUTIVE SUMMARY ───────────────────────────────────────
doc.addPage({ size: "A4", layout: "portrait", margin: 40 });

// Header Banner
doc.rect(40, 40, 515, 120).fillAndStroke(C.navy, C.cyan);
doc.fillColor(C.white).fontSize(24).font("Helvetica-Bold").text("ArchMind AI", 60, 58);
doc.fillColor(C.cyanLight).fontSize(14).font("Helvetica").text("Platform Database Architecture & Entity Relationship Diagram (ERD)", 60, 88);
doc.fillColor("#94a3b8").fontSize(10).text("Comprehensive Technical Specification • MongoDB Atlas • Mongoose ODM • Clerk Auth", 60, 112);
doc.fillColor(C.white).fontSize(9).text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} | Confidential & Proprietary`, 60, 132);

// Summary Statistics Cards
const drawStatCard = (x, y, w, h, title, val, color) => {
  doc.rect(x, y, w, h).fillAndStroke(C.cardBg, C.borderLight);
  doc.rect(x, y, 4, h).fill(color);
  doc.fillColor(C.muted).fontSize(9).font("Helvetica-Bold").text(title.toUpperCase(), x + 14, y + 10);
  doc.fillColor(C.navy).fontSize(18).font("Helvetica-Bold").text(String(val), x + 14, y + 26);
};

drawStatCard(40, 175, 120, 55, "Collections", "7 Models", C.cyan);
drawStatCard(172, 175, 120, 55, "Embedded Subdocs", "6 Entities", C.emerald);
drawStatCard(304, 175, 120, 55, "Total Relationships", "15 Mappings", C.purple);
drawStatCard(436, 175, 119, 55, "Database Indexes", "35 Indexes", C.gold);

// Executive Overview Section
doc.fillColor(C.navy).fontSize(15).font("Helvetica-Bold").text("1. Executive Database Overview", 40, 245);
doc.fillColor(C.body).fontSize(10).font("Helvetica").text(
  "ArchMind AI utilizes a multi-model document database architecture powered by MongoDB Atlas and Mongoose ODM. " +
  "The database is structured to balance multi-tenant workload isolation, ultra-fast read retrievals for interactive " +
  "codebase exploration, and defense against MongoDB's 16MB BSON document limit through explicit file-decoupling.\n\n" +
  "Multi-tenant data partitioning is enforced via Clerk Authentication (User.clerkId). High-cardinality entities such as " +
  "SourceFile documents and granular SecurityFinding records are persisted in dedicated, indexed collections with compound " +
  "uniqueness constraints, while hierarchical structures (file trees, validation checks, chat citations) are efficiently embedded.",
  40, 268, { width: 515, lineGap: 3 }
);

// Notation Legend Table
doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold").text("2. ERD Notation & Cardinality Legend", 40, 375);

const drawLegendRow = (y, symbol, meaning, notation, description) => {
  doc.rect(40, y, 515, 24).fillAndStroke(y % 48 === 0 ? C.cardBg : C.white, C.borderLight);
  doc.fillColor(C.navy).fontSize(9).font("Helvetica-Bold").text(symbol, 48, y + 6);
  doc.fillColor(C.body).fontSize(9).font("Helvetica").text(meaning, 110, y + 6);
  doc.fillColor(C.cyan).fontSize(9).font("Helvetica-Bold").text(notation, 230, y + 6);
  doc.fillColor(C.muted).fontSize(8.5).font("Helvetica").text(description, 310, y + 6, { width: 235 });
};

// Table Header
doc.rect(40, 395, 515, 20).fillAndStroke(C.navyLight, C.navyLight);
doc.fillColor(C.white).fontSize(8.5).font("Helvetica-Bold").text("SYMBOL", 48, 401);
doc.fillColor(C.white).fontSize(8.5).font("Helvetica-Bold").text("MEANING", 110, 401);
doc.fillColor(C.white).fontSize(8.5).font("Helvetica-Bold").text("CARDINALITY", 230, 401);
doc.fillColor(C.white).fontSize(8.5).font("Helvetica-Bold").text("ARCHITECTURAL ROLE", 310, 401);

let ly = 415;
drawLegendRow(ly, "PK", "Primary Key", "1 : 1", "MongoDB _id auto-assigned unique BSON ObjectId."); ly += 24;
drawLegendRow(ly, "FK (Phys)", "Foreign Key (Physical)", "1 : 0..N", "Mongoose ObjectId ref referencing parent collection."); ly += 24;
drawLegendRow(ly, "FK (Log)", "Foreign Key (Logical)", "1 : 0..N", "Application-level tenant key referencing User.clerkId."); ly += 24;
drawLegendRow(ly, "UK", "Unique Key", "1 : 1 / Compound", "Enforced database index preventing duplicate entities."); ly += 24;
drawLegendRow(ly, "EMB", "Embedded Subdocument", "1 : N (Embedded)", "Denormalized array or sub-schema inside parent document."); ly += 24;
drawLegendRow(ly, "---o{", "Crow's Foot Zero/Many", "0..N", "Optional child participation (e.g. Project has 0..N audits)."); ly += 24;
drawLegendRow(ly, "---||", "Crow's Foot Exactly One", "1 : 1", "Mandatory parent participation (e.g. Conversation has 1 project)."); ly += 24;

// Functional Grouping Overview
doc.fillColor(C.navy).fontSize(14).font("Helvetica-Bold").text("3. Core Functional Domains", 40, 600);

const domains = [
  { name: "Authentication & Identity", col: "users", desc: "Clerk identity syncing, user profiles, login timestamps." },
  { name: "Core Repository Intelligence", col: "projects", desc: "Ingestion state, file tree, tech stack, AST blueprint, topology." },
  { name: "AI Chat & Grounded Context", col: "conversations", desc: "Threaded repository chat, tokens, validated line citations." },
  { name: "Code Indexing & Retrieval", col: "sourcefiles", desc: "Decoupled file storage avoiding 16MB limit, symbol spans." },
  { name: "Security & Compliance", col: "securityaudits, securityfindings", desc: "Secret scan runs, AST vulnerability rules, redacted evidence." },
  { name: "DevOps & Infrastructure", col: "devopsartifacts", desc: "Dockerfiles, CI/CD pipelines, Kubernetes, syntax validation." },
];

let dy = 620;
for (const d of domains) {
  doc.rect(40, dy, 515, 26).fillAndStroke(C.cardBg, C.borderLight);
  doc.fillColor(C.cyan).fontSize(9.5).font("Helvetica-Bold").text(d.name, 48, dy + 6);
  doc.fillColor(C.body).fontSize(8.5).font("Helvetica").text(d.desc, 230, dy + 6, { width: 315 });
  dy += 30;
}

// ── PAGE 2: HIGH-RESOLUTION LANDSCAPE ER DIAGRAM ───────────────────────────
doc.addPage({ size: "A4", layout: "landscape", margin: 25 });

// Landscape Header
doc.rect(25, 20, 792, 45).fillAndStroke(C.navy, C.cyan);
doc.fillColor(C.white).fontSize(16).font("Helvetica-Bold").text("ArchMind AI — Complete Platform Entity Relationship Diagram (ERD)", 40, 32);
doc.fillColor(C.cyanLight).fontSize(10).font("Helvetica").text("Visual Overview of 7 MongoDB Collections, 6 Embedded Entities, and Crow's Foot Relationships", 40, 50);

// Embed High-Resolution PNG
if (fs.existsSync(PNG_PATH)) {
  doc.image(PNG_PATH, 25, 75, {
    fit: [792, 490],
    align: "center",
    valign: "center",
  });
} else {
  doc.fillColor(C.rose).fontSize(14).text("Error: PNG Diagram file not found at " + PNG_PATH, 50, 100);
}

// ── PAGES 3+: COMPREHENSIVE DATA DICTIONARY ─────────────────────────────────
const ENTITY_SPECS = [
  {
    name: "User",
    collection: "users",
    category: "Authentication & Identity",
    desc: "Stores user account profiles, Clerk authentication mappings, identity details, and login audit timestamps. Acts as the root tenant identity.",
    options: "timestamps: true, versionKey: true",
    indexes: ["_id (PK)", "clerkId (unique)", "email (unique)"],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["clerkId", "String", "UK", "REQ", "Clerk Authentication user ID (e.g. 'user_2...')", "Unique index"],
      ["email", "String", "UK", "REQ", "Unique lowercase email address (trimmed)", "Unique index"],
      ["firstName", "String", "---", "OPT", "Given name synchronized from Clerk profile", '""'],
      ["lastName", "String", "---", "OPT", "Family name synchronized from Clerk profile", '""'],
      ["username", "String", "---", "OPT", "User-selected or Clerk handle", '""'],
      ["imageUrl", "String", "---", "OPT", "Avatar profile picture URL", '""'],
      ["lastLoginAt", "Date", "---", "OPT", "Timestamp of most recent authentication / sync", "Date.now()"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
      ["__v", "Number", "---", "OPT", "Internal Mongoose document version key", "0"],
    ],
  },
  {
    name: "Project",
    collection: "projects",
    category: "Core Repository Intelligence",
    desc: "Central repository metadata hub storing file trees, tech stack, topology graphs, Tree-sitter AST, prompt blueprints, and multi-module analysis states.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ userId: 1, 'github.fullName': 1 } (unique, partialFilter: source='github')",
      "{ userId: 1, 'zip.originalName': 1 } (unique, partialFilter: source='zip')",
      "userId (asc)",
      "status (asc)",
      "sourceFingerprint (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["userId", "String", "FK", "REQ", "Clerk User ID [Logical Reference to User.clerkId]", "Indexed"],
      ["name", "String", "---", "REQ", "Repository display name or archive title", "Trimmed"],
      ["source", "String", "---", "REQ", "Ingestion origin enum: ['github', 'zip']", "'github'"],
      ["status", "String", "IDX", "REQ", "Pipeline lifecycle: ['uploaded','processing','completed','failed']", "'uploaded'"],
      ["github", "Subdocument", "---", "OPT", "GitHub metadata: { githubId, owner, repo, fullName, defaultBranch, ... }", "{}"],
      ["zip", "Subdocument", "---", "OPT", "ZIP upload metadata: { originalName, sizeBytes }", "{}"],
      ["tree", "Array<TreeNode>", "EMB", "OPT", "Embedded sanitized repository file hierarchy [1:N TreeNode]", "[]"],
      ["stats", "Subdocument", "---", "OPT", "Summary metrics: { totalFiles, totalDirs, totalBytes, topExtensions }", "{}"],
      ["techStack", "Subdocument", "---", "OPT", "Detected stack: { languages: [], frameworks: [], databases: [], devops: [] }", "{}"],
      ["primaryLanguage", "String", "---", "OPT", "Dominant language identified by RIE", "null"],
      ["secondaryLanguages", "Array<String>", "---", "OPT", "Secondary languages identified in repository", "[]"],
      ["languageDetectionConfidence", "Number", "---", "OPT", "Statistical confidence score of language identification", "0"],
      ["topology", "Subdocument", "---", "OPT", "React Flow architecture graph: { nodes: [], edges: [], generatedAt }", "{}"],
      ["capabilities", "Subdocument", "---", "OPT", "Relevance matrix: { hasDatabase, hasApis, hasDevops, details }", "{}"],
      ["ast", "Subdocument", "---", "OPT", "Tree-sitter structural AST: { summary, files, routes, models, classes, ... }", "{}"],
      ["blueprint", "Subdocument", "---", "OPT", "Ground-truth LLM prompt blueprint: { version, routes, models, tokenEst }", "{}"],
      ["database", "Subdocument", "---", "OPT", "Static schema extraction: { type, entities: [], relationships: [] }", "{}"],
      ["extractionPath", "String", "---", "OPT", "Ephemeral extraction path in server/storage/extracted", "null"],
      ["errorDetails", "Subdocument", "---", "OPT", "Diagnostic on pipeline failure: { message, code, at }", "null"],
      ["analysis", "Subdocument", "---", "OPT", "Per-module state: { architecture, erd, api, security, devops }", "{}"],
      ["analysisResults", "Mixed", "---", "OPT", "Cached downstream AI analysis payloads", "null"],
      ["sourceFingerprint", "String", "IDX", "OPT", "SHA-256 fingerprint of repository content for caching", "Indexed"],
      ["analysisVersion", "Number", "---", "REQ", "Sequential analysis version counter", "1"],
      ["lastAnalyzedAt", "Date", "---", "OPT", "Timestamp of most recent analysis run", "null"],
      ["securityFindings", "Array<Object>", "---", "OPT", "Denormalized projection of security findings for fast UI render", "[]"],
      ["securitySummary", "Subdocument", "---", "OPT", "Aggregate severity counts: { Critical, High, Medium, Low }", "{}"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
  {
    name: "Conversation",
    collection: "conversations",
    category: "AI Chat & Grounded Context",
    desc: "Repository AI chat conversations preserving prompt histories, token metadata, and verified line-level source code citations.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ userId: 1, projectId: 1, updatedAt: -1 } (compound search index)",
      "userId (asc)",
      "projectId (asc)",
      "lastMessageAt (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["userId", "String", "FK", "REQ", "Clerk User ID [Logical Reference to User.clerkId]", "Indexed"],
      ["projectId", "ObjectId", "FK", "REQ", "Target repository [Physical Reference to Project._id]", "Indexed"],
      ["title", "String", "---", "REQ", "Conversation title (maxlength: 120 chars)", "'New Conversation'"],
      ["messages", "Array<Message>", "EMB", "OPT", "Embedded chronological messages [1:N Message]", "[]"],
      ["lastMessageAt", "Date", "IDX", "REQ", "Timestamp of most recent message", "Date.now()"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
  {
    name: "SourceFile",
    collection: "sourcefiles",
    category: "Code Indexing & Retrieval",
    desc: "Indexed source file storage separate from the Project document to prevent MongoDB's 16MB document limit and enable citations.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ projectId: 1, filePath: 1, analysisVersion: 1 } (unique)",
      "projectId (asc)",
      "userId (asc)",
      "analysisVersion (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["projectId", "ObjectId", "FK", "REQ", "Target repository [Physical Reference to Project._id]", "Indexed"],
      ["userId", "String", "FK", "REQ", "Clerk User ID [Logical Reference to User.clerkId]", "Indexed"],
      ["analysisVersion", "Number", "IDX", "REQ", "Sequential analysis version counter", "1"],
      ["filePath", "String", "UK*", "REQ", "Relative path within repository (compound unique)", "Trimmed"],
      ["fileName", "String", "---", "REQ", "Basename of file including extension", "Required"],
      ["extension", "String", "---", "OPT", "File extension (e.g. '.js', '.py')", '""'],
      ["language", "String", "---", "OPT", "Programming language identifier", "'text'"],
      ["size", "Number", "---", "OPT", "Raw file size in bytes", "0"],
      ["lineCount", "Number", "---", "OPT", "Total lines of source code", "0"],
      ["contentHash", "String", "---", "OPT", "SHA-256 hash of file content", '""'],
      ["content", "String", "---", "OPT", "Sanitized & secret-redacted source text", "null if binary/large"],
      ["isBinary", "Boolean", "---", "OPT", "Flag indicating binary/non-text file", "false"],
      ["symbols", "Array<String>", "---", "OPT", "Extracted code symbols (functions, classes)", "[]"],
      ["sourceLocations", "Array<SourceLocation>", "EMB", "OPT", "AST line spans [1:N SourceLocation]", "[]"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
  {
    name: "SecurityAudit",
    collection: "securityaudits",
    category: "Security & Compliance",
    desc: "Persistent security audit run metadata tracking scan coverage, severity tallies, scanner versions, and unsupported files.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ projectId: 1, analysisVersion: 1 } (unique)",
      "projectId (asc)",
      "analysisVersion (asc)",
      "status (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["projectId", "ObjectId", "FK", "REQ", "Target repository [Physical Reference to Project._id]", "Indexed"],
      ["analysisVersion", "Number", "UK*", "REQ", "Analysis run version (compound unique with projectId)", "1"],
      ["status", "String", "IDX", "REQ", "Lifecycle: ['pending','processing','completed','failed']", "'pending'"],
      ["startedAt", "Date", "---", "REQ", "Timestamp when security audit scan began", "Date.now()"],
      ["completedAt", "Date", "---", "OPT", "Timestamp when security audit scan ended", "null"],
      ["totalFindings", "Number", "---", "REQ", "Aggregate count of detected security issues", "0"],
      ["severityCounts", "Subdocument", "---", "REQ", "Severity tallies: { Critical, High, Medium, Low }", "{}"],
      ["filesScanned", "Number", "---", "REQ", "Total repository files scanned for security issues", "0"],
      ["filesSkipped", "Number", "---", "REQ", "Total repository files ignored by noise filter", "0"],
      ["unsupportedFilesCount", "Number", "---", "REQ", "Count of unsupported/binary file formats", "0"],
      ["unsupportedFiles", "Array<String>", "---", "OPT", "List of skipped non-analyzable files", "[]"],
      ["scanErrors", "Array<Object>", "---", "OPT", "Diagnostic error records from scanners", "[]"],
      ["errors", "Array<String>", "---", "OPT", "High-level execution error messages", "[]"],
      ["scannerVersion", "String", "---", "REQ", "ArchMind security engine release version", "'1.0.0'"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
  {
    name: "SecurityFinding",
    collection: "securityfindings",
    category: "Security & Compliance",
    desc: "Deterministic secret detections, Tree-sitter AST security vulnerabilities, and AI code review findings with redacted evidence.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ projectId: 1, analysisVersion: 1, status: 1 } (compound filter)",
      "{ projectId: 1, analysisVersion: 1, severity: 1 } (compound triage)",
      "{ projectId: 1, filePath: 1 } (file finding lookup)",
      "projectId (asc)", "analysisVersion (asc)", "ruleId (asc)", "category (asc)", "severity (asc)", "status (asc)", "source (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["projectId", "ObjectId", "FK", "REQ", "Target repository [Physical Reference to Project._id]", "Indexed"],
      ["analysisVersion", "Number", "IDX", "REQ", "Associated SecurityAudit analysisVersion", "1"],
      ["ruleId", "String", "IDX", "REQ", "Rule code identifier (e.g. 'SEC-SECRET-01')", "Indexed"],
      ["category", "String", "IDX", "REQ", "Category: 'hardcoded_secret', 'sql_injection', etc.", "Indexed"],
      ["title", "String", "---", "REQ", "Concise finding title", "Required"],
      ["description", "String", "---", "REQ", "Comprehensive vulnerability explanation & threat analysis", "Required"],
      ["severity", "String", "IDX", "REQ", "Severity enum: ['Critical', 'High', 'Medium', 'Low']", "Indexed"],
      ["confidence", "String", "---", "REQ", "Confidence enum: ['High', 'Medium', 'Low']", "'High'"],
      ["status", "String", "IDX", "REQ", "Triage status enum: ['open', 'resolved', 'ignored']", "'open'"],
      ["filePath", "String", "IDX", "REQ", "Vulnerable file path within repository", "Trimmed"],
      ["startLine", "Number", "---", "REQ", "1-based starting line of vulnerable code", "1"],
      ["endLine", "Number", "---", "REQ", "1-based ending line of vulnerable code", "1"],
      ["redactedEvidence", "String", "---", "OPT", "Sanitized source code snippet (secrets redacted)", '""'],
      ["maskedValue", "String", "---", "OPT", "Partially masked token (e.g. 'ghp_****')", "null"],
      ["recommendation", "String", "---", "OPT", "Concrete engineering remediation advice", '""'],
      ["source", "String", "IDX", "REQ", "Detection engine: ['secret_scanner','ast_analyzer','ai_reviewer']", "Indexed"],
      ["references", "Array<String>", "---", "OPT", "CWE, OWASP, and NIST vulnerability references", "[]"],
      ["confirmed", "Boolean", "---", "REQ", "Evidence confirmation verification flag", "true"],
      ["metadata", "Mixed", "---", "OPT", "AST coordinates, entropy metrics, scanner output", "{}"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
  {
    name: "DevOpsArtifact",
    collection: "devopsartifacts",
    category: "DevOps & Infrastructure",
    desc: "Persistent Dockerfiles, CI/CD pipeline workflows, and Kubernetes manifests generated from repository intelligence.",
    options: "timestamps: true, versionKey: false",
    indexes: [
      "_id (PK)",
      "{ projectId: 1, artifactType: 1, version: -1 } (latest retrieval)",
      "{ projectId: 1, userId: 1 } (tenant isolation index)",
      "projectId (asc)", "userId (asc)", "artifactType (asc)", "generationStatus (asc)",
    ],
    fields: [
      ["_id", "ObjectId", "PK", "REQ", "Auto-generated unique BSON identifier", "ObjectId()"],
      ["projectId", "ObjectId", "FK", "REQ", "Target repository [Physical Reference to Project._id]", "Indexed"],
      ["userId", "String", "FK", "REQ", "Clerk User ID [Logical Reference to User.clerkId]", "Indexed"],
      ["artifactType", "String", "IDX", "REQ", "Artifact type enum: ['dockerfile', 'cicd', 'kubernetes']", "Indexed"],
      ["filePath", "String", "---", "REQ", "Suggested target file path (e.g. 'Dockerfile')", "Trimmed"],
      ["content", "String", "---", "REQ", "Full manifest content (Dockerfile syntax / YAML)", "Required"],
      ["validation", "Subdocument", "EMB", "REQ", "Validation diagnostic subdocument [1:1 Validation]", "{...}"],
      ["generationStatus", "String", "IDX", "REQ", "Status enum: ['pending','generating','completed','failed']", "'completed'"],
      ["sourceAnalysisVersion", "Number", "---", "REQ", "Analysis version used as generation baseline", "1"],
      ["version", "Number", "---", "REQ", "Artifact revision iteration counter", "1"],
      ["superseded", "Boolean", "---", "REQ", "Flag indicating whether newer version exists", "false"],
      ["metadata", "Subdocument", "---", "OPT", "Configuration: { runtime, framework, port, provider }", "{}"],
      ["createdAt", "Date", "---", "REQ", "Document creation audit timestamp", "Mongoose timestamps"],
      ["updatedAt", "Date", "---", "REQ", "Last document modification audit timestamp", "Mongoose timestamps"],
    ],
  },
];

// Helper to draw an entity data dictionary table
function renderEntityDictionary(entity) {
  doc.addPage({ size: "A4", layout: "portrait", margin: 40 });

  // Entity Title Header
  doc.rect(40, 40, 515, 65).fillAndStroke(C.cardBg, C.border);
  doc.rect(40, 40, 6, 65).fill(C.cyan);
  doc.fillColor(C.navy).fontSize(18).font("Helvetica-Bold").text(`${entity.name} Collection`, 56, 50);
  doc.fillColor(C.muted).fontSize(10).font("Helvetica").text(`Collection: ${entity.collection} • Domain: ${entity.category}`, 56, 72);
  doc.fillColor(C.body).fontSize(8.5).text(`Mongoose Options: ${entity.options}`, 56, 88);

  // Description
  doc.fillColor(C.navy).fontSize(11).font("Helvetica-Bold").text("Description:", 40, 118);
  doc.fillColor(C.body).fontSize(9.5).font("Helvetica").text(entity.desc, 40, 132, { width: 515, lineGap: 2 });

  // Indexes Summary
  doc.fillColor(C.navy).fontSize(11).font("Helvetica-Bold").text("Database Indexes & Constraints:", 40, 168);
  let idxY = 182;
  for (const idx of entity.indexes) {
    doc.fillColor(C.cyan).fontSize(9).font("Helvetica-Bold").text("•", 48, idxY);
    doc.fillColor(C.body).fontSize(8.5).font("Helvetica").text(idx, 60, idxY);
    idxY += 14;
  }

  // Attributes Table
  const tableY = idxY + 12;
  doc.fillColor(C.navy).fontSize(11).font("Helvetica-Bold").text("Attribute Definitions:", 40, tableY);

  const headerY = tableY + 16;
  doc.rect(40, headerY, 515, 20).fillAndStroke(C.navyLight, C.navyLight);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("KEY", 46, headerY + 6);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("NULL", 78, headerY + 6);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("FIELD NAME", 112, headerY + 6);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("TYPE", 220, headerY + 6);
  doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("DESCRIPTION & DEFAULTS", 310, headerY + 6);

  let rowY = headerY + 20;
  for (const f of entity.fields) {
    // Page overflow check
    if (rowY > 760) {
      doc.addPage({ size: "A4", layout: "portrait", margin: 40 });
      rowY = 40;
      doc.rect(40, rowY, 515, 20).fillAndStroke(C.navyLight, C.navyLight);
      doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("KEY", 46, rowY + 6);
      doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("NULL", 78, rowY + 6);
      doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("FIELD NAME", 112, rowY + 6);
      doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("TYPE", 220, rowY + 6);
      doc.fillColor(C.white).fontSize(8).font("Helvetica-Bold").text("DESCRIPTION & DEFAULTS", 310, rowY + 6);
      rowY += 20;
    }

    const [key, req, fname, ftype, desc, def] = f;
    const isAlt = (rowY / 20) % 2 === 1;
    doc.rect(40, rowY, 515, 19).fillAndStroke(isAlt ? C.cardBg : C.white, C.borderLight);

    // Key badge
    if (key !== "---") {
      doc.fillColor(key.includes("PK") ? C.gold : (key.includes("FK") ? C.cyan : C.purple))
        .fontSize(7.5).font("Helvetica-Bold").text(key, 46, rowY + 5);
    }

    // Required badge
    doc.fillColor(req === "REQ" ? C.rose : C.muted)
      .fontSize(7.5).font("Helvetica-Bold").text(req, 78, rowY + 5);

    // Field name
    doc.fillColor(C.navy).fontSize(8.5).font("Helvetica-Bold").text(fname, 112, rowY + 5);

    // Type
    doc.fillColor(C.cyan).fontSize(8).font("Helvetica").text(ftype, 220, rowY + 5);

    // Desc
    const noteText = def ? `${desc} [def: ${def}]` : desc;
    doc.fillColor(C.body).fontSize(7.5).font("Helvetica").text(noteText, 310, rowY + 5, { width: 240, ellipsis: true });

    rowY += 19;
  }
}

for (const entity of ENTITY_SPECS) {
  renderEntityDictionary(entity);
}

// ── FINAL PAGE: EMBEDDED SUBDOCUMENTS SPECIFICATION ────────────────────────
doc.addPage({ size: "A4", layout: "portrait", margin: 40 });
doc.fillColor(C.navy).fontSize(18).font("Helvetica-Bold").text("Embedded Subdocuments Specification", 40, 40);
doc.fillColor(C.body).fontSize(9.5).font("Helvetica").text(
  "Embedded subdocuments represent denormalized child schemas nested directly inside MongoDB documents. " +
  "ArchMind AI utilizes embedded subdocuments where data has strong lifecycle coupling and bounded growth.",
  40, 65, { width: 515, lineGap: 3 }
);

const EMBEDDED_SPECS = [
  {
    name: "TreeNode",
    parent: "Project.tree",
    cardinality: "1 : 0..N (Embedded)",
    desc: "Sanitized repository file tree hierarchy with noise-filtered paths, sizes, and Git SHAs.",
    fields: "path (String, req), type (String: 'file'|'dir', req), size (Number, def: 0), sha (String, opt)",
  },
  {
    name: "TopExtension",
    parent: "Project.stats.topExtensions",
    cardinality: "1 : 0..N (Embedded)",
    desc: "Summary file extension distribution tally generated during initial RIE scanner indexing.",
    fields: "extension (String, req), count (Number, req)",
  },
  {
    name: "Message",
    parent: "Conversation.messages",
    cardinality: "1 : 0..N (Embedded)",
    desc: "Chronological chat message document containing role, markdown text, citations, and token metadata.",
    fields: "messageId (String, req), role (String: 'user'|'assistant', req), content (String, req), citations ([Citation]), metadata (Mixed)",
  },
  {
    name: "Citation",
    parent: "Conversation.messages.citations",
    cardinality: "1 : 0..N (Embedded)",
    desc: "Ground-truth source code citation linking LLM assertions to exact file paths and line ranges.",
    fields: "filePath (String, req), startLine (Number), endLine (Number), sourceType (enum), snippet (String)",
  },
  {
    name: "SourceLocation",
    parent: "SourceFile.sourceLocations",
    cardinality: "1 : 0..N (Embedded)",
    desc: "Symbol location index mapping functions, classes, routes, and models to exact source line spans.",
    fields: "name (String, req), kind (enum: function|class|route|model|variable|entrypoint, req), lineStart (Number, req), lineEnd (Number, req)",
  },
  {
    name: "Validation & ValidationCheck",
    parent: "DevOpsArtifact.validation",
    cardinality: "1 : 1 & 1 : 0..N (Embedded)",
    desc: "Multi-tier syntax, structural, and schema validation diagnostics for generated Dockerfiles and YAML.",
    fields: "valid (Boolean, req), errors ([String]), warnings ([String]), checks ([ValidationCheck]), validationLevel (enum)",
  },
];

let ey = 110;
for (const emb of EMBEDDED_SPECS) {
  doc.rect(40, ey, 515, 80).fillAndStroke(C.cardBg, C.border);
  doc.rect(40, ey, 5, 80).fill(C.emerald);

  doc.fillColor(C.navy).fontSize(12).font("Helvetica-Bold").text(emb.name, 55, ey + 10);
  doc.fillColor(C.emerald).fontSize(9).font("Helvetica-Bold").text(emb.cardinality, 260, ey + 12);
  doc.fillColor(C.muted).fontSize(8.5).font("Helvetica").text(`Parent Path: ${emb.parent}`, 55, ey + 28);
  doc.fillColor(C.body).fontSize(8.5).font("Helvetica").text(emb.desc, 55, ey + 42, { width: 485 });
  doc.fillColor(C.cyan).fontSize(8).font("Helvetica-Bold").text("Fields: ", 55, ey + 62);
  doc.fillColor(C.body).fontSize(8).font("Helvetica").text(emb.fields, 95, ey + 62, { width: 445 });

  ey += 92;
}

// Add page numbers to all pages
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  const isLandscape = doc.page.layout === "landscape";
  const pW = isLandscape ? 841.89 : 595.28;
  const pH = isLandscape ? 595.28 : 841.89;

  // Footer bar
  doc.rect(40, pH - 30, pW - 80, 0.5).stroke(C.borderLight);
  doc.fillColor(C.muted).fontSize(8).font("Helvetica")
    .text("ArchMind AI • Database Architecture Specification (ERD)", 40, pH - 24);
  doc.text(`Page ${i + 1} of ${totalPages}`, pW - 120, pH - 24, { width: 80, align: "right" });
}

doc.end();

writeStream.on("finish", () => {
  const stats = fs.statSync(PDF_PATH);
  console.log(`Successfully generated PDF: ${stats.size.toLocaleString()} bytes (${totalPages} pages)`);
});

