# Feature 12: Tree-sitter AST Parsing Integration

## Objective
Extract structural intelligence from source code using Tree-sitter AST parsing. This acts as the core engine for code comprehension, allowing ArchMind AI to understand functions, classes, imports, and dependencies accurately without relying on error-prone Regex.

## Scope
1. Integrate `tree-sitter` and standard language grammars (e.g., JavaScript, TypeScript, Python).
2. Create an extraction service that visits the AST to find:
   - Imports/Exports
   - Classes and Methods
   - Functions and Signatures
   - API Endpoints (e.g., Express/Fastify routes)
3. Connect the AST parsing engine to the RIE (Repository Intelligence Engine) pipeline.

## Implementation Details
- Add `tree-sitter` and relevant language parsers (e.g., `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-python`).
- Create `server/src/rie/astParser.js` to handle syntax tree generation.
- Map the extracted structure to a standardized JSON representation.
- Ensure the parsing step only executes on relevant code files, skipping static assets, configs (unless needed for framework detection), and noise.

## Testing
- Provide sample code files (JS, TS, Python) and assert the correct extraction of functions and classes.
- Validate performance over a large file.
