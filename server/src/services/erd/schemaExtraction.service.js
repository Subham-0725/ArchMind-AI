// server/src/services/erd/schemaExtraction.service.js
//
// Schema Extraction & ERD Generation Service for ArchMind AI
// Dynamically inspects registered Mongoose models, schemas, subdocuments,
// indexes, references, and constraints to generate a complete, accurate ERD.

import mongoose from "mongoose";

// Ensure all platform models are registered in Mongoose
import User from "../../models/User.js";
import Project from "../../models/Project.js";
import Conversation from "../../models/Conversation.js";
import SecurityAudit from "../../models/SecurityAudit.js";
import SecurityFinding from "../../models/SecurityFinding.js";
import SourceFile from "../../models/SourceFile.js";
import DevOpsArtifact from "../../models/DevOpsArtifact.js";

/**
 * Architectural documentation and metadata for ArchMind AI database collections
 */
const ENTITY_METADATA = {
  User: {
    collectionName: "users",
    description: "Stores user account profiles, Clerk authentication mappings, identity details, and login audit timestamps.",
    category: "Authentication & Identity",
  },
  Project: {
    collectionName: "projects",
    description: "Central repository metadata hub storing file trees, tech stack, topology graphs, and multi-module analysis states.",
    category: "Core Repository Intelligence",
  },
  Conversation: {
    collectionName: "conversations",
    description: "Repository AI chat conversations preserving prompt histories, token metadata, and verified line-level source code citations.",
    category: "AI Chat & Context",
  },
  SecurityAudit: {
    collectionName: "securityaudits",
    description: "Persistent security audit run metadata tracking scan coverage, severity tallies, scanner versions, and unsupported files.",
    category: "Security & Compliance",
  },
  SecurityFinding: {
    collectionName: "securityfindings",
    description: "Deterministic secret detections, Tree-sitter AST security vulnerabilities, and AI code review findings with redacted evidence.",
    category: "Security & Compliance",
  },
  SourceFile: {
    collectionName: "sourcefiles",
    description: "Indexed source file storage separate from the Project document to prevent MongoDB's 16MB document limit and enable citations.",
    category: "Code Indexing & Retrieval",
  },
  DevOpsArtifact: {
    collectionName: "devopsartifacts",
    description: "Persistent Dockerfiles, CI/CD pipeline workflows, and Kubernetes manifests generated from repository intelligence.",
    category: "DevOps & Infrastructure",
  },
};

/**
 * Metadata for embedded schemas inside ArchMind AI documents
 */
const EMBEDDED_ENTITY_METADATA = {
  TreeNode: {
    parentEntity: "Project",
    parentField: "tree",
    description: "Embedded repository file tree node representing a file or directory with path, size, and SHA.",
  },
  TopExtension: {
    parentEntity: "Project",
    parentField: "stats.topExtensions",
    description: "Embedded file extension breakdown tally compiled during repository scanning.",
  },
  Message: {
    parentEntity: "Conversation",
    parentField: "messages",
    description: "Chronological chat message document containing role, text content, metadata, and citation references.",
  },
  Citation: {
    parentEntity: "Conversation",
    parentField: "messages.citations",
    description: "Ground-truth source code citation linking chat responses to exact file paths and line ranges.",
  },
  SourceLocation: {
    parentEntity: "SourceFile",
    parentField: "sourceLocations",
    description: "Symbol location index mapping functions, classes, routes, and models to line spans in source code.",
  },
  Validation: {
    parentEntity: "DevOpsArtifact",
    parentField: "validation",
    description: "Multi-tier syntax, structural, and schema validation diagnostics for generated DevOps manifests.",
  },
  ValidationCheck: {
    parentEntity: "DevOpsArtifact",
    parentField: "validation.checks",
    description: "Granular validation check asserting structural compliance for Docker, CI/CD, or Kubernetes.",
  },
};

/**
 * Maps Mongoose SchemaType instances to standard ERD data types
 */
