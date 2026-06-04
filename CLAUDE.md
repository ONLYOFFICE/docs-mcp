# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (watch mode — rebuilds UI and restarts server on changes)
npm start

# Development HTTP transport on a custom host/port
pnpm run serve -- --host 0.0.0.0 --port 3001

# Development with stdio transport
npm run dev:stdio

# Production build (type-check + compile server declarations + bundle UI)
npm run build

# Run in stdio mode (for MCP clients that use stdio transport)
node dist/index.js --stdio
```

No test suite is configured (`npm test` exits with an error).

## Environment

Copy `.env.example` to `.env` before running:

```
DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com
```

`src/config.ts` parses and validates these with Zod at startup; missing or invalid values throw immediately.

## Architecture

This is an **MCP (Model Context Protocol) server** that bridges an AI assistant to the ONLYOFFICE Document Server. It exposes tools so an LLM can open and edit office documents in a browser-embedded editor.

### Two build targets

| Target | Entry | Compiler | Output |
|--------|-------|----------|--------|
| Server | `src/index.ts` | Bun | `dist/index.js` |
| Editor UI | `src/ext-apps/editor/index.html` + `index.ts` | Vite + `vite-plugin-singlefile` | `dist/ext-apps/editor/index.html` (single self-contained HTML file) |

The UI is a single-file HTML bundle inlined into the MCP resource at runtime by `src/resources/editor.ts`.

### Transport modes

`src/index.ts` selects transport based on CLI flags (`--http` by default, or `--stdio`). HTTP bind options are passed with `--host` and `--port` and default to `127.0.0.1:3001`.
- **HTTP** (`src/server/streamable-http.ts`): Streamable HTTP via Express. Each request creates a new `McpServer` + `StreamableHTTPServerTransport` pair (stateless per-request).
- **stdio** (`src/server/stdio.ts`): Single `McpServer` connected to `StdioServerTransport`.

### Tool taxonomy

Tools are split into two visibility planes:

**AI-facing tools** (called by the LLM):
- `open_file` — open a document; returns `{ sessionId, documentServerBaseUrl, config }`. Uses `registerAppTool` from `@modelcontextprotocol/ext-apps/server`, which causes the MCP host to render the editor UI resource alongside the tool response.

**App-only tools** (`_meta: { visibility: ["app"] }`, called only by the embedded editor UI):
- `read_file_content` — streams allowed local files into the embedded editor.

Each session is keyed by `sessionId` (a UUID generated at `open_file` time).

### UI client (`src/ui/`)

`DocEditorClient` (`src/ui/doc-editor-client.ts`) manages the ONLYOFFICE `DocsAPI.DocEditor` lifecycle:
- Loads `api.js` from the Document Server dynamically.
- Streams local files through `read_file_content` when the editor needs file bytes.

### Adding a new tool

1. Create `src/tools/your-tool.ts` exporting an object that satisfies `McpTool`.
2. Register it with `server.registerTool(...)` or `registerAppTool(...)` in the `register` method.
3. Add it to the `tools` array in `src/tools/index.ts`.

### Adding a new resource

Same pattern: implement `McpResource`, register via `registerAppResource` or `server.resource`, add to `src/resources/index.ts`.
