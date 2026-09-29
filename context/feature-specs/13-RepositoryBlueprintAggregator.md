# Feature 13: Repository Blueprint Aggregator

## Objective
Aggregate the intelligence gathered from the repository (file tree, language detection, capability matrix, and AST parsing) into a single, structured payload—the **Repository Blueprint**. This blueprint serves as the optimized context window payload for the LLM.

## Scope
1. Define the JSON schema for the Repository Blueprint.
2. Create an aggregation service that collects data from all previous RIE steps.
3. Optimize the size of the blueprint to prevent LLM context overflow (e.g., summarizing large files, focusing on core logic).
4. Save the compiled blueprint to MongoDB or pass it directly to the analysis queue.

## Implementation Details
- Create `server/src/rie/blueprintAggregator.js`.
- Inputs: 
  - Filtered file tree
  - Tech stack & languages
  - Smart Relevance capabilities (`hasDatabase`, `hasApis`, etc.)
  - AST-extracted structures (from Feature 12)
- Output: A highly dense, token-efficient JSON string or object.
- Implement token approximation to ensure the payload fits within standard API limits (e.g., Gemini / Groq).

## Testing
- Aggregate a sample repository (like the ones used in previous tests).
- Validate that the output JSON matches the expected schema.
- Validate that noise files and disabled capability scopes are excluded from the blueprint.
