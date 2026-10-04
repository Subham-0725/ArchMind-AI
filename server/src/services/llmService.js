// server/src/services/llmService.js
//
// LLM Provider Integration Service for ArchMind AI
// Supports Groq API (via groq-sdk) and Google Gemini API (via @google/genai SDK)
// with strict JSON output validation, fallback JSON repair, error isolation,
// and deterministic mock fallback for testing environments.

import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

/**
 * Detects and returns configured LLM provider client.
 * Prioritizes Groq API if GROQ_API_KEY is present, then Gemini API, then fallback to mock.
 */
function getActiveProvider() {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && !groqKey.startsWith("YOUR_")) {
    return { type: "groq", client: new Groq({ apiKey: groqKey }) };
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !geminiKey.startsWith("YOUR_")) {
    return { type: "gemini", client: new GoogleGenAI({ apiKey: geminiKey }) };
  }

  return { type: "mock", client: null };
}

/**
 * Helper to clean and parse JSON from LLM responses (strips markdown code blocks).
 */
export function parseAndValidateJson(text, type = "architecture", context = null) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty response from LLM provider.");
  }

  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse LLM response as JSON: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed LLM output is not a JSON object.");
  }

  if (type === "architecture") {
    return validateArchitectureSchema(parsed);
  } else if (type === "erd") {
    return validateErdSchema(parsed, context);
  }

  return parsed;
}

/**
 * Validates and repairs architecture diagram schema ({ nodes: [], edges: [] }).
 */
function validateArchitectureSchema(data) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const rawEdges = Array.isArray(data.edges) ? data.edges : [];

  const validNodes = nodes.map((node, idx) => ({
    id: String(node.id || `node-${idx + 1}`),
    type: node.type || "custom",
    data: {
      label: node.data?.label || node.label || `Component ${idx + 1}`,
      description: node.data?.description || node.description || "",
      tier: node.data?.tier || node.tier || "backend",
      technologies: Array.isArray(node.data?.technologies) ? node.data.technologies : [],
      metrics: node.data?.metrics || {},
    },
  }));

  const nodeIds = new Set(validNodes.map((n) => n.id));

  const validEdges = rawEdges
    .filter((e) => e && e.source && e.target && nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)))
    .map((e, idx) => ({
      id: String(e.id || `edge-${idx + 1}`),
      source: String(e.source),
      target: String(e.target),
      label: e.label || "",
    }));

  return { nodes: validNodes, edges: validEdges };
}

/**
 * Validates and repairs ERD schema ({ entities: [], relationships: [] }).
 * Strictly enforces that entities correspond to real models and removes
 * generic placeholders (Entity2, table_2, etc.).
 */
