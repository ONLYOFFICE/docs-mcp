import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openFile } from "./definitions/open-file.js";
import { readFileContent } from "./definitions/read-file-content.js";

export interface McpTool {
  register(server: McpServer): void;
}

const tools: McpTool[] = [openFile, readFileContent];

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    tool.register(server);
  }
}
