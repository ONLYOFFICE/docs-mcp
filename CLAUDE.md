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

This is an **MCP (Model Context Protocol) server** that bridges an AI assistant to the ONLYOFFICE Document Server. It exposes tools so an LLM can open, edit, and save office documents in a browser-embedded editor.

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
- `create_file` / `open_file` — create or open a document; return `{ sessionId, documentServerBaseUrl, config }`. Use `registerAppTool` from `@modelcontextprotocol/ext-apps/server`, which causes the MCP host to render the editor UI resource alongside the tool response.
- `list_editor_tools` — queries the editor plugin for available AI tools via the command queue.
- `call_editor_tool` — executes a named plugin tool in the open editor.
- `save_file` — triggers `downloadAs()` in the browser.

**App-only tools** (`_meta: { visibility: ["app"] }`, called only by the embedded editor UI):
- `poll_editor_commands` — long-poll endpoint; the browser polls this after the editor is ready.
- `set_editor_command_result` — the browser calls this to return command results back to the server.

### Command queue (the core communication pattern)

`src/command-queue.ts` implements a **promise-based long-poll bridge** between the server and the browser:

1. AI calls `list_editor_tools` / `call_editor_tool` → server enqueues a `Command` in `CommandQueue` and awaits its promise (30 s timeout).
2. Browser's `Poller` (`src/ui/poller.ts`) continuously calls `poll_editor_commands` → `CommandQueue.longPoll()` blocks until a command arrives (up to 30 s), then returns the batch.
3. Browser executes the command via the ONLYOFFICE Connector API, then calls `set_editor_command_result` → `CommandQueue.resolve()` resolves the original promise.

Each session is keyed by `sessionId` (a UUID generated at `open_file`/`create_file` time).

### UI client (`src/ui/`)

`DocEditorClient` (`src/ui/doc-editor-client.ts`) manages the ONLYOFFICE `DocsAPI.DocEditor` lifecycle:
- Loads `api.js` from the Document Server dynamically.
- On `onDocumentReady`: creates a `Connector`, attaches the `ai_onCallToolResult` event, and starts the `Poller`.
- Handles three command types: `aiListTools` (via `connector.executeMethod("AI", ...)`), `aiCallTool` (via `connector.sendEvent("ai_onCallTool", ...)`), `saveFile` (via `docEditor.downloadAs()`).
- Commands are processed serially; the next command only starts after `set_editor_command_result` resolves the current one.

### Adding a new tool

1. Create `src/tools/your-tool.ts` exporting an object that satisfies `McpTool`.
2. Register it with `server.registerTool(...)` or `registerAppTool(...)` in the `register` method.
3. Add it to the `tools` array in `src/tools/index.ts`.

### Adding a new resource

Same pattern: implement `McpResource`, register via `registerAppResource` or `server.resource`, add to `src/resources/index.ts`.