function validateErdSchema(data, blueprint = null) {
  const rawEntities = Array.isArray(data?.entities) ? data.entities : [];
  const rawRelationships = Array.isArray(data?.relationships) ? data.relationships : [];

  // Collect known valid model names from blueprint if available
  const knownNames = new Set();
  const knownNameMap = new Map(); // lowercase -> original case
  if (blueprint?.database?.entities) {
    for (const ent of blueprint.database.entities) {
      if (ent.name) {
        knownNames.add(ent.name.toLowerCase());
        knownNameMap.set(ent.name.toLowerCase(), ent.name);
      }
    }
  }
  if (Array.isArray(blueprint?.models)) {
    for (const m of blueprint.models) {
      if (m.name) {
        knownNames.add(m.name.toLowerCase());
        knownNameMap.set(m.name.toLowerCase(), m.name);
      }
    }
  }

  const validEntities = [];

  for (let idx = 0; idx < rawEntities.length; idx++) {
    const ent = rawEntities[idx];
    if (!ent) continue;

    let rawName = String(ent.name || ent.id || "").trim();

    // Check if name is a generic placeholder like "Entity1", "Entity2", "table_2", etc.
    const isGenericPlaceholder = /^(Entity\d+|table_\d+|Component\d+|Model_\d+|Record)$/i.test(rawName);

    if (isGenericPlaceholder && knownNames.size > 0 && !knownNames.has(rawName.toLowerCase())) {
      // If LLM returned a placeholder but there is an unmatched known model, try to recover it
      const remainingKnown = Array.from(knownNames).filter(
        (kn) => !validEntities.some((ve) => ve.name.toLowerCase() === kn)
      );
      if (remainingKnown.length > 0) {
        const recoveredName = knownNameMap.get(remainingKnown[0]);
        rawName = recoveredName;
      } else {
        // Drop ungrounded placeholder
        continue;
      }
    }

    if (!rawName) continue;

    const entityName = knownNameMap.get(rawName.toLowerCase()) || rawName;
    const entityId = String(ent.id || `entity-${entityName.toLowerCase().replace(/\s+/g, "-")}`);
    const tableName = ent.tableName || `${entityName.toLowerCase().replace(/\s+/g, "_")}s`;

    validEntities.push({
      id: entityId,
      name: entityName,
      tableName,
      fields: Array.isArray(ent.fields)
        ? ent.fields.map((f) => ({
            name: f.name || "field",
            type: f.type || "String",
            isPrimary: Boolean(f.isPrimary),
            isForeign: Boolean(f.isForeign),
            isRequired: f.isRequired !== undefined ? Boolean(f.isRequired) : !f.isNullable,
            isNullable: f.isNullable !== false && !f.isPrimary,
            isUnique: Boolean(f.isUnique),
            references: f.references || null,
            defaultValue: f.defaultValue || null,
          }))
        : [],
    });
  }

  const entityIds = new Set(validEntities.map((e) => e.id));
  const entityNames = new Set(validEntities.map((e) => e.name.toLowerCase()));

  const validRelationships = rawRelationships
    .filter((r) => {
      if (!r || !r.sourceEntity || !r.targetEntity) return false;
      const srcStr = String(r.sourceEntity).toLowerCase();
      const tgtStr = String(r.targetEntity).toLowerCase();
      const srcOk = entityIds.has(String(r.sourceEntity)) || entityNames.has(srcStr);
      const tgtOk = entityIds.has(String(r.targetEntity)) || entityNames.has(tgtStr);
      return srcOk && tgtOk;
    })
    .map((r, idx) => ({
      id: String(r.id || `rel-${idx + 1}`),
      sourceEntity: String(r.sourceEntity),
      targetEntity: String(r.targetEntity),
      type: r.type || "one-to-many",
      foreignKey: r.foreignKey || r.field || "",
    }));

  return { entities: validEntities, relationships: validRelationships };
}

/**
 * Generates React Flow Architecture Topology ({ nodes: [], edges: [] }) from Blueprint.
 *
 * @param {Object} blueprint - Repository Blueprint
 * @param {Object} [options]
 * @param {boolean} [options.mock=false] - Force mock generation for testing
 * @returns {Promise<Object>} Architecture result
 */
export async function generateArchitecture(blueprint, options = {}) {
  if (options.mock) {
    return mockArchitecture(blueprint);
  }

  const provider = getActiveProvider();

  const systemInstruction = "You are ArchMind AI Senior System Architect. Output STRICT JSON only.";
  const prompt = `
Analyze the following Repository Blueprint and generate a system architecture diagram for React Flow.

Repository Blueprint:
${JSON.stringify(blueprint, null, 2)}

Output STRICT JSON matching this schema:
{
  "nodes": [
    {
      "id": "node-1",
      "type": "custom",
      "data": {
        "label": "Express API Server",
        "description": "Handles API routes and project ingestion",
        "tier": "backend",
        "technologies": ["Express.js", "Node.js"]
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "label": "Mongoose Query"
    }
  ]
}

Rules:
1. "tier" must be one of: "frontend", "backend", "database", "devops".
2. Every edge "source" and "target" MUST exist in "nodes".
3. Ground your reasoning strictly on the blueprint.
4. Output ONLY valid JSON inside a json code block.
`;

  try {
    if (provider.type === "groq") {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        model: "openai/gpt-oss-20b",
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content;
      return parseAndValidateJson(text, "architecture");
    } else if (provider.type === "gemini") {
      const response = await provider.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return parseAndValidateJson(response.text, "architecture");
    } else {
      return mockArchitecture(blueprint);
    }
  } catch (err) {
    console.error("[llmService] generateArchitecture error:", err.message);
    throw new Error(`Architecture LLM Generation Failed: ${err.message}`);
  }
}

