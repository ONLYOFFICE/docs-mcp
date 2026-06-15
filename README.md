# ONLYOFFICE Docs MCP Server

The ONLYOFFICE Docs MCP Server connects AI tools to ONLYOFFICE Docs. It lets AI
agents, assistants, and chatbots create, open, edit, and save office documents
through natural language interactions.

### Use Cases

- Document Editing: Open and modify text documents, spreadsheets, and
  presentations directly in the ONLYOFFICE editor.
- File Creation: Create new DOCX, XLSX, and PPTX files from blank templates.
- Editor Sessions: Open documents in an embedded ONLYOFFICE editor and save the
  current document state.
- Local and Remote File Workflows: Open files from allowed URLs, uploaded files,
  or local `file://` paths when using stdio transport.
- Embedded App Integrations: Use app tools to coordinate editor sessions,
  command execution, and file streaming.

---

## Prerequisites

- ONLYOFFICE Docs.
- Docker or Node.js with npm, depending on how you want to run the server.
- An MCP client that supports `stdio` or Streamable HTTP transport.

## Quick Start

The server can run over `stdio` or Streamable HTTP. Use `stdio` when an MCP
client starts the server process for each session. Use Streamable HTTP when you
want a long-running server exposed at `/mcp`.

At minimum, both transports need access to your ONLYOFFICE Document Server:

```sh
DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com
DOCUMENT_SERVER_JWT_SECRET=your-secret
```

Set `FILE_URL_ALLOWED_ORIGINS` when opening remote document URLs. Set
`STDIO_LOCAL_FILE_ALLOWED_ROOTS` only when opening local `file://` URLs over
stdio.

> [!IMPORTANT]
> Opening local files with `STDIO_LOCAL_FILE_ALLOWED_ROOTS` is available only
> in ONLYOFFICE Docs Developer.
>
> This is a premium feature not included by default and is available at an
> extra cost. Please contact our sales team at sales@onlyoffice.com to request a
> quote, or learn more at https://www.onlyoffice.com/developer-edition.

### stdio with Docker

Example MCP client configuration:

```json
{
  "mcpServers": {
    "onlyoffice-docs": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com",
        "-e", "DOCUMENT_SERVER_JWT_SECRET=your-secret",
        "-e", "STDIO_LOCAL_FILE_ALLOWED_ROOTS=/projects",
        "--mount", "type=bind,src=/Users/username/Desktop,dst=/projects/Desktop",
        "onlyoffice/docs-mcp",
        "--stdio"
      ]
    }
  }
}
```

With this configuration, local files are passed as container paths:

```text
file:///projects/Desktop/example.docx
```

### stdio with npm

Example MCP client configuration:

```json
{
  "mcpServers": {
    "onlyoffice-docs": {
      "command": "npx",
      "args": ["-y", "@onlyoffice/docs-mcp", "--stdio"],
      "env": {
        "DOCUMENT_SERVER_BASE_URL": "https://your-onlyoffice-instance.example.com",
        "DOCUMENT_SERVER_JWT_SECRET": "your-secret",
        "STDIO_LOCAL_FILE_ALLOWED_ROOTS": "/Users/username/Desktop"
      }
    }
  }
}
```

With npm, local `file://` URLs use host paths:

```text
file:///Users/username/Desktop/example.docx
```

### Streamable HTTP with Docker

Run the HTTP server:

```sh
docker run --rm \
  -p 3001:3001 \
  -e DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com \
  -e DOCUMENT_SERVER_JWT_SECRET=your-secret \
  -e HTTP_ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e HTTP_CORS_ALLOWED_ORIGINS=http://localhost:3001 \
  onlyoffice/docs-mcp
```

The MCP endpoint is:

```text
http://localhost:3001/mcp
```

The HTTP health check endpoint is:

```text
http://localhost:3001/health
```

It returns `200` when the HTTP server is running.

Configure an MCP client that supports Streamable HTTP to use this endpoint.

### Streamable HTTP with npm

Run the HTTP server:

```sh
DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com \
DOCUMENT_SERVER_JWT_SECRET=your-secret \
HTTP_ALLOWED_HOSTS=localhost,127.0.0.1 \
HTTP_CORS_ALLOWED_ORIGINS=http://localhost:3001 \
npx -y @onlyoffice/docs-mcp --http --host 127.0.0.1 --port 3001
```

The MCP endpoint is:

```text
http://localhost:3001/mcp
```

The HTTP health check endpoint is:

```text
http://localhost:3001/health
```

Configure an MCP client that supports Streamable HTTP to use this endpoint.

If the HTTP server is behind a reverse proxy that sends `X-Forwarded-For`
(for example nginx, Traefik, or ngrok), configure Express to trust the proxy hop
used by your deployment:

```sh
HTTP_TRUST_PROXY=1
```

Local `file://` URLs are intentionally supported only over stdio transport.