function normalizeType(schemaType) {
  if (!schemaType) return "Mixed";

  const instance = schemaType.instance || schemaType.name;

  if (instance === "ObjectID" || instance === "ObjectId") return "ObjectId";
  if (instance === "String") return "String";
  if (instance === "Number") return "Number";
  if (instance === "Boolean") return "Boolean";
  if (instance === "Date") return "Date";
  if (instance === "Buffer") return "Buffer";
  if (instance === "Map") return "Map<String>";

  if (instance === "Array") {
    if (schemaType.schema) {
      return "Array<EmbeddedDocument>";
    }
    if (schemaType.caster) {
      const inner = normalizeType(schemaType.caster);
      return `Array<${inner}>`;
    }
    return "Array<Mixed>";
  }

  if (instance === "Embedded") return "Embedded Document";
  if (instance === "Mixed") return "Mixed";

  return instance || "Mixed";
}

/**
 * Formats a default value into a readable string
 */
function formatDefault(def) {
  if (def === undefined) return null;
  if (typeof def === "function") {
    if (def.name === "now" || def === Date.now) return "Date.now()";
    return def.name ? `${def.name}()` : "Function()";
  }
  if (typeof def === "object" && def !== null) {
    if (Array.isArray(def)) return def.length === 0 ? "[]" : JSON.stringify(def);
    return Object.keys(def).length === 0 ? "{}" : JSON.stringify(def);
  }
  return String(def);
}

/**
 * Discovers unique fields from schema options and model indexes
 */
function getUniqueFields(model) {
  const uniqueSet = new Set();
  const indexes = model.schema.indexes();

  for (const [fields, options] of indexes) {
    if (options && options.unique) {
      const keys = Object.keys(fields);
      if (keys.length === 1) {
        uniqueSet.add(keys[0]);
      }
    }
  }

  // Also check individual path options
  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (schemaType.options?.unique) {
      uniqueSet.add(pathName);
    }
  }

  return uniqueSet;
}

/**
 * Extracts top-level fields and notable embedded structures for a Mongoose model
 */
function extractModelFields(model, modelName) {
  const fields = [];
  const uniqueFields = getUniqueFields(model);
  const paths = model.schema.paths;
  const processedTopPaths = new Set();

  // Always ensure _id is first
  if (paths._id) {
    fields.push({
      name: "_id",
      type: "ObjectId",
      primaryKey: true,
      foreignKey: false,
      required: true,
      unique: true,
      indexed: true,
      defaultValue: "ObjectId()",
      enumValues: null,
      description: `Primary Key for ${modelName}`,
      isEmbedded: false,
    });
    processedTopPaths.add("_id");
  }

  // Collect top-level fields
  for (const [pathName, schemaType] of Object.entries(paths)) {
    if (pathName === "_id" || pathName === "__v") continue;

    // Split for top-level detection
    const parts = pathName.split(".");
    const topName = parts[0];

    // If it's a deep path (e.g. github.owner) and we haven't created the top-level parent yet
    if (parts.length > 1) {
      if (!processedTopPaths.has(topName)) {
        processedTopPaths.add(topName);
        const isArray = model.schema.nested[topName] === undefined && Array.isArray(model.schema.obj[topName]);
        fields.push({
          name: topName,
          type: isArray ? "Array<EmbeddedDocument>" : "Embedded Document",
          primaryKey: false,
          foreignKey: false,
          required: false,
          unique: false,
          indexed: false,
          defaultValue: isArray ? "[]" : "{}",
          enumValues: null,
          description: `Embedded structure containing ${topName} attributes`,
          isEmbedded: true,
        });
      }
      continue;
    }

    processedTopPaths.add(pathName);

    const ref = schemaType.options?.ref || schemaType.caster?.options?.ref;
    const isRequired = Boolean(
      schemaType.options?.required &&
      (typeof schemaType.options.required === "boolean" || typeof schemaType.options.required === "string" || Array.isArray(schemaType.options.required))
    );
    const isUnique = uniqueFields.has(pathName) || schemaType.options?.unique === true;
    const isIndexed = schemaType.options?.index === true || isUnique;
    const enumValues = schemaType.options?.enum || schemaType.enumValues || null;
    const normalizedType = normalizeType(schemaType);

    // Identify foreign key
    let foreignKey = Boolean(ref);
    let references = null;

    if (ref) {
      references = {
        entity: ref,
        field: "_id",
        type: "physical",
        enforcedBy: "Mongoose ref",
      };
    } else if (pathName === "userId" && modelName !== "User") {
      foreignKey = true;
      references = {
        entity: "User",
        field: "clerkId",
        type: "logical",
        enforcedBy: "Clerk Authentication / Multi-Tenant Isolation",
      };
    }

    fields.push({
      name: pathName,
      type: normalizedType,
      primaryKey: false,
      foreignKey,
      references,
      required: isRequired,
      unique: isUnique,
      indexed: isIndexed,
      defaultValue: formatDefault(schemaType.options?.default),
      enumValues: Array.isArray(enumValues) ? enumValues : null,
      description: schemaType.options?.description || null,
      isEmbedded: Boolean(schemaType.schema || schemaType.caster?.schema),
    });
  }

  return fields;
}