/**
 * Generates ERD Diagram ({ entities: [], relationships: [] }) from Blueprint.
 *
 * @param {Object} blueprint - Repository Blueprint
 * @param {Object} [options]
 * @param {boolean} [options.mock=false] - Force mock generation for testing
 * @returns {Promise<Object|null>} ERD result or null if no database capability
 */
export async function generateERD(blueprint, options = {}) {
  if (!blueprint?.capabilities?.hasDatabase) {
    return null;
  }

  if (options.mock) {
    return mockERD(blueprint);
  }

  const provider = getActiveProvider();

  // 1. Build deterministic ground truth entities from static schema extraction and AST
  const databaseInfo = blueprint.database;
  const extractedEntities = Array.isArray(databaseInfo?.entities) ? databaseInfo.entities : [];
  const fallbackModels = Array.isArray(blueprint.models) ? blueprint.models : [];

  const authoritativeEntitiesMap = new Map();

  for (const ent of extractedEntities) {
    if (ent.name) {
      const lower = ent.name.toLowerCase();
      authoritativeEntitiesMap.set(lower, {
        id: `entity-${lower.replace(/[^a-z0-9_-]/g, "-")}`,
        name: ent.name,
        tableName: `${lower.replace(/[^a-z0-9_]/g, "_")}s`,
        fields: Array.isArray(ent.fields) && ent.fields.length > 0
          ? ent.fields.map((f) => ({
              name: f.name || "field",
              type: f.type || "String",
              isPrimary: Boolean(f.isPrimary),
              isForeign: Boolean(f.isForeign),
              isRequired: Boolean(f.isRequired),
              isUnique: Boolean(f.isUnique),
              references: f.references || null,
              defaultValue: f.defaultValue || null,
            }))
          : [
              { name: "_id", type: "ObjectId", isPrimary: true, isForeign: false, isRequired: true, isUnique: true, references: null, defaultValue: null },
            ],
      });
    }
  }

  for (const m of fallbackModels) {
    if (m.name && !authoritativeEntitiesMap.has(m.name.toLowerCase())) {
      const lower = m.name.toLowerCase();
      authoritativeEntitiesMap.set(lower, {
        id: `entity-${lower.replace(/[^a-z0-9_-]/g, "-")}`,
        name: m.name,
        tableName: `${lower.replace(/[^a-z0-9_]/g, "_")}s`,
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isForeign: false, isRequired: true, isUnique: true, references: null, defaultValue: null },
        ],
      });
    }
  }

  const deterministicEntities = Array.from(authoritativeEntitiesMap.values());
  const deterministicRelationships = Array.isArray(databaseInfo?.relationships)
    ? databaseInfo.relationships
        .map((r, idx) => {
          const srcId = authoritativeEntitiesMap.get(r.from?.toLowerCase())?.id;
          const tgtId = authoritativeEntitiesMap.get(r.to?.toLowerCase())?.id;
          if (!srcId || !tgtId) return null;
          return {
            id: `rel-${idx + 1}`,
            sourceEntity: srcId,
            targetEntity: tgtId,
            type: r.type || "one-to-many",
            foreignKey: r.field || "",
          };
        })
        .filter(Boolean)
    : [];

  if (options.mock || deterministicEntities.length === 0 || provider.type === "mock") {
    return mockERD(blueprint);
  }

  const allowedEntityListStr = deterministicEntities.map((e) => e.name).join(", ");

  const databaseContext = {
    type: databaseInfo?.type || "MongoDB",
    authoritativeEntities: deterministicEntities,
    extractedRelationships: deterministicRelationships,
    note: "All entities and fields were extracted directly from the repository source code.",
  };

  const systemInstruction = "You are ArchMind AI Senior Database Architect. Output STRICT JSON only. Ground exclusively on the provided models. Never invent placeholder entities (e.g., Entity1, Entity2, table_1, table_2).";

  const prompt = `
Analyze the following extracted database schema information and generate an Entity Relationship Diagram (ERD).

Project: ${blueprint.metadata?.name || "Unknown"}
Database Type: ${databaseContext.type}
Capabilities: ${JSON.stringify(blueprint.capabilities, null, 2)}

Authoritative Allowed Entities (${deterministicEntities.length} models):
[${allowedEntityListStr}]

Extracted Database Schema & Models:
${JSON.stringify(databaseContext, null, 2)}

Output STRICT JSON matching this exact schema:
{
  "entities": [
    {
      "id": "entity-user",
      "name": "User",
      "tableName": "users",
      "fields": [
        { "name": "_id", "type": "ObjectId", "isPrimary": true, "isForeign": false, "isRequired": true, "isUnique": true },
        { "name": "email", "type": "String", "isPrimary": false, "isForeign": false, "isRequired": true, "isUnique": true }
      ]
    }
  ],
  "relationships": [
    {
      "id": "rel-1",
      "sourceEntity": "entity-user",
      "targetEntity": "entity-project",
      "type": "one-to-many",
      "foreignKey": "userId"
    }
  ]
}

CRITICAL RULES:
1. You MUST generate all ${deterministicEntities.length} authoritative models: [${allowedEntityListStr}]. Do not omit any.
2. NEVER invent placeholder entities (e.g., Entity1, Entity2, Entity3, Entity4, Entity5, table_1, table_2, etc.).
3. NEVER rename entities. Preserve exact model names.
4. Preserve all extracted schema fields from the extracted data above.
5. Every relationship sourceEntity and targetEntity MUST reference a valid entity id from your output.
6. Output ONLY valid JSON. No markdown, no conversational text.
`;

  let llmResult = null;
  try {
    if (provider.type === "groq") {
      const completion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
        model: "openai/gpt-oss-20b",
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content;
      llmResult = parseAndValidateJson(text, "erd", blueprint);
    } else if (provider.type === "gemini") {
      const response = await provider.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      llmResult = parseAndValidateJson(response.text, "erd", blueprint);
    }
  } catch (err) {
    console.warn("[llmService] LLM generation failed, falling back to deterministic extraction:", err.message);
    return { entities: deterministicEntities, relationships: deterministicRelationships };
  }

  // 2. Grounding Merger: Guarantee that EVERY deterministic model and field is present in the final output
  const finalEntitiesMap = new Map();

  // Seed with deterministic extraction (guarantees 100% data integrity for all models)
  for (const ent of deterministicEntities) {
    finalEntitiesMap.set(ent.name.toLowerCase(), { ...ent });
  }

  // Overlay LLM enhancements if valid
  if (llmResult && Array.isArray(llmResult.entities)) {
    for (const llmEnt of llmResult.entities) {
      if (!llmEnt.name) continue;
      const key = llmEnt.name.toLowerCase();
      if (finalEntitiesMap.has(key)) {
        const existing = finalEntitiesMap.get(key);
        // Only adopt LLM fields if they have at least as many fields as static extraction
        if (Array.isArray(llmEnt.fields) && llmEnt.fields.length >= existing.fields.length) {
          finalEntitiesMap.set(key, {
            ...existing,
            tableName: llmEnt.tableName || existing.tableName,
            fields: llmEnt.fields,
          });
        }
      }
    }
  }

  // Merge relationships
  const relationshipsMap = new Map();
  for (const r of deterministicRelationships) {
    relationshipsMap.set(`${r.sourceEntity}->${r.targetEntity}:${r.foreignKey}`, r);
  }
  if (llmResult && Array.isArray(llmResult.relationships)) {
    for (const r of llmResult.relationships) {
      const key = `${r.sourceEntity}->${r.targetEntity}:${r.foreignKey}`;
      if (!relationshipsMap.has(key)) {
        relationshipsMap.set(key, r);
      }
    }
  }

  return {
    entities: Array.from(finalEntitiesMap.values()),
    relationships: Array.from(relationshipsMap.values()),
  };
}

