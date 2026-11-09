# scratch/generate_erd_visuals.py
import os
import sys
from PIL import Image, ImageDraw, ImageFont

# Set up paths
DOCS_DIR = os.path.abspath("docs/database")
os.makedirs(DOCS_DIR, exist_ok=True)
SVG_PATH = os.path.join(DOCS_DIR, "ArchMindAI_ER_Diagram.svg")
PNG_PATH = os.path.join(DOCS_DIR, "ArchMindAI_ER_Diagram.png")

print(f"Generating SVG to: {SVG_PATH}")
print(f"Generating PNG to: {PNG_PATH}")

# Canvas Geometry
W = 4500
H = 3000

# Color Scheme - Dark Slate Enterprise Theme
COLORS = {
    "bg": "#0b0f19",
    "canvas_border": "#1e293b",
    "card_bg": "#111827",
    "card_inner_bg": "#182234",
    "card_border": "#374151",
    "card_border_emb": "#4b5563",
    "header_text": "#f9fafb",
    "sub_text": "#9ca3af",
    "field_name": "#e5e7eb",
    "field_type": "#93c5fd",
    "field_default": "#6ee7b7",
    "badge_pk_bg": "#b45309",
    "badge_pk_fg": "#fef3c7",
    "badge_fk_bg": "#0369a1",
    "badge_fk_fg": "#e0f2fe",
    "badge_uk_bg": "#6d28d9",
    "badge_uk_fg": "#f5f3ff",
    "badge_idx_bg": "#374151",
    "badge_idx_fg": "#d1d5db",
    "badge_req_bg": "#991b1b",
    "badge_req_fg": "#fee2e2",
    "badge_opt_bg": "#1f2937",
    "badge_opt_fg": "#9ca3af",
    "badge_emb_bg": "#065f46",
    "badge_emb_fg": "#d1fae5",
    # Module Themes
    "mod_user": "#8b5cf6",
    "mod_project": "#3b82f6",
    "mod_chat": "#10b981",
    "mod_source": "#06b6d4",
    "mod_security": "#f43f5e",
    "mod_devops": "#f59e0b",
    "mod_embedded": "#64748b",
    # Connection lines
    "line_physical": "#38bdf8",     # Cyan
    "line_logical": "#f59e0b",      # Amber (Clerk)
    "line_embedded": "#10b981",     # Emerald
    "line_assoc": "#a855f7",        # Purple
}