/**
 * Extracts embedded subdocument schemas as dedicated entities for granular ERD exploration
 */
function extractEmbeddedEntities() {
  const embedded = [];

  // 1. TreeNode (embedded in Project.tree)
  embedded.push({
    id: "TreeNode",
    name: "TreeNode",
    collectionName: "projects.tree",
    isEmbedded: true,
    parentEntity: "Project",
    parentField: "tree",
    description: EMBEDDED_ENTITY_METADATA.TreeNode.description,
    fields: [
      { name: "path", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "type", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: ["file", "dir"] },
      { name: "size", type: "Number", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "0", enumValues: null },
      { name: "sha", type: "String", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: null, enumValues: null },
    ],
  });

  // 2. Message (embedded in Conversation.messages)
  embedded.push({
    id: "Message",
    name: "Message",
    collectionName: "conversations.messages",
    isEmbedded: true,
    parentEntity: "Conversation",
    parentField: "messages",
    description: EMBEDDED_ENTITY_METADATA.Message.description,
    fields: [
      { name: "messageId", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "role", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: ["user", "assistant"] },
      { name: "content", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "citations", type: "Array<EmbeddedDocument>", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "[]", enumValues: null },
      { name: "metadata", type: "Mixed", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "{}", enumValues: null },
      { name: "createdAt", type: "Date", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "Date.now()", enumValues: null },
    ],
  });

  // 3. Citation (embedded in Conversation.messages.citations)
  embedded.push({
    id: "Citation",
    name: "Citation",
    collectionName: "conversations.messages.citations",
    isEmbedded: true,
    parentEntity: "Message",
    parentField: "citations",
    description: EMBEDDED_ENTITY_METADATA.Citation.description,
    fields: [
      { name: "filePath", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "startLine", type: "Number", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "null", enumValues: null },
      { name: "endLine", type: "Number", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "null", enumValues: null },
      {
        name: "sourceType",
        type: "String",
        primaryKey: false,
        foreignKey: false,
        required: false,
        unique: false,
        defaultValue: "source_file",
        enumValues: ["source_file", "blueprint", "architecture", "api_route", "database_model", "security_finding"],
      },
      { name: "snippet", type: "String", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "null", enumValues: null },
    ],
  });

  // 4. SourceLocation (embedded in SourceFile.sourceLocations)
  embedded.push({
    id: "SourceLocation",
    name: "SourceLocation",
    collectionName: "sourcefiles.sourceLocations",
    isEmbedded: true,
    parentEntity: "SourceFile",
    parentField: "sourceLocations",
    description: EMBEDDED_ENTITY_METADATA.SourceLocation.description,
    fields: [
      { name: "name", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "kind", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: ["function", "class", "route", "model", "variable", "entrypoint"] },
      { name: "lineStart", type: "Number", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "lineEnd", type: "Number", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
    ],
  });

  // 5. Validation (embedded in DevOpsArtifact.validation)
  embedded.push({
    id: "Validation",
    name: "Validation",
    collectionName: "devopsartifacts.validation",
    isEmbedded: true,
    parentEntity: "DevOpsArtifact",
    parentField: "validation",
    description: EMBEDDED_ENTITY_METADATA.Validation.description,
    fields: [
      { name: "valid", type: "Boolean", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: "true", enumValues: null },
      { name: "errors", type: "Array<String>", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "[]", enumValues: null },
      { name: "warnings", type: "Array<String>", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "[]", enumValues: null },
      { name: "checks", type: "Array<EmbeddedDocument>", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "[]", enumValues: null },
      { name: "validationLevel", type: "String", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: "structural", enumValues: ["syntax", "structural", "schema", "tool"] },
    ],
  });

  // 6. ValidationCheck (embedded in DevOpsArtifact.validation.checks)
  embedded.push({
    id: "ValidationCheck",
    name: "ValidationCheck",
    collectionName: "devopsartifacts.validation.checks",
    isEmbedded: true,
    parentEntity: "Validation",
    parentField: "checks",
    description: EMBEDDED_ENTITY_METADATA.ValidationCheck.description,
    fields: [
      { name: "name", type: "String", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "passed", type: "Boolean", primaryKey: false, foreignKey: false, required: true, unique: false, defaultValue: null, enumValues: null },
      { name: "message", type: "String", primaryKey: false, foreignKey: false, required: false, unique: false, defaultValue: '""', enumValues: null },
    ],
  });

  return embedded;
}

/**
 * Builds all inter-collection and embedded relationships for ArchMind AI
 */
function extractRelationships() {
  const relationships = [
    // ── Physical Mongoose ObjectId References ────────────────────────────────
    {
      id: "rel-conversation-project",
      source: "Conversation",
      target: "Project",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "projectId",
      targetField: "_id",
      isPhysical: true,
      required: true,
      description: "Each AI chat conversation is tied to exactly one Project via Mongoose ObjectId ref.",
      crowNotation: "N:1",
    },
    {
      id: "rel-securityaudit-project",
      source: "SecurityAudit",
      target: "Project",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "projectId",
      targetField: "_id",
      isPhysical: true,
      required: true,
      description: "Each security audit run belongs to a specific Project and analysis version.",
      crowNotation: "N:1",
    },
    {
      id: "rel-securityfinding-project",
      source: "SecurityFinding",
      target: "Project",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "projectId",
      targetField: "_id",
      isPhysical: true,
      required: true,
      description: "Individual security audit findings (secrets, AST vulnerabilities) linked to a Project.",
      crowNotation: "N:1",
    },
    {
      id: "rel-sourcefile-project",
      source: "SourceFile",
      target: "Project",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "projectId",
      targetField: "_id",
      isPhysical: true,
      required: true,
      description: "Indexed repository source files linked to a Project (decoupled to avoid 16MB limit).",
      crowNotation: "N:1",
    },
    {
      id: "rel-devopsartifact-project",
      source: "DevOpsArtifact",
      target: "Project",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "projectId",
      targetField: "_id",
      isPhysical: true,
      required: true,
      description: "Persistent Dockerfiles, CI/CD pipelines, and Kubernetes manifests linked to a Project.",
      crowNotation: "N:1",
    },

    // ── Logical Multi-Tenant References (Clerk User ID) ──────────────────────
    {
      id: "rel-project-user",
      source: "Project",
      target: "User",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "userId",
      targetField: "clerkId",
      isPhysical: false,
      required: true,
      description: "Multi-tenant tenant isolation: Every project is keyed to a Clerk User ID.",
      crowNotation: "N:1",
    },
    {
      id: "rel-conversation-user",
      source: "Conversation",
      target: "User",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "userId",
      targetField: "clerkId",
      isPhysical: false,
      required: true,
      description: "User ownership for repository AI chat sessions.",
      crowNotation: "N:1",
    },
    {
      id: "rel-sourcefile-user",
      source: "SourceFile",
      target: "User",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "userId",
      targetField: "clerkId",
      isPhysical: false,
      required: true,
      description: "Multi-tenant isolation for indexed source code files.",
      crowNotation: "N:1",
    },
    {
      id: "rel-devopsartifact-user",
      source: "DevOpsArtifact",
      target: "User",
      type: "many-to-one",
      cardinality: { source: "many", target: "one" },
      sourceField: "userId",
      targetField: "clerkId",
      isPhysical: false,
      required: true,
      description: "User ownership for generated DevOps artifacts.",
      crowNotation: "N:1",
    },

    // ── Embedded Subdocument Relationships ───────────────────────────────────
    {
      id: "rel-project-treenode",
      source: "Project",
      target: "TreeNode",
      type: "embedded",
      cardinality: { source: "one", target: "many" },
      sourceField: "tree",
      targetField: null,
      isPhysical: true,
      required: false,
      description: "Project embeds an array of TreeNode subdocuments representing the repository hierarchy.",
      crowNotation: "1:N (embedded)",
    },
    {
      id: "rel-conversation-message",
      source: "Conversation",
      target: "Message",
      type: "embedded",
      cardinality: { source: "one", target: "many" },
      sourceField: "messages",
      targetField: null,
      isPhysical: true,
      required: false,
      description: "Conversation embeds an array of Message subdocuments preserving full chat history.",
      crowNotation: "1:N (embedded)",
    },
    {
      id: "rel-message-citation",
      source: "Message",
      target: "Citation",
      type: "embedded",
      cardinality: { source: "one", target: "many" },
      sourceField: "citations",
      targetField: null,
      isPhysical: true,
      required: false,
      description: "Each chat message embeds an array of line-level file citations.",
      crowNotation: "1:N (embedded)",
    },
    {
      id: "rel-sourcefile-sourcelocation",
      source: "SourceFile",
      target: "SourceLocation",
      type: "embedded",
      cardinality: { source: "one", target: "many" },
      sourceField: "sourceLocations",
      targetField: null,
      isPhysical: true,
      required: false,
      description: "SourceFile embeds an array of AST symbol locations.",
      crowNotation: "1:N (embedded)",
    },
    {
      id: "rel-devopsartifact-validation",
      source: "DevOpsArtifact",
      target: "Validation",
      type: "embedded",
      cardinality: { source: "one", target: "one" },
      sourceField: "validation",
      targetField: null,
      isPhysical: true,
      required: true,
      description: "DevOpsArtifact embeds a Validation subdocument assessing syntax and safety.",
      crowNotation: "1:1 (embedded)",
    },
    {
      id: "rel-validation-validationcheck",
      source: "Validation",
      target: "ValidationCheck",
      type: "embedded",
      cardinality: { source: "one", target: "many" },
      sourceField: "checks",
      targetField: null,
      isPhysical: true,
      required: false,
      description: "Validation embeds an array of granular validation check assertions.",
      crowNotation: "1:N (embedded)",
    },
  ];

  return relationships;
}

/**
 * Extracts indexes for all registered models
 */
function extractModelIndexes(model, modelName) {
  const indexes = [];
  const rawIndexes = model.schema.indexes();

  for (const [fields, options] of rawIndexes) {
    const fieldList = Object.entries(fields).map(([f, dir]) => `${f}: ${dir === 1 ? "ASC" : "DESC"}`).join(", ");
    indexes.push({
      model: modelName,
      fields,
      fieldList,
      unique: Boolean(options?.unique),
      partialFilterExpression: options?.partialFilterExpression || null,
      name: options?.name || null,
    });
  }

  return indexes;
}

/**
 * Main Extraction Service Function:
 * Extracts the complete, dynamic MongoDB Entity Relationship Diagram (ERD) of ArchMind AI.
 *
 * @returns {Object} Complete normalized ERD payload
 */
export function extractPlatformErd() {
  const modelNames = [
    "User",
    "Project",
    "Conversation",
    "SecurityAudit",
    "SecurityFinding",
    "SourceFile",
    "DevOpsArtifact",
  ];

  const entities = [];
  const allIndexes = [];

  for (const name of modelNames) {
    const model = mongoose.models[name];
    if (!model) continue;

    const meta = ENTITY_METADATA[name] || {
      collectionName: model.collection.name,
      description: `Mongoose model for ${name}`,
      category: "General",
    };

    const fields = extractModelFields(model, name);
    const indexes = extractModelIndexes(model, name);
    allIndexes.push(...indexes);

    entities.push({
      id: name,
      name,
      collectionName: meta.collectionName,
      description: meta.description,
      category: meta.category,
      isEmbedded: false,
      fields,
      indexes,
      fieldCount: fields.length,
      primaryKeyField: "_id",
      foreignKeys: fields.filter((f) => f.foreignKey),
      uniqueFields: fields.filter((f) => f.unique),
    });
  }

  const embeddedEntities = extractEmbeddedEntities();
  const relationships = extractRelationships();

  return {
    database: "ArchMind AI Platform MongoDB",
    databaseType: "MongoDB / Mongoose",
    extractedAt: new Date().toISOString(),
    isPlatformSchema: true,
    stats: {
      totalEntities: entities.length,
      totalEmbeddedEntities: embeddedEntities.length,
      totalCollections: entities.length,
      totalRelationships: relationships.length,
      totalPhysicalReferences: relationships.filter((r) => r.isPhysical && r.type !== "embedded").length,
      totalLogicalReferences: relationships.filter((r) => !r.isPhysical).length,
      totalEmbeddedRelationships: relationships.filter((r) => r.type === "embedded").length,
    },
    entities,
    embeddedEntities,
    relationships,
    indexes: allIndexes,
  };
}

export default {
  extractPlatformErd,
};

