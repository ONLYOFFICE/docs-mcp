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
HTTP_CORS_ALLOWED_ORIGINS=http://localhost:3000
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
  -p 3000:3000 \
  -e DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com \
  -e DOCUMENT_SERVER_JWT_SECRET=your-secret \
  -e HTTP_ALLOWED_HOSTS=localhost,127.0.0.1 \
  -e HTTP_CORS_ALLOWED_ORIGINS=http://localhost:3000 \
  onlyoffice/docs-mcp
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
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