// ── Deterministic Mock Generators ─────────────────────────────────────────────

function mockArchitecture(blueprint) {
  const name = blueprint?.metadata?.name || "Application";
  const langs = blueprint?.metadata?.primaryLanguage || "Node.js";
  const routesCount = blueprint?.routes?.length || 0;
  const modelsCount = blueprint?.models?.length || 0;

  const nodes = [
    {
      id: "node-client",
      type: "custom",
      data: {
        label: "Client Frontend",
        description: "User Interface component",
        tier: "frontend",
        technologies: ["React", "Tailwind"],
      },
    },
    {
      id: "node-server",
      type: "custom",
      data: {
        label: `${name} API Server`,
        description: `Main Application logic (${langs})`,
        tier: "backend",
        technologies: [langs],
        metrics: { routesCount },
      },
    },
  ];

  const edges = [
    {
      id: "edge-1",
      source: "node-client",
      target: "node-server",
      label: "HTTP REST API",
    },
  ];

  if (blueprint?.capabilities?.hasDatabase) {
    nodes.push({
      id: "node-db",
      type: "custom",
      data: {
        label: "Database Cluster",
        description: "Primary Data Store",
        tier: "database",
        technologies: blueprint?.capabilities?.details?.databases || ["MongoDB"],
        metrics: { modelsCount },
      },
    });
    edges.push({
      id: "edge-2",
      source: "node-server",
      target: "node-db",
      label: "ORM Queries",
    });
  }

  return { nodes, edges };
}