# Entity Definitions
# Format: { id, name, collection, category, is_embedded, parent, pos: (x, y, w, h), color, fields: [...] }
ENTITIES = [
    {
        "id": "User",
        "name": "User",
        "collection": "users",
        "category": "Authentication & Identity",
        "is_embedded": False,
        "pos": (120, 320, 720, 680),
        "color": COLORS["mod_user"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("UK", "REQ", "clerkId", "String", "Clerk Authentication ID [Indexed]", None),
            ("UK", "REQ", "email", "String", "Unique email address (lowercase, trim)", None),
            ("---", "OPT", "firstName", "String", "User given name", '""'),
            ("---", "OPT", "lastName", "String", "User family name", '""'),
            ("---", "OPT", "username", "String", "Clerk handle / username", '""'),
            ("---", "OPT", "imageUrl", "String", "Avatar image URL", '""'),
            ("---", "OPT", "lastLoginAt", "Date", "Last active session timestamp", "Date.now()"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "OPT", "__v", "Number", "Mongoose schema version key", "0"),
        ],
    },
    {
        "id": "Project",
        "name": "Project",
        "collection": "projects",
        "category": "Core Repository Intelligence",
        "is_embedded": False,
        "pos": (940, 320, 880, 1500),
        "color": COLORS["mod_project"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "userId", "String", "Clerk User ID [Logical ref User.clerkId]", None),
            ("---", "REQ", "name", "String", "Repository display / archive name", None),
            ("---", "REQ", "source", "String", "Ingestion origin enum: ['github', 'zip']", "'github'"),
            ("---", "REQ", "status", "String", "Pipeline state: ['uploaded','processing','completed','failed']", "'uploaded'"),
            ("---", "OPT", "github", "Subdocument", "{ githubId, owner, repo, fullName, url, defaultBranch, ... }", "{}"),
            ("---", "OPT", "zip", "Subdocument", "{ originalName, sizeBytes }", "{}"),
            ("EMB", "OPT", "tree", "Array<TreeNode>", "Sanitized repository file tree [1:N TreeNode]", "[]"),
            ("---", "OPT", "stats", "Subdocument", "{ totalFiles, totalDirs, totalBytes, isTruncated, topExtensions }", "{}"),
            ("---", "OPT", "techStack", "Subdocument", "{ languages: [], frameworks: [], databases: [], devops: [] }", "{}"),
            ("---", "OPT", "primaryLanguage", "String", "Dominant language identified by RIE", "null"),
            ("---", "OPT", "secondaryLanguages", "Array<String>", "Secondary detected programming languages", "[]"),
            ("---", "OPT", "languageDetectionConfidence", "Number", "Language detection confidence score [0.0 - 1.0]", "0"),
            ("---", "OPT", "topology", "Subdocument", "React Flow system graph: { nodes: [], edges: [], generatedAt }", "{}"),
            ("---", "OPT", "capabilities", "Subdocument", "{ hasDatabase, hasApis, hasDevops, hasSecuritySensitiveCode, details }", "{}"),
            ("---", "OPT", "ast", "Subdocument", "Tree-sitter structural AST: { summary, files, routes, models, ... }", "{}"),
            ("---", "OPT", "blueprint", "Subdocument", "Ground-truth LLM prompt blueprint: { version, routes, models, ... }", "{}"),
            ("---", "OPT", "database", "Subdocument", "Extracted database schema: { type, entities: [], relationships: [] }", "{}"),
            ("---", "OPT", "extractionPath", "String", "Ephemeral extraction path in server/storage/extracted", "null"),
            ("---", "OPT", "errorDetails", "Subdocument", "Failure diagnostic: { message, code, at }", "null"),
            ("---", "OPT", "analysis", "Subdocument", "Per-module state: { architecture, erd, api, security, devops }", "{}"),
            ("---", "OPT", "analysisResults", "Mixed", "Cached downstream AI analysis payloads", "null"),
            ("IDX", "OPT", "sourceFingerprint", "String", "SHA-256 fingerprint of repository content", "null"),
            ("---", "REQ", "analysisVersion", "Number", "Sequential analysis version counter", "1"),
            ("---", "OPT", "lastAnalyzedAt", "Date", "Timestamp of last analysis run", "null"),
            ("---", "OPT", "securityFindings", "Array<Object>", "Denormalized security findings projection for fast UI", "[]"),
            ("---", "OPT", "securitySummary", "Subdocument", "Aggregate severity counts { Critical, High, Medium, Low }", "{}"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "TreeNode",
        "name": "TreeNode",
        "collection": "projects.tree",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "Project",
        "pos": (940, 1900, 420, 360),
        "color": COLORS["mod_embedded"],
        "fields": [
            ("---", "REQ", "path", "String", "Relative file path from repository root", None),
            ("---", "REQ", "type", "String", "Node category enum: ['file', 'dir']", None),
            ("---", "OPT", "size", "Number", "File size in bytes", "0"),
            ("---", "OPT", "sha", "String", "Git blob SHA / file content hash", "null"),
        ],
    },
    {
        "id": "TopExtension",
        "name": "TopExtension",
        "collection": "projects.stats.topExtensions",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "Project",
        "pos": (1400, 1900, 420, 300),
        "color": COLORS["mod_embedded"],
        "fields": [
            ("---", "REQ", "extension", "String", "File extension identifier (e.g. '.js', '.py')", None),
            ("---", "REQ", "count", "Number", "Total file tally matching extension", "0"),
        ],
    },
    {
        "id": "Conversation",
        "name": "Conversation",
        "collection": "conversations",
        "category": "AI Chat & Context",
        "is_embedded": False,
        "pos": (1920, 320, 780, 560),
        "color": COLORS["mod_chat"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "userId", "String", "Clerk User ID [Logical ref User.clerkId]", None),
            ("FK", "REQ", "projectId", "ObjectId", "References Project._id [Physical ref]", None),
            ("---", "REQ", "title", "String", "Conversation header title (max 120 chars)", "'New Conversation'"),
            ("EMB", "OPT", "messages", "Array<Message>", "Embedded chronological messages [1:N Message]", "[]"),
            ("IDX", "REQ", "lastMessageAt", "Date", "Timestamp of most recent chat exchange", "Date.now()"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "Message",
        "name": "Message",
        "collection": "conversations.messages",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "Conversation",
        "pos": (1920, 950, 780, 520),
        "color": COLORS["mod_chat"],
        "fields": [
            ("---", "REQ", "messageId", "String", "Unique message UUID", None),
            ("---", "REQ", "role", "String", "Sender role enum: ['user', 'assistant']", None),
            ("---", "REQ", "content", "String", "Chat markdown prompt or LLM response text", None),
            ("EMB", "OPT", "citations", "Array<Citation>", "Line-level source citations [1:N Citation]", "[]"),
            ("---", "OPT", "metadata", "Mixed", "Model metadata, token counts, latency", "{}"),
            ("---", "REQ", "createdAt", "Date", "Message generation timestamp", "Date.now()"),
        ],
    },
    {
        "id": "Citation",
        "name": "Citation",
        "collection": "conversations.messages.citations",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "Message",
        "pos": (1920, 1530, 780, 460),
        "color": COLORS["mod_chat"],
        "fields": [
            ("---", "REQ", "filePath", "String", "Referenced repository source file path", None),
            ("---", "OPT", "startLine", "Number", "1-based source code starting line number", "null"),
            ("---", "OPT", "endLine", "Number", "1-based source code ending line number", "null"),
            ("---", "REQ", "sourceType", "String", "enum: ['source_file','blueprint','architecture','api_route','database_model','security_finding']", "'source_file'"),
            ("---", "OPT", "snippet", "String", "Exact quoted code snippet from source file", "null"),
        ],
    },
    {
        "id": "SourceFile",
        "name": "SourceFile",
        "collection": "sourcefiles",
        "category": "Code Indexing & Retrieval",
        "is_embedded": False,
        "pos": (1920, 2060, 780, 840),
        "color": COLORS["mod_source"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "projectId", "ObjectId", "References Project._id [Physical ref]", None),
            ("FK", "REQ", "userId", "String", "Clerk User ID [Logical ref User.clerkId]", None),
            ("IDX", "REQ", "analysisVersion", "Number", "Indexed repository analysis version", "1"),
            ("UK*", "REQ", "filePath", "String", "Compound unique: { projectId, filePath, version }", None),
            ("---", "REQ", "fileName", "String", "File basename with extension", None),
            ("---", "OPT", "extension", "String", "File extension (e.g. '.js', '.py')", '""'),
            ("---", "OPT", "language", "String", "Programming language identifier", "'text'"),
            ("---", "OPT", "size", "Number", "Raw file size in bytes", "0"),
            ("---", "OPT", "lineCount", "Number", "Total lines of code", "0"),
            ("---", "OPT", "contentHash", "String", "SHA-256 hash of sanitized content", '""'),
            ("---", "OPT", "content", "String", "Sanitized & secret-redacted source text", "null"),
            ("---", "OPT", "isBinary", "Boolean", "Binary file exclusion flag", "false"),
            ("---", "OPT", "symbols", "Array<String>", "Extracted symbol identifiers (functions, classes)", "[]"),
            ("EMB", "OPT", "sourceLocations", "Array<SourceLocation>", "AST symbol location index [1:N SourceLocation]", "[]"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "SourceLocation",
        "name": "SourceLocation",
        "collection": "sourcefiles.sourceLocations",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "SourceFile",
        "pos": (2800, 2300, 460, 380),
        "color": COLORS["mod_embedded"],
        "fields": [
            ("---", "REQ", "name", "String", "Symbol identifier name", None),
            ("---", "REQ", "kind", "String", "enum: ['function','class','route','model','variable','entrypoint']", None),
            ("---", "REQ", "lineStart", "Number", "1-based starting line number", None),
            ("---", "REQ", "lineEnd", "Number", "1-based ending line number", None),
        ],
    },
    {
        "id": "SecurityAudit",
        "name": "SecurityAudit",
        "collection": "securityaudits",
        "category": "Security & Compliance",
        "is_embedded": False,
        "pos": (3360, 320, 800, 860),
        "color": COLORS["mod_security"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "projectId", "ObjectId", "References Project._id [Physical ref]", None),
            ("UK*", "REQ", "analysisVersion", "Number", "Compound unique: { projectId, analysisVersion }", "1"),
            ("---", "REQ", "status", "String", "Audit lifecycle: ['pending','processing','completed','failed']", "'pending'"),
            ("---", "REQ", "startedAt", "Date", "Audit run initiation timestamp", "Date.now()"),
            ("---", "OPT", "completedAt", "Date", "Audit run completion timestamp", "null"),
            ("---", "REQ", "totalFindings", "Number", "Total security issues discovered", "0"),
            ("---", "REQ", "severityCounts", "Subdocument", "{ Critical: 0, High: 0, Medium: 0, Low: 0 }", "{}"),
            ("---", "REQ", "filesScanned", "Number", "Total files subjected to security analysis", "0"),
            ("---", "REQ", "filesSkipped", "Number", "Total files ignored due to noise filters", "0"),
            ("---", "REQ", "unsupportedFilesCount", "Number", "Count of unsupported file types", "0"),
            ("---", "OPT", "unsupportedFiles", "Array<String>", "List of skipped non-analyzable files", "[]"),
            ("---", "OPT", "scanErrors", "Array<Object>", "Scanner-specific execution diagnostics", "[]"),
            ("---", "OPT", "errors", "Array<String>", "General security pipeline error log", "[]"),
            ("---", "REQ", "scannerVersion", "String", "ArchMind security engine version", "'1.0.0'"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "SecurityFinding",
        "name": "SecurityFinding",
        "collection": "securityfindings",
        "category": "Security & Compliance",
        "is_embedded": False,
        "pos": (3360, 1250, 800, 1020),
        "color": COLORS["mod_security"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "projectId", "ObjectId", "References Project._id [Physical ref]", None),
            ("IDX", "REQ", "analysisVersion", "Number", "Linked to SecurityAudit analysisVersion", "1"),
            ("IDX", "REQ", "ruleId", "String", "Security detection rule identifier (e.g. 'SEC-001')", None),
            ("IDX", "REQ", "category", "String", "Taxonomy: 'hardcoded_secret', 'sql_injection', etc.", None),
            ("---", "REQ", "title", "String", "Concise finding title", None),
            ("---", "REQ", "description", "String", "Detailed vulnerability explanation and risk", None),
            ("IDX", "REQ", "severity", "String", "enum: ['Critical', 'High', 'Medium', 'Low']", None),
            ("---", "REQ", "confidence", "String", "enum: ['High', 'Medium', 'Low']", "'High'"),
            ("IDX", "REQ", "status", "String", "Triage status: ['open', 'resolved', 'ignored']", "'open'"),
            ("IDX", "REQ", "filePath", "String", "Repository path where vulnerability was discovered", None),
            ("---", "REQ", "startLine", "Number", "1-based starting line of vulnerable code", "1"),
            ("---", "REQ", "endLine", "Number", "1-based ending line of vulnerable code", "1"),
            ("---", "OPT", "redactedEvidence", "String", "Sanitized code excerpt with secrets stripped", '""'),
            ("---", "OPT", "maskedValue", "String", "Partially masked token (e.g. 'ghp_****')", "null"),
            ("---", "OPT", "recommendation", "String", "Prescribed architectural or code fix", '""'),
            ("IDX", "REQ", "source", "String", "enum: ['secret_scanner', 'ast_analyzer', 'ai_reviewer']", None),
            ("---", "OPT", "references", "Array<String>", "CWE, OWASP, and NIST vulnerability references", "[]"),
            ("---", "REQ", "confirmed", "Boolean", "High-confidence detection confirmation", "true"),
            ("---", "OPT", "metadata", "Mixed", "AST node coordinates, entropy scores, raw matches", "{}"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "DevOpsArtifact",
        "name": "DevOpsArtifact",
        "collection": "devopsartifacts",
        "category": "DevOps & Infrastructure",
        "is_embedded": False,
        "pos": (120, 1080, 720, 800),
        "color": COLORS["mod_devops"],
        "fields": [
            ("PK", "REQ", "_id", "ObjectId", "Auto-generated primary key", "ObjectId()"),
            ("FK", "REQ", "projectId", "ObjectId", "References Project._id [Physical ref]", None),
            ("FK", "REQ", "userId", "String", "Clerk User ID [Logical ref User.clerkId]", None),
            ("IDX", "REQ", "artifactType", "String", "enum: ['dockerfile', 'cicd', 'kubernetes']", None),
            ("---", "REQ", "filePath", "String", "Suggested path (e.g. 'Dockerfile', '.github/workflows/ci.yml')", None),
            ("---", "REQ", "content", "String", "Full text content of generated manifest", None),
            ("EMB", "REQ", "validation", "Subdocument", "Syntax & schema diagnostics [1:1 Validation]", "{...}"),
            ("IDX", "REQ", "generationStatus", "String", "enum: ['pending', 'generating', 'completed', 'failed']", "'completed'"),
            ("---", "REQ", "sourceAnalysisVersion", "Number", "Analysis baseline version used for generation", "1"),
            ("---", "REQ", "version", "Number", "Artifact revision iteration counter", "1"),
            ("---", "REQ", "superseded", "Boolean", "Flag indicating whether newer version exists", "false"),
            ("---", "OPT", "metadata", "Subdocument", "{ runtime, runtimeVersion, framework, port, provider, ... }", "{}"),
            ("---", "REQ", "createdAt", "Date", "Mongoose audit timestamp", "now"),
            ("---", "REQ", "updatedAt", "Date", "Mongoose audit timestamp", "now"),
        ],
    },
    {
        "id": "Validation",
        "name": "Validation",
        "collection": "devopsartifacts.validation",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "DevOpsArtifact",
        "pos": (120, 1950, 720, 440),
        "color": COLORS["mod_devops"],
        "fields": [
            ("---", "REQ", "valid", "Boolean", "Overall validation outcome", "true"),
            ("---", "OPT", "errors", "Array<String>", "Syntax or schema validation error messages", "[]"),
            ("---", "OPT", "warnings", "Array<String>", "Best-practice and linting warning messages", "[]"),
            ("EMB", "OPT", "checks", "Array<ValidationCheck>", "Granular validation check list [1:N ValidationCheck]", "[]"),
            ("---", "REQ", "validationLevel", "String", "enum: ['syntax', 'structural', 'schema', 'tool']", "'structural'"),
        ],
    },
    {
        "id": "ValidationCheck",
        "name": "ValidationCheck",
        "collection": "devopsartifacts.validation.checks",
        "category": "Embedded Subdocument",
        "is_embedded": True,
        "parent": "Validation",
        "pos": (120, 2460, 720, 320),
        "color": COLORS["mod_embedded"],
        "fields": [
            ("---", "REQ", "name", "String", "Rule assertion name (e.g. 'non-root-user')", None),
            ("---", "REQ", "passed", "Boolean", "Check execution outcome", None),
            ("---", "OPT", "message", "String", "Detailed diagnostic or remediation advice", '""'),
        ],
    },
]

# Relationships definition
# Types: 'physical' (Mongoose ObjectId ref), 'logical' (Clerk userId), 'embedded' (1:N or 1:1 subdoc), 'assoc' (logical run association)
RELATIONSHIPS = [
    # Logical User references
    {
        "source": "User", "target": "Project",
        "source_field": "clerkId", "target_field": "userId",
        "type": "logical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "User.clerkId -> Project.userId (Logical Clerk Partition)",
        "route": [(840, 500), (940, 500)],
    },
    {
        "source": "User", "target": "DevOpsArtifact",
        "source_field": "clerkId", "target_field": "userId",
        "type": "logical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "User.clerkId -> DevOpsArtifact.userId",
        "route": [(480, 1000), (480, 1080)],
    },
    {
        "source": "User", "target": "Conversation",
        "source_field": "clerkId", "target_field": "userId",
        "type": "logical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "User.clerkId -> Conversation.userId",
        "route": [(480, 320), (480, 260), (2200, 260), (2200, 320)],
    },
    {
        "source": "User", "target": "SourceFile",
        "source_field": "clerkId", "target_field": "userId",
        "type": "logical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "User.clerkId -> SourceFile.userId",
        "route": [(200, 1000), (200, 2860), (1920, 2860)],
    },

    # Physical Project references
    {
        "source": "Project", "target": "Conversation",
        "source_field": "_id", "target_field": "projectId",
        "type": "physical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "Project._id -> Conversation.projectId (Mongoose ref)",
        "route": [(1820, 480), (1920, 480)],
    },
    {
        "source": "Project", "target": "SourceFile",
        "source_field": "_id", "target_field": "projectId",
        "type": "physical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "Project._id -> SourceFile.projectId (Mongoose ref)",
        "route": [(1820, 1400), (1880, 1400), (1880, 2200), (1920, 2200)],
    },
    {
        "source": "Project", "target": "SecurityAudit",
        "source_field": "_id", "target_field": "projectId",
        "type": "physical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "Project._id -> SecurityAudit.projectId (Mongoose ref)",
        "route": [(1820, 400), (3300, 400), (3360, 400)],
    },
    {
        "source": "Project", "target": "SecurityFinding",
        "source_field": "_id", "target_field": "projectId",
        "type": "physical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "Project._id -> SecurityFinding.projectId (Mongoose ref)",
        "route": [(1820, 1150), (3300, 1150), (3300, 1350), (3360, 1350)],
    },
    {
        "source": "Project", "target": "DevOpsArtifact",
        "source_field": "_id", "target_field": "projectId",
        "type": "physical", "cardinality": "1 : 0..N", "crow": "one_to_many",
        "label": "Project._id -> DevOpsArtifact.projectId (Mongoose ref)",
        "route": [(940, 1200), (840, 1200)],
    },

    # Embedded relationships
    {
        "source": "Project", "target": "TreeNode",
        "source_field": "tree", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "Project.tree [Embedded 1:N]",
        "route": [(1150, 1820), (1150, 1900)],
    },
    {
        "source": "Project", "target": "TopExtension",
        "source_field": "stats.topExtensions", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "Project.stats.topExtensions [Embedded 1:N]",
        "route": [(1610, 1820), (1610, 1900)],
    },
    {
        "source": "Conversation", "target": "Message",
        "source_field": "messages", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "Conversation.messages [Embedded 1:N]",
        "route": [(2310, 880), (2310, 950)],
    },
    {
        "source": "Message", "target": "Citation",
        "source_field": "citations", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "Message.citations [Embedded 1:N]",
        "route": [(2310, 1470), (2310, 1530)],
    },
    {
        "source": "SourceFile", "target": "SourceLocation",
        "source_field": "sourceLocations", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "SourceFile.sourceLocations [Embedded 1:N]",
        "route": [(2700, 2450), (2800, 2450)],
    },
    {
        "source": "DevOpsArtifact", "target": "Validation",
        "source_field": "validation", "target_field": None,
        "type": "embedded", "cardinality": "1 : 1 (embedded)", "crow": "one_to_one",
        "label": "DevOpsArtifact.validation [Embedded 1:1]",
        "route": [(480, 1880), (480, 1950)],
    },
    {
        "source": "Validation", "target": "ValidationCheck",
        "source_field": "checks", "target_field": None,
        "type": "embedded", "cardinality": "1 : 0..N (embedded)", "crow": "one_to_many",
        "label": "Validation.checks [Embedded 1:N]",
        "route": [(480, 2390), (480, 2460)],
    },
    {
        "source": "SecurityAudit", "target": "SecurityFinding",
        "source_field": "projectId + analysisVersion", "target_field": "projectId + analysisVersion",
        "type": "assoc", "cardinality": "1 : 0..N (audit version)", "crow": "one_to_many",
        "label": "Audit Run Findings Association (projectId + analysisVersion)",
        "route": [(3760, 1180), (3760, 1250)],
    },
]

# Helper to draw SVG
def build_svg():
    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    svg.append('<defs>')
    # Drop shadow filter
    svg.append('''
        <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">
            <feGaussianBlur in="SourceAlpha" stdDeviation="12"/>
            <feOffset dx="0" dy="8" result="offsetblur"/>
            <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMergeNode>
        </filter>
        <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="glow"/>
            <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMergeNode>
        </filter>
    ''')
    # Markers for Crow's Foot
    # 1: Many (Crow's foot prong)
    svg.append('''
        <marker id="crow-many-cyan" markerWidth="24" markerHeight="24" refX="22" refY="12" orient="auto">
            <path d="M 2,2 L 22,12 L 2,22 M 22,2 L 22,22" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
        </marker>
        <marker id="crow-many-amber" markerWidth="24" markerHeight="24" refX="22" refY="12" orient="auto">
            <path d="M 2,2 L 22,12 L 2,22 M 22,2 L 22,22" fill="none" stroke="#f59e0b" stroke-width="2.5"/>
        </marker>
        <marker id="crow-many-green" markerWidth="24" markerHeight="24" refX="22" refY="12" orient="auto">
            <path d="M 2,2 L 22,12 L 2,22 M 22,2 L 22,22" fill="none" stroke="#10b981" stroke-width="2.5"/>
        </marker>
        <marker id="crow-one-cyan" markerWidth="20" markerHeight="20" refX="10" refY="10" orient="auto">
            <line x1="10" y1="2" x2="10" y2="18" stroke="#38bdf8" stroke-width="2.5"/>
            <line x1="16" y1="2" x2="16" y2="18" stroke="#38bdf8" stroke-width="2.5"/>
        </marker>
        <marker id="circle-zero" markerWidth="16" markerHeight="16" refX="8" refY="8" orient="auto">
            <circle cx="8" cy="8" r="5" fill="#111827" stroke="#38bdf8" stroke-width="2"/>
        </marker>
    ''')
    svg.append('</defs>')

    # Background
    svg.append(f'<rect width="{W}" height="{H}" fill="{COLORS["bg"]}"/>')

    # Grid Pattern (Subtle)
    for x in range(0, W, 80):
        svg.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="#161f30" stroke-width="1"/>')
    for y in range(0, H, 80):
        svg.append(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="#161f30" stroke-width="1"/>')

    # Header Title Banner
    svg.append(f'''
    <g id="header-banner">
        <rect x="120" y="50" width="2200" height="190" rx="16" fill="#111827" stroke="#374151" stroke-width="2" filter="url(#shadow)"/>
        <text x="160" y="115" font-family="'Segoe UI', Roboto, sans-serif" font-size="42" font-weight="bold" fill="#f9fafb" letter-spacing="1">
            ArchMind AI — Platform Database Architecture
        </text>
        <text x="160" y="160" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="normal" fill="#38bdf8">
            Complete Entity Relationship Diagram (ERD) • 7 MongoDB Collections • 6 Embedded Subdocuments
        </text>
        <text x="160" y="200" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" fill="#9ca3af">
            Engine: MongoDB Atlas + Mongoose ODM | Authentication: Clerk Multi-Tenant (User.clerkId Partitioning) | Crow's Foot Notation
        </text>
    </g>
    ''')

    # Notation Legend
    svg.append(f'''
    <g id="legend-box">
        <rect x="2380" y="50" width="1780" height="190" rx="16" fill="#111827" stroke="#374151" stroke-width="2" filter="url(#shadow)"/>
        <text x="2410" y="90" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold" fill="#f9fafb">
            ERD NOTATION &amp; RELATIONSHIP LEGEND
        </text>
        
        <!-- Legend Items Row 1 -->
        <rect x="2410" y="115" width="45" height="24" rx="6" fill="{COLORS['badge_pk_bg']}"/>
        <text x="2422" y="132" font-family="Consolas, monospace" font-size="13" font-weight="bold" fill="{COLORS['badge_pk_fg']}">PK</text>
        <text x="2465" y="132" font-family="'Segoe UI', sans-serif" font-size="15" fill="#d1d5db">Primary Key (_id ObjectId)</text>

        <rect x="2720" y="115" width="45" height="24" rx="6" fill="{COLORS['badge_fk_bg']}"/>
        <text x="2732" y="132" font-family="Consolas, monospace" font-size="13" font-weight="bold" fill="{COLORS['badge_fk_fg']}">FK</text>
        <text x="2775" y="132" font-family="'Segoe UI', sans-serif" font-size="15" fill="#d1d5db">Foreign Key / ObjectId Ref</text>

        <rect x="3060" y="115" width="45" height="24" rx="6" fill="{COLORS['badge_uk_bg']}"/>
        <text x="3072" y="132" font-family="Consolas, monospace" font-size="13" font-weight="bold" fill="{COLORS['badge_uk_fg']}">UK</text>
        <text x="3115" y="132" font-family="'Segoe UI', sans-serif" font-size="15" fill="#d1d5db">Unique Key Index</text>

        <rect x="3330" y="115" width="52" height="24" rx="6" fill="{COLORS['badge_emb_bg']}"/>
        <text x="3340" y="132" font-family="Consolas, monospace" font-size="13" font-weight="bold" fill="{COLORS['badge_emb_fg']}">EMB</text>
        <text x="3392" y="132" font-family="'Segoe UI', sans-serif" font-size="15" fill="#d1d5db">Embedded Subdocument</text>

        <!-- Legend Items Row 2: Relationship Types -->
        <line x1="2410" y1="180" x2="2490" y2="180" stroke="{COLORS['line_physical']}" stroke-width="3.5"/>
        <text x="2505" y="185" font-family="'Segoe UI', sans-serif" font-size="15" fill="#38bdf8">Physical Mongoose Ref (1:N)</text>

        <line x1="2790" y1="180" x2="2870" y2="180" stroke="{COLORS['line_logical']}" stroke-width="3" stroke-dasharray="7 5"/>
        <text x="2885" y="185" font-family="'Segoe UI', sans-serif" font-size="15" fill="#f59e0b">Logical Clerk User Ref</text>

        <line x1="3120" y1="180" x2="3200" y2="180" stroke="{COLORS['line_embedded']}" stroke-width="3"/>
        <text x="3215" y="185" font-family="'Segoe UI', sans-serif" font-size="15" fill="#10b981">Embedded Subdoc (1:N / 1:1)</text>

        <line x1="3510" y1="180" x2="3590" y2="180" stroke="{COLORS['line_assoc']}" stroke-width="2.5" stroke-dasharray="4 4"/>
        <text x="3605" y="185" font-family="'Segoe UI', sans-serif" font-size="15" fill="#a855f7">Logical Run Association</text>
    </g>
    ''')

    # Draw Relationship Lines First (so they sit beneath cards)
    for rel in RELATIONSHIPS:
        color = COLORS["line_physical"]
        marker_end = "crow-many-cyan"
        dash = ""
        if rel["type"] == "logical":
            color = COLORS["line_logical"]
            marker_end = "crow-many-amber"
            dash = 'stroke-dasharray="8 6"'
        elif rel["type"] == "embedded":
            color = COLORS["line_embedded"]
            marker_end = "crow-many-green"
        elif rel["type"] == "assoc":
            color = COLORS["line_assoc"]
            marker_end = ""
            dash = 'stroke-dasharray="5 5"'

        route = rel["route"]
        path_d = f"M {route[0][0]} {route[0][1]}"
        for pt in route[1:]:
            path_d += f" L {pt[0]} {pt[1]}"

        marker_attr = f'marker-end="url(#{marker_end})"' if marker_end else ""
        svg.append(f'<path d="{path_d}" fill="none" stroke="{color}" stroke-width="3.5" {dash} {marker_attr} stroke-linejoin="round"/>')

        # Add label along midpoint of route
        mid_idx = len(route) // 2
        p1 = route[mid_idx - 1]
        p2 = route[mid_idx]
        mid_x = (p1[0] + p2[0]) / 2
        mid_y = (p1[1] + p2[1]) / 2 - 10
        svg.append(f'''
            <text x="{mid_x}" y="{mid_y}" font-family="'Segoe UI', sans-serif" font-size="13" font-weight="bold" fill="{color}" text-anchor="middle"
                  style="paint-order: stroke; stroke: #0b0f19; stroke-width: 5px; stroke-linejoin: round;">
                {rel['cardinality']}
            </text>
        ''')

    # Draw Entity Cards
    for entity in ENTITIES:
        ex, ey, ew, eh = entity["pos"]
        is_emb = entity["is_embedded"]
        color = entity["color"]
        border_stroke = color if not is_emb else COLORS["card_border_emb"]
        stroke_dash = 'stroke-dasharray="7 5"' if is_emb else ''

        svg.append(f'<g id="entity-{entity["id"]}">')
        # Card background & border
        svg.append(f'''
            <rect x="{ex}" y="{ey}" width="{ew}" height="{eh}" rx="14" fill="{COLORS['card_bg']}"
                  stroke="{border_stroke}" stroke-width="{2.5 if not is_emb else 2}" {stroke_dash} filter="url(#shadow)"/>
        ''')

        # Card Header
        header_h = 75
        svg.append(f'''
            <path d="M {ex} {ey+14} A 14 14 0 0 1 {ex+14} {ey} L {ex+ew-14} {ey} A 14 14 0 0 1 {ex+ew} {ey+14} L {ex+ew} {ey+header_h} L {ex} {ey+header_h} Z"
                  fill="{color}" opacity="0.95"/>
            <text x="{ex+24}" y="{ey+36}" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">
                {entity['name']}
            </text>
            <text x="{ex+24}" y="{ey+60}" font-family="'Segoe UI', sans-serif" font-size="14" fill="#f1f5f9" opacity="0.9">
                {'[Embedded Subdocument]' if is_emb else f'Collection: {entity["collection"]}'} • {entity['category']}
            </text>
        ''')

        # Table Sub-header Row
        col_y = ey + header_h + 30
        svg.append(f'''
            <rect x="{ex+12}" y="{ey+header_h+6}" width="{ew-24}" height="32" rx="6" fill="#182234"/>
            <text x="{ex+24}" y="{col_y-8}" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#9ca3af">KEY</text>
            <text x="{ex+90}" y="{col_y-8}" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#9ca3af">NULL</text>
            <text x="{ex+160}" y="{col_y-8}" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#9ca3af">ATTRIBUTE / FIELD</text>
            <text x="{ex+440}" y="{col_y-8}" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#9ca3af">TYPE</text>
            <text x="{ex+650}" y="{col_y-8}" font-family="Consolas, monospace" font-size="12" font-weight="bold" fill="#9ca3af">DEFAULT / NOTES</text>
            <line x1="{ex+12}" y1="{ey+header_h+38}" x2="{ex+ew-12}" y2="{ey+header_h+38}" stroke="#2d3748" stroke-width="1.5"/>
        ''')

        # Field Rows
        row_y = ey + header_h + 58
        row_height = 36
        for f_idx, field in enumerate(entity["fields"]):
            k_type, req, name, f_type, desc, def_val = field
            current_y = row_y + f_idx * row_height

            # Alternate row background
            if f_idx % 2 == 1:
                svg.append(f'<rect x="{ex+12}" y="{current_y-20}" width="{ew-24}" height="{row_height}" rx="4" fill="#141c2c" opacity="0.6"/>')

            # Key Badge
            if k_type != "---":
                b_bg = COLORS["badge_pk_bg"] if "PK" in k_type else (
                    COLORS["badge_fk_bg"] if "FK" in k_type else (
                        COLORS["badge_uk_bg"] if "UK" in k_type else (
                            COLORS["badge_emb_bg"] if "EMB" in k_type else COLORS["badge_idx_bg"]
                        )
                    )
                )
                b_fg = COLORS["badge_pk_fg"] if "PK" in k_type else (
                    COLORS["badge_fk_fg"] if "FK" in k_type else (
                        COLORS["badge_uk_fg"] if "UK" in k_type else (
                            COLORS["badge_emb_fg"] if "EMB" in k_type else COLORS["badge_idx_fg"]
                        )
                    )
                )
                svg.append(f'''
                    <rect x="{ex+22}" y="{current_y-14}" width="48" height="20" rx="4" fill="{b_bg}"/>
                    <text x="{ex+46}" y="{current_y}" font-family="Consolas, monospace" font-size="11" font-weight="bold" fill="{b_fg}" text-anchor="middle">{k_type}</text>
                ''')

            # Required / Optional
            r_bg = COLORS["badge_req_bg"] if req == "REQ" else COLORS["badge_opt_bg"]
            r_fg = COLORS["badge_req_fg"] if req == "REQ" else COLORS["badge_opt_fg"]
            svg.append(f'''
                <rect x="{ex+85}" y="{current_y-14}" width="44" height="20" rx="4" fill="{r_bg}"/>
                <text x="{ex+107}" y="{current_y}" font-family="Consolas, monospace" font-size="10" font-weight="bold" fill="{r_fg}" text-anchor="middle">{req}</text>
            ''')

            # Field Name
            name_weight = "bold" if k_type != "---" or req == "REQ" else "normal"
            name_color = "#ffffff" if k_type != "---" else COLORS["field_name"]
            svg.append(f'''
                <text x="{ex+160}" y="{current_y}" font-family="'Segoe UI', Consolas, sans-serif" font-size="14" font-weight="{name_weight}" fill="{name_color}">{name}</text>
            ''')

            # Field Type
            svg.append(f'''
                <text x="{ex+440}" y="{current_y}" font-family="Consolas, monospace" font-size="13" font-weight="bold" fill="{COLORS['field_type']}">{f_type}</text>
            ''')

            # Default / Notes
            notes_str = f"def: {def_val}" if def_val else (desc if desc else "")
            if len(notes_str) > 36:
                notes_str = notes_str[:34] + "…"
            svg.append(f'''
                <text x="{ex+650}" y="{current_y}" font-family="'Segoe UI', sans-serif" font-size="12" fill="{COLORS['field_default'] if def_val else '#9ca3af'}">{notes_str}</text>
            ''')

        svg.append('</g>')

    svg.append('</svg>')
    return '\n'.join(svg)

# Write SVG
svg_content = build_svg()
with open(SVG_PATH, "w", encoding="utf-8") as f:
    f.write(svg_content)
print(f"Successfully generated SVG: {os.path.getsize(SVG_PATH):,} bytes")

# Build PNG using PIL (Pillow) at High Resolution
def render_png():
    print("Rendering High-Resolution PNG via Pillow...")
    img = Image.new("RGB", (W, H), color=COLORS["bg"])
    draw = ImageDraw.Draw(img)

    # Load System Fonts
    try:
        font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 44)
        font_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
        font_caption = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
        font_card_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 22)
        font_card_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14)
        font_col_header = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 13)
        font_field_name = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
        font_field_name_reg = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
        font_field_type = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 13)
        font_badge = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 11)
        font_notes = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
        font_rel_label = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 14)
    except Exception as e:
        print(f"Warning font load fallback: {e}")
        font_title = font_sub = font_caption = font_card_title = font_card_sub = ImageFont.load_default()
        font_col_header = font_field_name = font_field_name_reg = font_field_type = font_badge = font_notes = font_rel_label = ImageFont.load_default()

    # Draw Grid
    for x in range(0, W, 80):
        draw.line([(x, 0), (x, H)], fill="#161f30", width=1)
    for y in range(0, H, 80):
        draw.line([(0, y), (W, y)], fill="#161f30", width=1)

    # Draw Header Banner
    draw.rounded_rectangle([120, 50, 2320, 240], radius=16, fill="#111827", outline="#374151", width=2)
    draw.text((160, 75), "ArchMind AI — Platform Database Architecture", fill="#f9fafb", font=font_title)
    draw.text((160, 135), "Complete Entity Relationship Diagram (ERD) • 7 MongoDB Collections • 6 Embedded Subdocuments", fill="#38bdf8", font=font_sub)
    draw.text((160, 185), "Engine: MongoDB Atlas + Mongoose ODM | Authentication: Clerk Multi-Tenant (User.clerkId Partitioning) | Crow's Foot Notation", fill="#9ca3af", font=font_caption)

    # Draw Legend Box
    draw.rounded_rectangle([2380, 50, 4160, 240], radius=16, fill="#111827", outline="#374151", width=2)
    draw.text((2410, 72), "ERD NOTATION & RELATIONSHIP LEGEND", fill="#f9fafb", font=font_card_title)

    # Legend Row 1
    draw.rounded_rectangle([2410, 115, 2455, 139], radius=6, fill=COLORS["badge_pk_bg"])
    draw.text((2422, 118), "PK", fill=COLORS["badge_pk_fg"], font=font_badge)
    draw.text((2465, 118), "Primary Key (_id ObjectId)", fill="#d1d5db", font=font_card_sub)

    draw.rounded_rectangle([2720, 115, 2765, 139], radius=6, fill=COLORS["badge_fk_bg"])
    draw.text((2732, 118), "FK", fill=COLORS["badge_fk_fg"], font=font_badge)
    draw.text((2775, 118), "Foreign Key / ObjectId Ref", fill="#d1d5db", font=font_card_sub)

    draw.rounded_rectangle([3060, 115, 3105, 139], radius=6, fill=COLORS["badge_uk_bg"])
    draw.text((3072, 118), "UK", fill=COLORS["badge_uk_fg"], font=font_badge)
    draw.text((3115, 118), "Unique Key Index", fill="#d1d5db", font=font_card_sub)

    draw.rounded_rectangle([3330, 115, 3382, 139], radius=6, fill=COLORS["badge_emb_bg"])
    draw.text((3340, 118), "EMB", fill=COLORS["badge_emb_fg"], font=font_badge)
    draw.text((3392, 118), "Embedded Subdocument", fill="#d1d5db", font=font_card_sub)

    # Legend Row 2
    draw.line([(2410, 185), (2490, 185)], fill=COLORS["line_physical"], width=4)
    draw.text((2505, 175), "Physical Mongoose Ref (1:N)", fill="#38bdf8", font=font_card_sub)

    draw.line([(2790, 185), (2870, 185)], fill=COLORS["line_logical"], width=3)
    draw.text((2885, 175), "Logical Clerk User Ref (1:N)", fill="#f59e0b", font=font_card_sub)

    draw.line([(3140, 185), (3220, 185)], fill=COLORS["line_embedded"], width=3)
    draw.text((3235, 175), "Embedded Subdoc (1:N / 1:1)", fill="#10b981", font=font_card_sub)

    draw.line([(3520, 185), (3600, 185)], fill=COLORS["line_assoc"], width=2)
    draw.text((3615, 175), "Logical Run Association", fill="#a855f7", font=font_card_sub)

    # Draw Relationship Lines
    for rel in RELATIONSHIPS:
        color = COLORS["line_physical"]
        if rel["type"] == "logical":
            color = COLORS["line_logical"]
        elif rel["type"] == "embedded":
            color = COLORS["line_embedded"]
        elif rel["type"] == "assoc":
            color = COLORS["line_assoc"]

        route = rel["route"]
        for i in range(len(route) - 1):
            draw.line([route[i], route[i+1]], fill=color, width=4)

        # Draw Crow's Foot marker at destination
        end_pt = route[-1]
        prev_pt = route[-2]
        dx = end_pt[0] - prev_pt[0]
        dy = end_pt[1] - prev_pt[1]
        # Normalize
        length = (dx*dx + dy*dy)**0.5 or 1
        ux = dx / length
        uy = dy / length
        perp_x = -uy
        perp_y = ux

        # Draw 3 prongs for Crow's foot
        base_x = end_pt[0] - ux * 18
        base_y = end_pt[1] - uy * 18
        p1 = (base_x + perp_x * 12, base_y + perp_y * 12)
        p2 = (base_x - perp_x * 12, base_y - perp_y * 12)
        draw.line([p1, end_pt], fill=color, width=3)
        draw.line([p2, end_pt], fill=color, width=3)
        draw.line([(base_x, base_y), end_pt], fill=color, width=3)

        # Label
        mid_idx = len(route) // 2
        p1_r = route[mid_idx - 1]
        p2_r = route[mid_idx]
        mid_x = (p1_r[0] + p2_r[0]) / 2 - 25
        mid_y = (p1_r[1] + p2_r[1]) / 2 - 18
        draw.text((mid_x, mid_y), rel["cardinality"], fill=color, font=font_rel_label)

    # Draw Entity Cards
    for entity in ENTITIES:
        ex, ey, ew, eh = entity["pos"]
        is_emb = entity["is_embedded"]
        color = entity["color"]
        border_stroke = color if not is_emb else COLORS["card_border_emb"]

        # Card base
        draw.rounded_rectangle([ex, ey, ex + ew, ey + eh], radius=14, fill=COLORS["card_bg"], outline=border_stroke, width=2)

        # Header
        header_h = 75
        draw.rounded_rectangle([ex, ey, ex + ew, ey + header_h], radius=14, fill=color)
        draw.rectangle([ex, ey + 25, ex + ew, ey + header_h], fill=color)  # Square lower corners of header
        draw.text((ex + 24, ey + 14), entity["name"], fill="#ffffff", font=font_card_title)
        sub_title = "[Embedded Subdocument]" if is_emb else f"Collection: {entity['collection']}"
        draw.text((ex + 24, ey + 44), f"{sub_title} • {entity['category']}", fill="#f1f5f9", font=font_card_sub)

        # Table Column Headers
        col_y = ey + header_h + 10
        draw.rounded_rectangle([ex + 12, col_y, ex + ew - 12, col_y + 28], radius=6, fill="#182234")
        draw.text((ex + 24, col_y + 6), "KEY", fill="#9ca3af", font=font_col_header)
        draw.text((ex + 90, col_y + 6), "NULL", fill="#9ca3af", font=font_col_header)
        draw.text((ex + 160, col_y + 6), "ATTRIBUTE / FIELD", fill="#9ca3af", font=font_col_header)
        draw.text((ex + 440, col_y + 6), "TYPE", fill="#9ca3af", font=font_col_header)
        draw.text((ex + 650, col_y + 6), "DEFAULT / NOTES", fill="#9ca3af", font=font_col_header)

        # Field Rows
        row_y = col_y + 36
        row_height = 36
        for f_idx, field in enumerate(entity["fields"]):
            k_type, req, name, f_type, desc, def_val = field
            current_y = row_y + f_idx * row_height

            if f_idx % 2 == 1:
                draw.rounded_rectangle([ex + 12, current_y - 6, ex + ew - 12, current_y + 26], radius=4, fill="#141c2c")

            # Key Badge
            if k_type != "---":
                b_bg = COLORS["badge_pk_bg"] if "PK" in k_type else (
                    COLORS["badge_fk_bg"] if "FK" in k_type else (
                        COLORS["badge_uk_bg"] if "UK" in k_type else (
                            COLORS["badge_emb_bg"] if "EMB" in k_type else COLORS["badge_idx_bg"]
                        )
                    )
                )
                b_fg = COLORS["badge_pk_fg"] if "PK" in k_type else (
                    COLORS["badge_fk_fg"] if "FK" in k_type else (
                        COLORS["badge_uk_fg"] if "UK" in k_type else (
                            COLORS["badge_emb_fg"] if "EMB" in k_type else COLORS["badge_idx_fg"]
                        )
                    )
                )
                draw.rounded_rectangle([ex + 22, current_y - 2, ex + 70, current_y + 18], radius=4, fill=b_bg)
                draw.text((ex + 30, current_y), k_type, fill=b_fg, font=font_badge)

            # Req / Opt Badge
            r_bg = COLORS["badge_req_bg"] if req == "REQ" else COLORS["badge_opt_bg"]
            r_fg = COLORS["badge_req_fg"] if req == "REQ" else COLORS["badge_opt_fg"]
            draw.rounded_rectangle([ex + 85, current_y - 2, ex + 130, current_y + 18], radius=4, fill=r_bg)
            draw.text((ex + 93, current_y + 1), req, fill=r_fg, font=font_badge)

            # Field Name
            f_font = font_field_name if (k_type != "---" or req == "REQ") else font_field_name_reg
            f_color = "#ffffff" if k_type != "---" else COLORS["field_name"]
            draw.text((ex + 160, current_y), name, fill=f_color, font=f_font)

            # Field Type
            draw.text((ex + 440, current_y + 1), f_type, fill=COLORS["field_type"], font=font_field_type)

            # Notes
            notes_str = f"def: {def_val}" if def_val else (desc if desc else "")
            if len(notes_str) > 36:
                notes_str = notes_str[:34] + "…"
            n_color = COLORS["field_default"] if def_val else "#9ca3af"
            draw.text((ex + 650, current_y + 2), notes_str, fill=n_color, font=font_notes)

    # Save PNG
    img.save(PNG_PATH, "PNG", dpi=(300, 300))
    print(f"Successfully generated PNG: {os.path.getsize(PNG_PATH):,} bytes")

render_png()
print("All ERD visuals created successfully!")

