import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpResource {
  register(server: McpServer): void;
}
