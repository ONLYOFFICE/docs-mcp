import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startStdioServer(createServer: () => McpServer): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  const shutdown = () => {
    server.close().catch(() => {}).finally(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.connect(transport);
}
