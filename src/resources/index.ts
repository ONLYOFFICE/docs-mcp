import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpResource } from "./resource.js";
import { editorResource } from "./editor.js";

const resources: McpResource[] = [editorResource];

export function registerAllResources(server: McpServer): void {
  for (const resource of resources) {
    resource.register(server);
  }
}