export function mockERD(blueprint) {
  const dbSchema = blueprint?.database;
  const hasStructuredSchema = dbSchema && Array.isArray(dbSchema.entities) && dbSchema.entities.length > 0;
  const fallbackModels = Array.isArray(blueprint?.models) ? blueprint.models : [];

  const entities = [];
  const relationships = [];
  const seenEntityNames = new Set();

  if (hasStructuredSchema) {
    // 1. Build entities from structured database extraction
    for (const e of dbSchema.entities) {
      if (!e.name) continue;
      const lower = e.name.toLowerCase();
      seenEntityNames.add(lower);
      entities.push({
        id: `entity-${lower.replace(/[^a-z0-9_-]/g, "-")}`,
        name: e.name,
        tableName: `${lower.replace(/[^a-z0-9_]/g, "_")}s`,
        fields: Array.isArray(e.fields) ? e.fields : [],
      });
    }

    // 2. Build relationships from structured extraction
    if (Array.isArray(dbSchema.relationships)) {
      const entityIdMap = new Map(entities.map((e) => [e.name.toLowerCase(), e.id]));
      for (let idx = 0; idx < dbSchema.relationships.length; idx++) {
        const r = dbSchema.relationships[idx];
        const srcId = entityIdMap.get(r.from?.toLowerCase());
        const tgtId = entityIdMap.get(r.to?.toLowerCase());
        if (srcId && tgtId) {
          relationships.push({
            id: `rel-${idx + 1}`,
            sourceEntity: srcId,
            targetEntity: tgtId,
            type: r.type || "one-to-many",
            foreignKey: r.field || "",
          });
        }
      }
    }
  }

  // 3. Supplement with any AST-detected models not yet in entities
  for (const m of fallbackModels) {
    if (m.name && !seenEntityNames.has(m.name.toLowerCase())) {
      seenEntityNames.add(m.name.toLowerCase());
      const lower = m.name.toLowerCase();
      entities.push({
        id: `entity-${lower.replace(/[^a-z0-9_-]/g, "-")}`,
        name: m.name,
        tableName: `${lower.replace(/[^a-z0-9_]/g, "_")}s`,
        fields: [
          { name: "_id", type: "ObjectId", isPrimary: true, isForeign: false, isRequired: true, isNullable: false, isUnique: true, references: null, defaultValue: null },
          { name: "createdAt", type: "Date", isPrimary: false, isForeign: false, isRequired: false, isNullable: false, isUnique: false, references: null, defaultValue: null },
        ],
      });
    }
  }

  return { entities, relationships };
}