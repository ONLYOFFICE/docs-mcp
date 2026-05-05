# ONLYOFFICE Docs MCP Server

This server supports both MCP transports:

- `stdio`, for clients that start the server process themselves.
- Streamable HTTP, exposed at `/mcp`.

## Required Configuration

Set these environment variables for both transports:

```sh
DOCUMENT_SERVER_BASE_URL=https://your-onlyoffice-instance.example.com
DOCUMENT_SERVER_JWT_SECRET=your-secret
```

For local `file://` access with stdio, also set:

```sh
LOCAL_FILE_ALLOWED_ROOTS=/projects
```

The value must point to paths inside the container, not host paths.

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
        "-e", "LOCAL_FILE_ALLOWED_ROOTS=/projects",
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
  -e CORS_ALLOWED_ORIGINS=http://localhost:3000 \
  onlyoffice/docs-mcp
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

You can override the default port with command-line arguments:

```sh
docker run --rm -p 8080:8080 onlyoffice/docs-mcp --http --host 0.0.0.0 --port 8080
```

Local `file://` URLs are intentionally supported only over stdio transport.
