# ONLYOFFICE Docs MCP Server

This server supports both MCP transports:

- `stdio`, for clients that start the server process themselves.
- Streamable HTTP, exposed at `/mcp`.

## Required Configuration

### Shared

```sh
DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com
DOCUMENT_SERVER_JWT_SECRET=your-secret
FILE_URL_ALLOWED_ORIGINS=https://files.example.com
```

These variables are used by both transports.

### stdio Transport

```sh
STDIO_LOCAL_FILE_ALLOWED_ROOTS=/projects
```

Set `STDIO_LOCAL_FILE_ALLOWED_ROOTS` only when local `file://` access is needed
with stdio. The value must point to paths inside the container, not host paths.

### HTTP Transport

HTTP-only variables use the `HTTP_` prefix:

```sh
HTTP_ALLOWED_HOSTS=localhost,127.0.0.1
HTTP_TRUST_PROXY=1
HTTP_CORS_ALLOWED_ORIGINS=http://localhost:3001
HTTP_RATE_LIMIT_WINDOW_MS=60000
HTTP_RATE_LIMIT_MAX_REQUESTS=120
HTTP_RATE_LIMIT_MAX_IN_FLIGHT=20
```

## Build the Docker Image

```sh
docker build -t onlyoffice/docs-mcp .
```

## stdio Transport

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
        "--mount", "type=bind,src=/path/to/other/allowed/dir,dst=/projects/other/allowed/dir,ro",
        "--mount", "type=bind,src=/path/to/file.txt,dst=/projects/path/to/file.txt,ro",
        "onlyoffice/docs-mcp",
        "--stdio"
      ]
    }
  }
}
```

In this mode, users can pass local files as container paths, for example:

```text
file:///projects/Desktop/example.docx
```

## Streamable HTTP Transport

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

If the HTTP server is behind a reverse proxy that sends `X-Forwarded-For`
(for example nginx, Traefik, or ngrok), configure Express to trust the proxy
hop used by your deployment:

```sh
HTTP_TRUST_PROXY=1
```

You can override the default port with command-line arguments:

```sh
docker run --rm -p 8080:8080 onlyoffice/docs-mcp --http --host 0.0.0.0 --port 8080
```

Local `file://` URLs are intentionally supported only over stdio transport.

## Tools

The server exposes tools for creating, opening, editing, and saving files. A
typical editing flow is:

1. Open or create a file with `open_file` or `create_file`.
2. Discover editor-specific tools with `list_editor_tools`.
3. Execute editor actions with `call_editor_tool`.
4. Save the result with `save_file`.

### Server tools

These tools are the main MCP interface for creating, opening, editing, and
saving files.

| Tool | Purpose |
| --- | --- |
| `create_file` | Creates a blank DOCX, XLSX, or PPTX file and opens it for editing. |
| `open_file` | Opens an existing file from a URL, uploaded file, or allowed local `file://` URL in stdio mode. |
| `list_editor_tools` | Lists the editor tools available for the current session and document type. |
| `call_editor_tool` | Executes a named editor tool returned by `list_editor_tools`. |
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
| `FILE_URL_ALLOWED_ORIGINS` | No | `<empty>` | Allowed origins for remote `http://` and `https://` document file URLs. Use `*` to allow any origin. |
| `DOCUMENT_SERVER_AI_WORD_TOOLS_ENABLED` | No | `insertPage`<br>`changeParagraphStyle`<br>`changeTextStyle`<br>`writeMacro` | Word editor AI tools available through `list_editor_tools`. Set to `all` to allow every Word tool reported by the editor. |
| `DOCUMENT_SERVER_AI_WORD_TOOLS_DISABLED` | No | `<empty>` | Word editor AI tools to hide even if enabled. Set to `all` to hide every Word tool. |
| `DOCUMENT_SERVER_AI_CELL_TOOLS_ENABLED` | No | `addAboveAverage`<br>`addCellValueCondition`<br>`addChart`<br>`addColorScale`<br>`addConditionalFormatting`<br>`addDataBars`<br>`addIconSet`<br>`addTop10Condition`<br>`addUniqueValues`<br>`clearConditionalFormatting`<br>`formatTable`<br>`changeTextStyle`<br>`writeMacro` | Spreadsheet editor AI tools available through `list_editor_tools`. Set to `all` to allow every spreadsheet tool reported by the editor. |
| `DOCUMENT_SERVER_AI_CELL_TOOLS_DISABLED` | No | `<empty>` | Spreadsheet editor AI tools to hide even if enabled. Set to `all` to hide every spreadsheet tool. |
| `DOCUMENT_SERVER_AI_SLIDE_TOOLS_ENABLED` | No | `addNewSlide`<br>`addShapeToSlide`<br>`addTableToSlide`<br>`addTextToPlaceholder`<br>`changeSlideBackground`<br>`deleteSlide`<br>`duplicateSlide`<br>`writeMacro` | Presentation editor AI tools available through `list_editor_tools`. Set to `all` to allow every presentation tool reported by the editor. |
| `DOCUMENT_SERVER_AI_SLIDE_TOOLS_DISABLED` | No | `<empty>` | Presentation editor AI tools to hide even if enabled. Set to `all` to hide every presentation tool. |
| `DOCUMENT_SERVER_AI_PDF_TOOLS_ENABLED` | No | `<empty>` | PDF editor AI tools available through `list_editor_tools`. Set to `all` to allow every PDF tool reported by the editor. |
| `DOCUMENT_SERVER_AI_PDF_TOOLS_DISABLED` | No | `all` | PDF editor AI tools to hide even if enabled. Set to `all` to hide every PDF tool. |

#### stdio

These variables apply only when the server is started with `--stdio`.

| Environment variable | Required | Default | Description |
| --- | --- | --- | --- |
| `STDIO_LOCAL_FILE_ALLOWED_ROOTS` | No | `<empty>` | Allowed local directories for `file://` document access in stdio mode. The paths must be visible inside the running process or container. |

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
