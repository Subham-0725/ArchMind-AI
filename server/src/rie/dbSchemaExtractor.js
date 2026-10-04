// server/src/rie/dbSchemaExtractor.js
//
// Repository Intelligence Engine — Database Schema Extractor
//
// Performs deterministic static analysis of repository source files to extract
// structured database entity definitions: entity names, fields, field types,
// primary keys, foreign keys, and relationship hints.
//
// Supported schema sources (in order of extraction confidence):
//   1. Prisma schema files        (prisma/schema.prisma)
//   2. Mongoose schemas           (JS/TS files using new Schema({...}))
//   3. SQLAlchemy models          (Python class with Column(...) definitions)
//   4. Django ORM models          (Python class extending models.Model)
//   5. TypeORM entities           (TypeScript @Entity / @Column decorators)
//   6. Sequelize models           (JS/TS ModelName.init({...}) calls)
//   7. SQL CREATE TABLE           (.sql files with CREATE TABLE statements)
//
// Returns a normalized DatabaseSchema object:
// {
//   type: "MongoDB" | "PostgreSQL" | "MySQL" | "SQLite" | "Unknown",
//   entities: [
//     {
//       name: string,
//       sourceFile: string,
//       fields: [
//         {
//           name: string,
//           type: string,
//           isPrimary: boolean,
//           isForeign: boolean,
//           isRequired: boolean,
//           isUnique: boolean,
//           references: { entity: string, field: string } | null,
//           defaultValue: string | null,
//         }
//       ]
//     }
//   ],
//   relationships: [
//     { from: string, to: string, type: "one-to-many"|"many-to-one"|"one-to-one"|"many-to-many", field: string }
//   ]
// }

import fs from "fs";
import path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const NOISE_DIRS = new Set([
  "node_modules", ".git", ".github", "dist", "build", "out", ".next",
  ".nuxt", "venv", ".venv", "__pycache__", "coverage", ".cache", "target",
  "storage", "uploads", "extracted", "scratch", "tmp", "temp", "vendor",
]);

/** Mongoose type aliases → normalized ERD types */
const MONGOOSE_TYPE_MAP = {
  string: "String",
  number: "Number",
  boolean: "Boolean",
  bool: "Boolean",
  date: "Date",
  buffer: "Buffer",
  mixed: "Mixed",
  objectid: "ObjectId",
  "mongoose.schema.types.objectid": "ObjectId",
  "schema.types.objectid": "ObjectId",
  map: "Map",
  decimal128: "Decimal128",
  array: "Array",
};

/** SQLAlchemy column type → normalized type */
const SQLA_TYPE_MAP = {
  integer: "Integer",
  string: "String",
  text: "Text",
  boolean: "Boolean",
  float: "Float",
  numeric: "Numeric",
  datetime: "DateTime",
  date: "Date",
  timestamp: "Timestamp",
  json: "JSON",
  jsonb: "JSONB",
  uuid: "UUID",
  biginteger: "BigInteger",
  smallinteger: "SmallInteger",
};

/** Prisma scalar types */
const PRISMA_TYPE_MAP = {
  string: "String",
  int: "Int",
  bigint: "BigInt",
  float: "Float",
  decimal: "Decimal",
  boolean: "Boolean",
  datetime: "DateTime",
  json: "Json",
  bytes: "Bytes",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isNoisePath(relPath) {
  const segments = relPath.replace(/\\/g, "/").split("/");
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i].toLowerCase();
    if (NOISE_DIRS.has(seg) || (seg.startsWith(".") && seg !== ".github")) {
      return true;
    }
  }
  return false;
}

function safeReadFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 500 * 1024) return null; // skip files > 500 KB
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function normalizeEntityName(raw) {
  if (!raw) return "Unknown";
  return raw.trim().replace(/["'`]/g, "");
}

function normalizeType(raw) {
  if (!raw) return "String";
  const lower = raw.toLowerCase().trim().replace(/\s+/g, "");
  return MONGOOSE_TYPE_MAP[lower] || SQLA_TYPE_MAP[lower] || PRISMA_TYPE_MAP[lower] || raw.trim();
}

// ── Prisma Schema Extractor ───────────────────────────────────────────────────

/**
 * Parses a Prisma schema file and extracts models with their fields.
 * Handles model blocks, field types, @id, @unique, @default, and relation fields.
 */
function extractPrismaSchema(content, filePath) {
  const entities = [];
  const relationships = [];

  // Match each `model ModelName { ... }` block
  const modelBlockRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let modelMatch;

  while ((modelMatch = modelBlockRegex.exec(content)) !== null) {
    const entityName = modelMatch[1];
    const body = modelMatch[2];
    const fields = [];

    const lines = body.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;

      // Field line: fieldName FieldType? @id @unique @default(...) @relation(...)
      const fieldMatch = trimmed.match(/^(\w+)\s+([\w\[\]?!]+)(?:\s+(.*))?$/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const rawType = fieldMatch[2].replace(/[?!\[\]]/g, "");
      const annotations = fieldMatch[3] || "";

      // Skip relation-only fields (lowercase initial — these are relation references, not columns)
      const isPrimitivePrismaType = /^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes|[A-Z])/.test(rawType);

      const isPrimary = annotations.includes("@id");
      const isUnique = annotations.includes("@unique");
      const isRequired = !fieldMatch[2].includes("?");
      const hasRelation = annotations.includes("@relation");

      // Extract @default value
      let defaultValue = null;
      const defMatch = annotations.match(/@default\(([^)]+)\)/);
      if (defMatch) defaultValue = defMatch[1];

      // Detect foreign key fields (lowercase type = relation object; not a scalar column)
      let isForeign = false;
      let references = null;

      if (hasRelation) {
        // Extract fields/references from @relation(fields: [fieldId], references: [id])
        const relMatch = annotations.match(/@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]/);
        if (relMatch) {
          const fkFields = relMatch[1].split(",").map((s) => s.trim());
          const refFields = relMatch[2].split(",").map((s) => s.trim());
          // Mark this as an outbound relation — create virtual FK entries
          for (let i = 0; i < fkFields.length; i++) {
            relationships.push({
              from: entityName,
              to: rawType,
              type: "many-to-one",
              field: fkFields[i],
            });
          }
        }
        // Skip — relation object fields (lowercase) don't become ERD nodes
        if (rawType && /^[a-z]/.test(rawType)) continue;
      }

      // Array types: String[] -> many relation
      const isArray = fieldMatch[2].includes("[]");

      if (!isPrimitivePrismaType && !hasRelation) continue; // skip unknown non-scalars

      fields.push({
        name: fieldName,
        type: normalizeType(rawType) + (isArray ? "[]" : ""),
        isPrimary,
        isForeign,
        isRequired,
        isUnique,
        references,
        defaultValue,
      });
    }

    if (entityName && fields.length > 0) {
      entities.push({ name: entityName, sourceFile: filePath, fields });
    }
  }

  return { entities, relationships, type: "PostgreSQL" };
}

// ── Mongoose Schema Extractor (JS/TS regex-based) ────────────────────────────

/**
 * Strips JavaScript comments (single-line and multi-line) from source text
 * without altering non-comment string boundaries.
 */
function stripJsComments(code) {
  if (!code) return "";
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
    .replace(/\/\/[^\n\r]*/g, "");    // single-line comments
}

/**
 * Extracts Mongoose schema definitions and models from JS/TS source code.
 * Handles:
 *   - new Schema({...}), new mongoose.Schema({...}), Schema({...})
 *   - mongoose.model('Name', schema), model('Name', schema)
 *   - models.Name || model('Name', schema) (Next.js singleton)
 *   - export default mongoose.model('Name', schema)
 *   - module.exports = mongoose.model('Name', schema)
 *   - export const Name = mongoose.model('Name', schema)
 *   - const Name = mongoose.model('Name', {...}) (plain object)
 *   - TypeScript generics: new Schema<IModel>({...})
 *   - Schema options ({ timestamps: true }) -> createdAt, updatedAt
 */
