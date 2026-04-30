import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../tools/index.js";
import { registerAllResources } from "../resources/index.js";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "..", "..", "dist")
  : path.dirname(process.argv[1]);

/**
 * Creates a new MCP server instance with tools and resources registered.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "ONLYOFFICE Editor MCP App Server",
    version: "0.0.1",
  });

  registerAllTools(server);
  registerAllResources(server, DIST_DIR);

  return server;
}
