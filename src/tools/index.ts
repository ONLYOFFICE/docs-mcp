import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createEditorConfig } from "./definitions/create-editor-config.js";
import { openFile } from "./definitions/open-file.js";
import { readFileContent } from "./definitions/read-file-content.js";

export interface McpTool {
  register(server: McpServer): void;
}

const tools: McpTool[] = [openFile, createEditorConfig, readFileContent];

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    tool.register(server);
  }
}