## Tools

The server exposes tools for creating, opening, editing, and saving files. A
typical editing flow is:

1. Open or create a file with `open_file` or `create_file`.
2. Make edits in the embedded ONLYOFFICE editor.
3. Save the result with `save_file`.

### Server tools

These tools are the main MCP interface for creating, opening, editing, and
saving files.

| Tool | Purpose |
| --- | --- |
| `create_file` | Creates a blank DOCX, XLSX, PPTX, or PDF file and opens it for editing. |
| `open_file` | Opens an existing file from a URL, uploaded file, or allowed local `file://` URL in stdio mode. |
| `save_file` | Triggers download of the currently open document. |

### App tools

These tools support embedded app integrations and are not intended to be called
directly.

| Tool | Purpose |
| --- | --- |
| `poll_editor_commands` | Long-polls queued commands for an embedded app integration. |
| `set_editor_command_result` | Reports command execution results from an embedded app integration back to the server. |
| `read_file_content` | Streams blank templates or allowed local files as base64 chunks. |

## Configuration

The server is configured with command-line options and environment variables.
Command-line options select the transport and listener, while environment
variables provide deployment-specific settings such as secrets and server URLs.

The server validates configuration on startup and fails fast when a required
value is missing or invalid.

### Command-line options

Use CLI options to select the MCP transport and, for Streamable HTTP, the
listener address.

| CLI option | Required | Default | Description |
| --- | --- | --- | --- |
| `--stdio` | No | Disabled | Starts the server with stdio transport. Cannot be used together with `--http`. |
| `--http` | No | Enabled | Starts the server with Streamable HTTP transport. This is the default when no transport option is provided. Cannot be used together with `--stdio`. |
| `--host <host>` | No | `127.0.0.1` | Host interface for Streamable HTTP. The Docker image overrides this to `0.0.0.0` in its default command. |
| `--port <port>` | No | `3001` | Port for Streamable HTTP. Must be an integer from `1` to `65535`. |

### Environment variables

Use environment variables for deployment-specific settings. List-style values can
be provided as comma-separated strings or JSON arrays. Tool allowlists and
blocklists also accept `all`.

#### Shared

These variables are used by both `stdio` and Streamable HTTP transports.

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DOCUMENT_SERVER_BASE_URL` | Yes | `<not set>` | Base URL of the ONLYOFFICE Document Server. Must be a valid URL. |
| `DOCUMENT_SERVER_JWT_SECRET` | Yes | `<not set>` | JWT secret used to sign editor configuration tokens. |
| `DOCUMENT_SERVER_JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm. Supported values: `HS256`, `HS384`, `HS512`. |
| `DOCUMENT_SERVER_JWT_EXPIRES_IN` | No | `60` | JWT token lifetime in seconds. |
| `FILE_URL_ALLOWED_ORIGINS` | No | `<empty>` | Allowed origins, domains, or wildcard domains for remote `http://` and `https://` document file URLs. Use `*` to allow any origin. Entries with a scheme, such as `https://files.example.com`, match that exact origin. Entries without a scheme, such as `files.example.com` or `*.example.com`, match both `http` and `https`; wildcard domains match nested subdomains but not the parent domain. |

#### stdio

These variables apply only when the server is started with `--stdio`.

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `STDIO_LOCAL_FILE_ALLOWED_ROOTS` | No | `<empty>` | Allowed local directories for `file://` document access in stdio mode. The paths must be visible inside the running process or container. Available only in ONLYOFFICE Docs Developer. |

#### Streamable HTTP

These variables apply only when the server is started with `--http`.

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HTTP_ALLOWED_HOSTS` | No | `<empty>` | Additional hostnames accepted by the Streamable HTTP server. `localhost`, `127.0.0.1`, `[::1]`, and the configured `--host` value are always allowed. |
| `HTTP_TRUST_PROXY` | No | `false` | Express `trust proxy` setting. Accepts `false`, `true`, a non-negative integer, or a custom trust proxy value. |
| `HTTP_CORS_ALLOWED_ORIGINS` | No | `<empty>` | Browser origins allowed by CORS. Use `*` to allow any origin. Requests without an `Origin` header are allowed. |
| `HTTP_RATE_LIMIT_WINDOW_MS` | No | `60000` | HTTP rate limit window in milliseconds. |
| `HTTP_RATE_LIMIT_MAX_REQUESTS` | No | `120` | Maximum HTTP requests per client within the rate limit window. |
| `HTTP_RATE_LIMIT_MAX_IN_FLIGHT` | No | `20` | Maximum concurrent HTTP requests per client. |

## License

The ONLYOFFICE Docs MCP server is distributed under the MIT license found in the
[LICENSE] file.

<!-- Footnotes -->

[LICENSE]: https://github.com/ONLYOFFICE/docs-mcp/blob/master/LICENSE
