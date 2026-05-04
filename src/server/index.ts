import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../tools/index.js";
import { registerAllResources } from "../resources/index.js";
import path from "node:path";
import packageJson from "../../package.json" with { type: "json" };

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "..", "..", "dist")
  : path.dirname(process.argv[1]);

/**
 * Creates a new MCP server instance with tools and resources registered.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  registerAllTools(server);
  registerAllResources(server, DIST_DIR);

  return server;
}
