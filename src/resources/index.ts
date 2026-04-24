import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { editorResource } from "./editor.js";

export interface McpResource {
  register(server: McpServer, distDir: string): void;
}

const resources: McpResource[] = [editorResource];

export function registerAllResources(server: McpServer, distDir: string): void {
  for (const resource of resources) {
    resource.register(server, distDir);
  }
}
