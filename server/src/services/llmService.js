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
export function parseAndValidateJson(text, type = "architecture") {
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
    return validateErdSchema(parsed);
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
 */
function validateErdSchema(data) {
  const entities = Array.isArray(data.entities) ? data.entities : [];
  const rawRelationships = Array.isArray(data.relationships) ? data.relationships : [];

  const validEntities = entities.map((ent, idx) => ({
    id: String(ent.id || `entity-${idx + 1}`),
    name: ent.name || `Entity${idx + 1}`,
    tableName: ent.tableName || ent.name || `table_${idx + 1}`,
    fields: Array.isArray(ent.fields)
      ? ent.fields.map((f) => ({
          name: f.name || "field",
          type: f.type || "String",
          isPrimary: Boolean(f.isPrimary),
          isNullable: f.isNullable !== false,
        }))
      : [],
  }));

  const entityIds = new Set(validEntities.map((e) => e.id));

  const validRelationships = rawRelationships
    .filter(
      (r) =>
        r &&
        r.sourceEntity &&
        r.targetEntity &&
        entityIds.has(String(r.sourceEntity)) &&
        entityIds.has(String(r.targetEntity))
    )
    .map((r, idx) => ({
      id: String(r.id || `rel-${idx + 1}`),
      sourceEntity: String(r.sourceEntity),
      targetEntity: String(r.targetEntity),
      type: r.type || "one-to-many",
      foreignKey: r.foreignKey || "",
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

  const systemInstruction = "You are ArchMind AI Senior Database Architect. Output STRICT JSON only.";
  const prompt = `
Analyze the database models and schemas in the following Repository Blueprint and generate an Entity Relationship Diagram (ERD).

Repository Blueprint:
${JSON.stringify(blueprint, null, 2)}

Output STRICT JSON matching this schema:
{
  "entities": [
    {
      "id": "entity-user",
      "name": "User",
      "tableName": "users",
      "fields": [
        { "name": "id", "type": "ObjectId", "isPrimary": true, "isNullable": false },
        { "name": "clerkId", "type": "String", "isPrimary": false, "isNullable": false }
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

Rules:
1. Every relationship "sourceEntity" and "targetEntity" MUST exist in "entities".
2. "type" must be one of: "one-to-one", "one-to-many", "many-to-many".
3. Ground entities strictly on models extracted in the blueprint.
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
      return parseAndValidateJson(text, "erd");
    } else if (provider.type === "gemini") {
      const response = await provider.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      return parseAndValidateJson(response.text, "erd");
    } else {
      return mockERD(blueprint);
    }
  } catch (err) {
    console.error("[llmService] generateERD error:", err.message);
    throw new Error(`ERD LLM Generation Failed: ${err.message}`);
  }
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

function mockERD(blueprint) {
  const models = blueprint?.models || [];
  const entities = models.map((m, idx) => ({
    id: `entity-${m.name.toLowerCase()}`,
    name: m.name,
    tableName: `${m.name.toLowerCase()}s`,
    fields: [
      { name: "id", type: "ObjectId", isPrimary: true, isNullable: false },
      { name: "createdAt", type: "Date", isPrimary: false, isNullable: false },
    ],
  }));

  if (entities.length === 0) {
    entities.push({
      id: "entity-default",
      name: "Record",
      tableName: "records",
      fields: [{ name: "id", type: "String", isPrimary: true, isNullable: false }],
    });
  }

  const relationships = [];
  if (entities.length > 1) {
    relationships.push({
      id: "rel-1",
      sourceEntity: entities[0].id,
      targetEntity: entities[1].id,
      type: "one-to-many",
      foreignKey: `${entities[0].name.toLowerCase()}Id`,
    });
  }

  return { entities, relationships };
}
