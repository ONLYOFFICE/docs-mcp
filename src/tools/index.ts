import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createFile } from "./definitions/create-file.js";
import { openFile } from "./definitions/open-file.js";
import { pollEditorCommands } from "./definitions/poll-editor-commands.js";
import { readFileContent } from "./definitions/read-file-content.js";
import { saveFile } from "./definitions/save-file.js";
import { setEditorCommandResult } from "./definitions/set-editor-command-result.js";

export interface McpTool {
  register(server: McpServer): void;
}

const tools: McpTool[] = [
  createFile,
  openFile,
  saveFile,
  pollEditorCommands,
  setEditorCommandResult,
  readFileContent,
];

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    tool.register(server);
  }
}