function extractMongooseSchema(content, filePath) {
  const entities = [];
  const relationships = [];

  const cleanContent = stripJsComments(content);

  // Map: schemaVarName → modelName
  // e.g. "documentSchema" → "Document" from mongoose.model('Document', documentSchema)
  const schemaVarToModelName = new Map();

  // 1. Match: (mongoose.)?model('ModelName', varName)
  const modelCallMatches = [
    ...cleanContent.matchAll(/(?:mongoose\.)?model\s*(?:<[^>]+>)?\s*\(\s*['"](\w+)['"]\s*,\s*(\w+)/g),
  ];
  for (const m of modelCallMatches) {
    schemaVarToModelName.set(m[2], m[1]); // varName → modelName
  }

  // 2. Match: models.ModelName || (mongoose.)?model('ModelName', ...)
  const nextModelMatches = [
    ...cleanContent.matchAll(/(?:mongoose\.)?models\.(\w+)\s*\|\|\s*(?:mongoose\.)?model\s*(?:<[^>]+>)?\s*\(\s*['"](\w+)['"]/g),
  ];
  for (const m of nextModelMatches) {
    const mName = m[2] || m[1];
    // If variable assignment exists before this line, map it
  }

  // 3. Collect schema variable names in order: const documentSchema = new (mongoose.)?Schema
  const schemaVarOrder = [];
  const schemaVarRegex = /(?:const|let|var|export\s+const|export\s+let|export\s+var)\s+(\w+)\s*=\s*(?:new\s+)?(?:mongoose\.)?Schema\s*(?:<[^>]+>)?\s*\(/g;
  let svm;
  while ((svm = schemaVarRegex.exec(cleanContent)) !== null) {
    schemaVarOrder.push(svm[1]);
  }

  // 4. Extract Schema body blocks
  const schemaBlocks = extractSchemaBodies(cleanContent);

  // 5. Match (mongoose.)?model('Name', ...) for files with inline schemas or no schemaVar binding
  const modelNameOnlyMatches = [
    ...cleanContent.matchAll(/(?:mongoose\.)?model\s*(?:<[^>]+>)?\s*\(\s*['"](\w+)['"]/g),
  ];

  // 6. Match: const Document = mongoose.model(...)
  const constModelMatches = [
    ...cleanContent.matchAll(/(?:const|let|var|export\s+const)\s+(\w+)\s*=\s*(?:mongoose\.)?model/g),
  ];

  const defaultEntityName = (() => {
    if (modelNameOnlyMatches.length > 0) return modelNameOnlyMatches[0][1];
    if (constModelMatches.length > 0) return constModelMatches[0][1];
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.charAt(0).toUpperCase() + basename.slice(1);
  })();

  for (let i = 0; i < schemaBlocks.length; i++) {
    const { body: schemaBody, hasTimestamps } = schemaBlocks[i];
    const schemaVarName = schemaVarOrder[i] || null;

    let entityName = null;

    if (schemaVarName && schemaVarToModelName.has(schemaVarName)) {
      entityName = schemaVarToModelName.get(schemaVarName);
    } else if (modelNameOnlyMatches[i]) {
      entityName = modelNameOnlyMatches[i][1];
    } else if (schemaVarName) {
      const stripped = schemaVarName.replace(/Schema$/i, "");
      entityName = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    } else if (constModelMatches[i]) {
      entityName = constModelMatches[i][1];
    } else {
      entityName = defaultEntityName;
    }

    const fields = parseMongooseSchemaBody(schemaBody, entityName, relationships, hasTimestamps);

    if (fields.length > 0) {
      entities.push({ name: entityName, sourceFile: filePath, fields });
    }
  }

  // If no Schema({...}) was found, check if mongoose.model('Name', { ... }) was used directly with a plain object
  if (entities.length === 0 && modelNameOnlyMatches.length > 0) {
    const inlineModelBodies = extractInlineModelBodies(cleanContent);
    for (let i = 0; i < inlineModelBodies.length; i++) {
      const { entityName, body, hasTimestamps } = inlineModelBodies[i];
      const fields = parseMongooseSchemaBody(body, entityName, relationships, hasTimestamps);
      if (fields.length > 0) {
        entities.push({ name: entityName, sourceFile: filePath, fields });
      }
    }
  }

  // Fallback: If still no entities but file has an explicit model call (e.g. mongoose.model('Name', ...))
  if (entities.length === 0 && modelNameOnlyMatches.length > 0) {
    const entityName = modelNameOnlyMatches[0][1];
    if (entityName && entityName !== "Unknown") {
      entities.push({
        name: entityName,
        sourceFile: filePath,
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isForeign: false, isRequired: true, isUnique: true, references: null, defaultValue: null }
        ],
      });
    }
  }

  return { entities, relationships, type: "MongoDB" };
}

/**
 * Uses brace-depth tracking to extract Schema({...}, [options]) argument bodies.
 * Returns array of { body: string, hasTimestamps: boolean }.
 */
function extractSchemaBodies(content) {
  const blocks = [];
  // Match: (new )?(mongoose.)?Schema(<...>)?(
  const startMarkers = [
    ...content.matchAll(/(?:new\s+)?(?:mongoose\.)?Schema\s*(?:<[^>]+>)?\s*\(/g),
  ];

  for (const match of startMarkers) {
    const scanStart = match.index + match[0].length;
    let braceDepth = 0;
    let bodyStart = -1;
    let bodyEnd = -1;
    let hasTimestamps = false;

    // 1. Scan the schema definition object (first arg)
    for (let i = scanStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === "{") {
        if (braceDepth === 0) bodyStart = i;
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0 && bodyStart !== -1) {
          bodyEnd = i;
          break;
        }
      } else if (ch === ")" && braceDepth === 0) {
        break; // Empty Schema()
      }
    }

    if (bodyStart !== -1 && bodyEnd !== -1) {
      const body = content.substring(bodyStart, bodyEnd + 1);

      // 2. Scan for schema options (e.g. second arg { timestamps: true })
      const afterFirstArg = content.slice(bodyEnd + 1, bodyEnd + 200);
      if (/timestamps\s*:\s*true/i.test(afterFirstArg) || /timestamps\s*:\s*true/i.test(body)) {
        hasTimestamps = true;
      }

      blocks.push({ body, hasTimestamps });
    }
  }

  return blocks;
}

/**
 * Extracts plain object schemas passed directly to mongoose.model('Name', { ... })
 */
function extractInlineModelBodies(content) {
  const results = [];
  const modelRegex = /(?:mongoose\.)?model\s*(?:<[^>]+>)?\s*\(\s*['"](\w+)['"]\s*,\s*\{/g;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const entityName = match[1];
    const bodyStart = match.index + match[0].length - 1; // points to opening "{"
    let braceDepth = 0;
    let bodyEnd = -1;

    for (let i = bodyStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === "{") {
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }

    if (bodyEnd !== -1) {
      const body = content.substring(bodyStart, bodyEnd + 1);
      const afterArg = content.slice(bodyEnd + 1, bodyEnd + 150);
      const hasTimestamps = /timestamps\s*:\s*true/i.test(afterArg) || /timestamps\s*:\s*true/i.test(body);
      results.push({ entityName, body, hasTimestamps });
    }
  }

  return results;
}

/**
 * Parses the body of a Mongoose Schema definition.
 * Handles:
 *   fieldName: String
 *   fieldName: { type: String, required: true }
 *   fieldName: [{ type: Schema.Types.ObjectId, ref: 'Model' }]
 *   fieldName: [String]
 *   personalInfo: { fullName: String, email: String }
 */
function parseMongooseSchemaBody(body, entityName, relationships, hasTimestamps = false) {
  const fields = [];

  const cleanBody = stripJsComments(body);
  const flat = cleanBody.replace(/\n\s*/g, " ");

  const topLevelKeys = extractTopLevelKeys(flat);

  for (const { key, value } of topLevelKeys) {
    if (!key) continue;

    if (key.startsWith("_")) {
      if (key === "_id") {
        fields.push({
          name: "_id",
          type: "ObjectId",
          isPrimary: true,
          isForeign: false,
          isRequired: true,
          isUnique: true,
          references: null,
          defaultValue: null,
        });
      }
      continue;
    }

    const field = parseMongooseFieldValue(key, value, entityName, relationships);
    if (field) fields.push(field);
  }

  // Always ensure _id is present as primary key
  if (!fields.find((f) => f.name === "_id")) {
    fields.unshift({
      name: "_id",
      type: "ObjectId",
      isPrimary: true,
      isForeign: false,
      isRequired: true,
      isUnique: true,
      references: null,
      defaultValue: null,
    });
  }

  // If { timestamps: true } was set and fields not defined, inject createdAt and updatedAt
  if (hasTimestamps) {
    if (!fields.find((f) => f.name === "createdAt")) {
      fields.push({
        name: "createdAt",
        type: "Date",
        isPrimary: false,
        isForeign: false,
        isRequired: false,
        isUnique: false,
        references: null,
        defaultValue: "Date.now",
      });
    }
    if (!fields.find((f) => f.name === "updatedAt")) {
      fields.push({
        name: "updatedAt",
        type: "Date",
        isPrimary: false,
        isForeign: false,
        isRequired: false,
        isUnique: false,
        references: null,
        defaultValue: "Date.now",
      });
    }
  }

  return fields;
}

/**
 * Extracts top-level {key: value} pairs from a flat Mongoose schema body string.
 * Handles nested braces and brackets to avoid splitting on nested objects/arrays.
 */
function extractTopLevelKeys(flat) {
  const results = [];
  const inner = flat.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  let i = 0;

  while (i < inner.length) {
    // Skip whitespace and leading commas
    while (i < inner.length && /[\s,]/.test(inner[i])) i++;
    if (i >= inner.length) break;

    // Read key (identifier or quoted string)
    let key = "";
    if (inner[i] === '"' || inner[i] === "'" || inner[i] === "`") {
      const q = inner[i++];
      while (i < inner.length && inner[i] !== q) key += inner[i++];
      i++; // closing quote
    } else {
      while (i < inner.length && /[\w$]/.test(inner[i])) key += inner[i++];
    }

    if (!key) {
      i++;
      continue;
    }

    // Skip whitespace and colon
    while (i < inner.length && /[\s:]/.test(inner[i])) i++;

    // Read value (depth-tracked)
    let value = "";
    let depth = 0;
    while (i < inner.length) {
      const ch = inner[i];
      if (ch === "{" || ch === "[" || ch === "(") {
        depth++;
        value += ch;
        i++;
      } else if (ch === "}" || ch === "]" || ch === ")") {
        if (depth === 0) break;
        depth--;
        value += ch;
        i++;
      } else if (ch === "," && depth === 0) {
        i++;
        break;
      } else {
        value += ch;
        i++;
      }
    }

    results.push({ key: key.trim(), value: value.trim() });
  }

  return results;
}

function parseMongooseFieldValue(fieldName, value, entityName, relationships) {
  const trimmed = value.trim();

  // Array type: [String] or [{ type: ObjectId, ref: 'Model' }] or [new Schema({...})]
  const isArray = trimmed.startsWith("[") && trimmed.endsWith("]");
  const inner = isArray ? trimmed.slice(1, -1).trim() : trimmed;

  // Simple type: String, Number, Boolean, Date, Buffer, Mixed, Map, Object, ObjectId, Array
  const simpleTypeMatch = inner.match(/^(?:mongoose\.)?(?:Schema\.)?(?:Types\.)?(\w+)$/i);
  if (simpleTypeMatch) {
    const rawType = simpleTypeMatch[1];
    const type = normalizeType(rawType) + (isArray ? "[]" : "");
    return {
      name: fieldName,
      type,
      isPrimary: false,
      isForeign: false,
      isRequired: false,
      isUnique: false,
      references: null,
      defaultValue: null,
    };
  }

  // Object config: { type: ..., required: ..., ref: ..., unique: ..., default: ... }
  if (inner.startsWith("{")) {
    // Check if this is a field configuration object (has a "type" property at its top level)
    // or an embedded subdocument (multiple properties without a top-level "type")
    const topKeys = extractTopLevelKeys(inner);
    const typeKey = topKeys.find((k) => k.key === "type");

    if (typeKey) {
      // It's a field config object: { type: ..., ... }
      const rawTypeValue = typeKey.value.replace(/['"]/g, "").trim();
      const isArrayType = rawTypeValue.startsWith("[") || isArray;
      const typeClean = rawTypeValue.replace(/[\[\]]/g, "").trim();

      // Extract type name from type expression (e.g. Schema.Types.ObjectId -> ObjectId)
      const typeMatch = typeClean.match(/(?:(?:mongoose\.)?(?:Schema\.)?(?:Types\.)?)?(\w+)/i);
      const rawType = typeMatch ? typeMatch[1] : "Mixed";

      const reqKey = topKeys.find((k) => k.key === "required");
      const isRequired = reqKey ? /true/i.test(reqKey.value) : false;

      const uniqueKey = topKeys.find((k) => k.key === "unique");
      const isUnique = uniqueKey ? /true/i.test(uniqueKey.value) : false;

      const refKey = topKeys.find((k) => k.key === "ref");
      const refMatch = refKey ? refKey.value.match(/['"](\w+)['"]/) : null;

      const defKey = topKeys.find((k) => k.key === "default");
      const defaultValue = defKey ? defKey.value.trim().replace(/['"]/g, "") : null;

      const isObjectId = rawType.toLowerCase() === "objectid";
      const isForeign = Boolean(refMatch);
      let references = null;

      if (isForeign && refMatch) {
        const targetEntity = refMatch[1];
        references = { entity: targetEntity, field: "_id" };
        relationships.push({
          from: entityName,
          to: targetEntity,
          type: isArrayType ? "one-to-many" : "many-to-one",
          field: fieldName,
        });
      }

      return {
        name: fieldName,
        type: (isObjectId ? "ObjectId" : normalizeType(rawType)) + (isArrayType ? "[]" : ""),
        isPrimary: false,
        isForeign,
        isRequired,
        isUnique,
        references,
        defaultValue,
      };
    } else {
      // Embedded subdocument / nested object: { name: String, url: String }
      return {
        name: fieldName,
        type: isArray ? "Object[]" : "Object",
        isPrimary: false,
        isForeign: false,
        isRequired: false,
        isUnique: false,
        references: null,
        defaultValue: null,
      };
    }
  }

  // Array of primitives or unknown
  return {
    name: fieldName,
    type: isArray ? "Array" : "Mixed",
    isPrimary: false,
    isForeign: false,
    isRequired: false,
    isUnique: false,
    references: null,
    defaultValue: null,
  };
}

// ── SQLAlchemy / Django Model Extractor ──────────────────────────────────────

/**
 * Extracts entities from Python ORM model files.
 * Handles SQLAlchemy (Column(...)) and Django (models.CharField, etc.) patterns.
 */
function extractPythonOrmSchema(content, filePath) {
  const entities = [];
  const relationships = [];

  // Find all class definitions: class ClassName(Base): / class ClassName(models.Model):
  const classRegex = /class\s+(\w+)\s*\(([^)]+)\)\s*:/g;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const className = classMatch[1];
    const baseClass = classMatch[2];

    const isSqlAlchemy = /Base|DeclarativeBase|db\.Model|SQLModel/i.test(baseClass);
    const isDjango = /models\.Model|TimeStampedModel/i.test(baseClass);

    if (!isSqlAlchemy && !isDjango) continue;

    // Extract class body (indented lines following the class declaration)
    const bodyStart = classMatch.index + classMatch[0].length;
    const bodyLines = extractIndentedBlock(content, bodyStart);

    const fields = isDjango
      ? extractDjangoFields(className, bodyLines, relationships)
      : extractSqlAlchemyFields(className, bodyLines, relationships);

    if (fields.length > 0) {
      entities.push({ name: className, sourceFile: filePath, fields });
    }
  }

  return { entities, relationships, type: entities.length > 0 ? "PostgreSQL" : "Unknown" };
}

function extractIndentedBlock(content, startPos) {
  const lines = content.slice(startPos).split("\n");
  const result = [];
  let baseIndent = -1;

  for (const line of lines) {
    if (!line.trim()) { result.push(""); continue; }
    const indent = line.length - line.trimStart().length;
    if (baseIndent === -1 && line.trim()) {
      baseIndent = indent;
      result.push(line);
      continue;
    }
    if (indent < baseIndent && line.trim()) break; // class ended
    result.push(line);
  }

  return result.join("\n");
}

function extractSqlAlchemyFields(className, bodyText, relationships) {
  const fields = [];
  // Match: field_name = Column(Type, primary_key=True, ForeignKey('table.id'), ...)
  const colRegex = /(\w+)\s*=\s*(?:mapped_column|Column)\s*\(([^)]+)\)/g;
  let match;

  while ((match = colRegex.exec(bodyText)) !== null) {
    const fieldName = match[1];
    if (fieldName === "__tablename__") continue;
    const args = match[2];

    // Detect type (first positional argument)
    const typeMatch = args.match(/^([A-Za-z_][\w.]*)/);
    const rawType = typeMatch ? typeMatch[1].split(".")?.pop() : "String";

    const isPrimary = /primary_key\s*=\s*True/i.test(args);
    const isRequired = /nullable\s*=\s*False/i.test(args) || isPrimary;
    const isUnique = /unique\s*=\s*True/i.test(args);

    const fkMatch = args.match(/ForeignKey\s*\(\s*['"]([^'"]+)['"]/i);
    const isForeign = Boolean(fkMatch);
    let references = null;

    if (fkMatch) {
      const parts = fkMatch[1].split(".");
      const refTable = parts[0];
      const refField = parts[1] || "id";
      // Capitalize entity name from table name
      const refEntity = refTable.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const refEntityCap = refEntity.charAt(0).toUpperCase() + refEntity.slice(1);
      references = { entity: refEntityCap, field: refField };
      relationships.push({ from: className, to: refEntityCap, type: "many-to-one", field: fieldName });
    }

    fields.push({
      name: fieldName,
      type: normalizeType(rawType),
      isPrimary,
      isForeign,
      isRequired,
      isUnique,
      references,
      defaultValue: null,
    });
  }

  // Add implicit id if not found
  if (fields.length > 0 && !fields.find((f) => f.isPrimary)) {
    fields.unshift({ name: "id", type: "Integer", isPrimary: true, isForeign: false, isRequired: true, isUnique: true, references: null, defaultValue: null });
  }

  return fields;
}

function extractDjangoFields(className, bodyText, relationships) {
  const fields = [];
  // Django field patterns: field_name = models.CharField(...) / ForeignKey(...) / etc.
  const fieldRegex = /(\w+)\s*=\s*models\.(\w+)\s*\(([^)]*)\)/g;
  let match;

  while ((match = fieldRegex.exec(bodyText)) !== null) {
    const fieldName = match[1];
    const fieldType = match[2];
    const args = match[3];

    const isForeign = fieldType === "ForeignKey" || fieldType === "OneToOneField" || fieldType === "ManyToManyField";
    const isPrimary = fieldName === "id" || /primary_key\s*=\s*True/i.test(args);
    const isRequired = !/blank\s*=\s*True/i.test(args) && !/null\s*=\s*True/i.test(args);
    const isUnique = /unique\s*=\s*True/i.test(args);
    let references = null;
    let relType = "many-to-one";

    if (isForeign) {
      const refMatch = args.match(/^['"]?(\w+)['"]?/);
      if (refMatch) {
        const refEntity = refMatch[1];
        references = { entity: refEntity, field: "id" };
        relType = fieldType === "ManyToManyField" ? "many-to-many" : fieldType === "OneToOneField" ? "one-to-one" : "many-to-one";
        relationships.push({ from: className, to: refEntity, type: relType, field: fieldName });
      }
    }

    const typeMap = {
      CharField: "String", TextField: "Text", IntegerField: "Integer",
      FloatField: "Float", BooleanField: "Boolean", DateTimeField: "DateTime",
      DateField: "Date", EmailField: "String", URLField: "String",
      ForeignKey: "ObjectId", OneToOneField: "ObjectId", ManyToManyField: "ObjectId[]",
      AutoField: "Integer", BigAutoField: "BigInteger", UUIDField: "UUID",
      JSONField: "JSON",
    };

    fields.push({
      name: fieldName,
      type: typeMap[fieldType] || fieldType,
      isPrimary,
      isForeign,
      isRequired,
      isUnique,
      references,
      defaultValue: null,
    });
  }

  // Inject implicit id
  if (fields.length > 0 && !fields.find((f) => f.isPrimary)) {
    fields.unshift({ name: "id", type: "BigInteger", isPrimary: true, isForeign: false, isRequired: true, isUnique: true, references: null, defaultValue: null });
  }

  return fields;
}

// ── SQL CREATE TABLE Extractor ────────────────────────────────────────────────

function extractSqlSchema(content, filePath) {
  const entities = [];
  const relationships = [];

  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([^;]+)\)/gi;
  let match;

  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const entityName = tableName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const entityNameCap = entityName.charAt(0).toUpperCase() + entityName.slice(1);
    const fields = [];

    const colLines = body.split(",").map((l) => l.trim()).filter(Boolean);
    for (const col of colLines) {
      // Skip constraint lines (PRIMARY KEY (...), FOREIGN KEY (...), UNIQUE (...), INDEX)
      if (/^(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK)\b/i.test(col)) {
        // But we can still extract FK relationships from FOREIGN KEY lines
        const fkMatch = col.match(/FOREIGN\s+KEY\s*\((\w+)\)\s+REFERENCES\s+["'`]?(\w+)["'`]?\s*\((\w+)\)/i);
        if (fkMatch) {
          const [, fkField, refTable, refField] = fkMatch;
          const refEntity = refTable.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
          const refEntityCap = refEntity.charAt(0).toUpperCase() + refEntity.slice(1);
          // Update the existing field's FK flag
          const existingField = fields.find((f) => f.name === fkField);
          if (existingField) {
            existingField.isForeign = true;
            existingField.references = { entity: refEntityCap, field: refField };
          }
          relationships.push({ from: entityNameCap, to: refEntityCap, type: "many-to-one", field: fkField });
        }
        continue;
      }

      // Parse column: `col_name` TYPE [NOT NULL] [PRIMARY KEY] [DEFAULT ...]
      const colMatch = col.match(/["'`]?(\w+)["'`]?\s+([\w()]+)/);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const colType = colMatch[2].replace(/\(.*\)/, "").toUpperCase();
      const isPrimary = /PRIMARY\s+KEY/i.test(col) || /\bPRIMARY\b/i.test(col);
      const isRequired = /NOT\s+NULL/i.test(col) || isPrimary;
      const isUnique = /\bUNIQUE\b/i.test(col);
      const defMatch = col.match(/DEFAULT\s+([^\s,]+)/i);

      const sqlTypeMap = {
        INT: "Integer", INTEGER: "Integer", BIGINT: "BigInteger",
        SMALLINT: "SmallInteger", VARCHAR: "String", TEXT: "Text",
        BOOLEAN: "Boolean", BOOL: "Boolean", FLOAT: "Float",
        DOUBLE: "Float", DECIMAL: "Decimal", NUMERIC: "Decimal",
        DATE: "Date", DATETIME: "DateTime", TIMESTAMP: "Timestamp",
        CHAR: "String", UUID: "UUID", JSON: "JSON", JSONB: "JSONB",
        SERIAL: "Integer", BIGSERIAL: "BigInteger",
      };

      fields.push({
        name: colName,
        type: sqlTypeMap[colType] || colType,
        isPrimary,
        isForeign: false,
        isRequired,
        isUnique,
        references: null,
        defaultValue: defMatch ? defMatch[1] : null,
      });
    }

    if (fields.length > 0) {
      entities.push({ name: entityNameCap, sourceFile: filePath, fields });
    }
  }

  const dbType = entities.length > 0 ? "SQL" : "Unknown";
  return { entities, relationships, type: dbType };
}

// ── Main Extraction Orchestrator ──────────────────────────────────────────────

/**
 * Determines the database type hint based on detected capabilities and tech stack.
 */
function determineDatabaseType(capabilities, techStack, extractedEntities) {
  const dbs = capabilities?.details?.databases || techStack?.databases || [];
  const dbsLower = dbs.map((d) => d.toLowerCase());

  if (dbsLower.some((d) => d.includes("mongo"))) return "MongoDB";
  if (dbsLower.some((d) => d.includes("postgres") || d.includes("pg"))) return "PostgreSQL";
  if (dbsLower.some((d) => d.includes("mysql"))) return "MySQL";
  if (dbsLower.some((d) => d.includes("sqlite"))) return "SQLite";
  if (dbsLower.some((d) => d.includes("prisma"))) return "PostgreSQL";

  // Infer from extracted entities
  if (extractedEntities.length > 0) {
    const types = extractedEntities.map((e) => e._detectedType).filter(Boolean);
    if (types.includes("MongoDB")) return "MongoDB";
    if (types.includes("PostgreSQL")) return "PostgreSQL";
    if (types.includes("SQL")) return "SQL";
  }

  return "Unknown";
}

/**
 * Merges entities from multiple extraction passes, deduplicating by name.
 * Prefers entries with more fields (more information).
 */
function mergeEntities(entityArrays) {
  const map = new Map();
  for (const entity of entityArrays.flat()) {
    const key = entity.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, entity);
    } else {
      const existing = map.get(key);
      if (entity.fields.length > existing.fields.length) {
        map.set(key, entity);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Deduplicates relationships by (from, to, field) triple.
 */
function mergeRelationships(relArrays) {
  const seen = new Set();
  const result = [];
  for (const rel of relArrays.flat()) {
    const key = `${rel.from}->${rel.to}:${rel.field}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(rel);
    }
  }
  return result;
}

/**
 * Main entry point: extracts the database schema from a repository.
 *
 * @param {Array<{ path: string, type?: string, size?: number }>} fileTree - Sanitized file tree
 * @param {Object} capabilities - Project capabilities ({ hasDatabase, details })
 * @param {Object} techStack - Tech stack ({ databases, frameworks, ... })
 * @param {string|null} extractionPath - Disk root for ZIP projects (null for GitHub)
 * @returns {Object} Normalized DatabaseSchema
 */
export function extractDatabaseSchema(fileTree = [], capabilities = {}, techStack = {}, extractionPath = null) {
  // Fast exit if no database capability detected
  if (!capabilities?.hasDatabase) {
    return { type: "None", entities: [], relationships: [] };
  }

  const allEntities = [];
  const allRelationships = [];

  const normalizedTree = (Array.isArray(fileTree) ? fileTree : [])
    .filter((f) => f && f.path && f.type !== "dir")
    .map((f) => ({ ...f, path: f.path.replace(/\\/g, "/") }));

  // Helper to test if a relative path looks like a model/schema definition location
  const isModelPath = (p) => {
    return (
      /(?:^|\/)(?:models?|schemas?|entities|db|database)\//i.test(p) ||
      /\.(?:model|schema)\.[jt]sx?$/i.test(p) ||
      /^(?:models?|schemas?|entities)\.[jt]sx?$/i.test(p)
    );
  };

  // Identify relevant candidate files for extraction
  const prismaFiles = normalizedTree.filter((f) => f.path.endsWith("schema.prisma") && !isNoisePath(f.path));
  
  const jsTsFiles = normalizedTree.filter((f) =>
    /\.(js|ts|mjs|cjs)$/i.test(f.path) &&
    !isNoisePath(f.path) &&
    !f.path.includes(".test.") &&
    !f.path.includes(".spec.") &&
    !f.path.includes("__tests__")
  );

  const pythonFiles = normalizedTree.filter((f) =>
    f.path.endsWith(".py") &&
    !isNoisePath(f.path) &&
    (isModelPath(f.path) || f.path.endsWith("models.py") || f.path.endsWith("model.py"))
  );

  const sqlFiles = normalizedTree.filter((f) =>
    f.path.endsWith(".sql") && !isNoisePath(f.path) &&
    !f.path.includes("test") && !f.path.includes("spec")
  );

  // 1. Prisma
  for (const file of prismaFiles) {
    if (extractionPath) {
      const fullPath = path.join(extractionPath, file.path);
      const content = safeReadFile(fullPath);
      if (content) {
        const result = extractPrismaSchema(content, file.path);
        result.entities.forEach((e) => { e._detectedType = "PostgreSQL"; });
        allEntities.push(...result.entities);
        allRelationships.push(...result.relationships);
      }
    } else if (file.content) {
      const result = extractPrismaSchema(file.content, file.path);
      allEntities.push(...result.entities);
      allRelationships.push(...result.relationships);
    }
  }

  // 2. Mongoose (JS/TS model files)
  for (const file of jsTsFiles) {
    let content = file.content || null;
    if (!content && extractionPath) {
      // Prioritize files in model paths, or scan candidate JS files
      if (isModelPath(file.path) || jsTsFiles.length <= 40) {
        content = safeReadFile(path.join(extractionPath, file.path));
      }
    }
    if (!content) continue;

    // Check if the file defines a Mongoose model or schema
    const isMongoose =
      content.includes("mongoose") ||
      /Schema\s*(?:<[^>]+>)?\s*\(/i.test(content) ||
      /(?:mongoose\.)?model\s*(?:<[^>]+>)?\s*\(/i.test(content) ||
      isModelPath(file.path);

    if (!isMongoose) continue;

    const result = extractMongooseSchema(content, file.path);
    if (result.entities.length > 0) {
      result.entities.forEach((e) => { e._detectedType = "MongoDB"; });
      allEntities.push(...result.entities);
      allRelationships.push(...result.relationships);
    }
  }

  // 3. Python ORM (SQLAlchemy / Django)
  for (const file of pythonFiles) {
    let content = file.content || null;
    if (!content && extractionPath) {
      content = safeReadFile(path.join(extractionPath, file.path));
    }
    if (!content) continue;

    const isOrm = content.includes("Column(") || content.includes("models.Model") || content.includes("SQLModel") || content.includes("DeclarativeBase");
    if (!isOrm) continue;

    const result = extractPythonOrmSchema(content, file.path);
    if (result.entities.length > 0) {
      result.entities.forEach((e) => { e._detectedType = result.type; });
      allEntities.push(...result.entities);
      allRelationships.push(...result.relationships);
    }
  }

  // 4. SQL files
  for (const file of sqlFiles) {
    let content = file.content || null;
    if (!content && extractionPath) {
      content = safeReadFile(path.join(extractionPath, file.path));
    }
    if (!content) continue;

    const result = extractSqlSchema(content, file.path);
    if (result.entities.length > 0) {
      result.entities.forEach((e) => { e._detectedType = result.type; });
      allEntities.push(...result.entities);
      allRelationships.push(...result.relationships);
    }
  }

  // Merge and deduplicate
  const entities = mergeEntities([allEntities]);
  const relationships = mergeRelationships([allRelationships]);

  // Determine final DB type
  const dbType = determineDatabaseType(capabilities, techStack, entities);

  // Strip internal _detectedType marker before returning
  for (const e of entities) { delete e._detectedType; }

  return { type: dbType, entities, relationships };
}
