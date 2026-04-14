import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startStdioServer(createServer: () => McpServer): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}
