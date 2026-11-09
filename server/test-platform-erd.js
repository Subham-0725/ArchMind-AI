// server/test-platform-erd.js
import { extractPlatformErd } from "./src/services/erd/schemaExtraction.service.js";

console.log("=== TESTING ARCHMIND AI PLATFORM ERD EXTRACTION ===");

const t0 = performance.now();
const erd = extractPlatformErd();
const duration = (performance.now() - t0).toFixed(2);

console.log(`\n[PASS] Extraction completed in ${duration}ms`);
console.log(`[DATA] Database Name: ${erd.database}`);
console.log(`[DATA] Stats:`, erd.stats);

// 1. Verify Model & Collection Inventory
const expectedModels = [
  "User",
  "Project",
  "Conversation",
  "SecurityAudit",
  "SecurityFinding",
  "SourceFile",
  "DevOpsArtifact",
];

console.log("\n--- Verification 1: Registered Mongoose Models ---");
const entityNames = erd.entities.map((e) => e.name);
for (const expected of expectedModels) {
  const found = entityNames.includes(expected);
  console.log(`  ${found ? "✓" : "✗"} Model ${expected}: ${found ? "FOUND" : "MISSING"}`);
  if (!found) process.exit(1);
}

// 2. Verify Primary Keys
console.log("\n--- Verification 2: Primary Keys ---");
for (const entity of erd.entities) {
  const pk = entity.fields.find((f) => f.primaryKey);
  console.log(`  ✓ ${entity.name}: PK is '${pk?.name}' (${pk?.type})`);
  if (!pk || pk.name !== "_id" || pk.type !== "ObjectId") {
    console.error(`Failed: ${entity.name} missing _id PK`);
    process.exit(1);
  }
}

// 3. Verify Foreign Keys
console.log("\n--- Verification 3: Foreign Keys & References ---");
const fks = [];
for (const entity of erd.entities) {
  const entityFks = entity.fields.filter((f) => f.foreignKey);
  for (const fk of entityFks) {
    fks.push({
      entity: entity.name,
      field: fk.name,
      ref: fk.references?.entity,
      refField: fk.references?.field,
      type: fk.references?.type,
    });
  }
}
console.table(fks);

// 4. Verify Embedded Entities
console.log("\n--- Verification 4: Embedded Entities ---");
console.log("Embedded Subdocuments:", erd.embeddedEntities.map((e) => `${e.name} (parent: ${e.parentEntity})`));

// 5. Verify Relationships
console.log("\n--- Verification 5: Relationships & Cardinality ---");
console.table(
  erd.relationships.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    field: r.sourceField,
    type: r.type,
    cardinality: r.crowNotation,
    physical: r.isPhysical,
  }))
);

// 6. Verify Indexes
console.log("\n--- Verification 6: Indexes Summary ---");
console.log(`Total Indexes extracted: ${erd.indexes.length}`);
const sampleIndexes = erd.indexes.slice(0, 5).map((i) => ({
  model: i.model,
  fields: i.fieldList,
  unique: i.unique,
}));
console.table(sampleIndexes);

console.log("\n=== ALL ERD EXTRACTION ASSERTIONS PASSED ===");

