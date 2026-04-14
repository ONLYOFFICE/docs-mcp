import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./src/tools/index.js";
import { registerAllResources } from "./src/resources/index.js";

/**
 * Creates a new MCP server instance with tools and resources registered.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "ONLYOFFICE Editor MCP App Server",
    version: "0.0.1",
  });

  registerAllTools(server);
  registerAllResources(server);

  return server;
}
