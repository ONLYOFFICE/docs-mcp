import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callEditorTool } from "./call-editor-tool.js";
import { createFile } from "./create-file.js";
import { listEditorTools } from "./list-editor-tools.js";
import { openFile } from "./open-file.js";
import { pollEditorCommands } from "./poll-editor-commands.js";
import { readFileContent } from "./read-file-content.js";
import { saveFile } from "./save-file.js";
import { setEditorCommandResult } from "./set-editor-command-result.js";

export interface McpTool {
  register(server: McpServer): void;
}

const tools: McpTool[] = [
  createFile,
  openFile,
  listEditorTools,
  callEditorTool,
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
