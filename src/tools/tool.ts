import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpTool {
  register(server: McpServer): void;
}
