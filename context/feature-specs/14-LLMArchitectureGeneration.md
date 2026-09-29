# Feature 14: LLM API Integration for Architecture Generation

## Objective
Integrate an LLM provider (Gemini or Groq) to consume the Repository Blueprint and generate structured architectural insights (Topology, ERD, API Sequences, etc.).

## Scope
1. Implement the API client for the selected LLM provider.
2. Define rigorous system prompts to force the LLM to output valid JSON matching the UI requirements (e.g., nodes and edges for React Flow).
3. Connect the LLM generator to the `analysis.controller.js` to transition modules from `processing` to `completed`.
4. Handle rate limits, timeouts, and JSON parsing fallbacks (repairing malformed JSON).

## Implementation Details
- Add required SDKs (e.g., `@google/genai` or `@groq/groq-sdk`).
- Create `server/src/services/llmService.js` with functions like `generateArchitecture(blueprint)` and `generateERD(blueprint)`.
- Use structured outputs (JSON schema mode) if the provider supports it, otherwise use robust parsing logic.
- Update `server/src/controllers/analysis.controller.js` to dispatch LLM calls asynchronously.

## Testing
- Mock the LLM provider to return a predefined JSON response.
- Validate that `analyzeModule` successfully updates the project's analysis status to `completed` and stores the generated data.
- Add error handling tests (e.g., LLM returns invalid JSON or times out) ensuring status goes to `failed`.
