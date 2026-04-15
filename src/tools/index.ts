import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpTool } from "./tool.js";
import { callEditorTool } from "./call-editor-tool.js";
import { createFile } from "./create-file.js";
import { listEditorTools } from "./list-editor-tools.js";
import { openFile } from "./open-file.js";
import { pollCommands } from "./editor-app/poll-commands.js";
import { readFileContent } from "./editor-app/read-file-content.js";
import { saveFile } from "./save-file.js";
import { setCommandResult } from "./editor-app/set-command-result.js";

const tools: McpTool[] = [
  createFile,
  openFile,
  listEditorTools,
  callEditorTool,
  saveFile,
  pollCommands,
  setCommandResult,
  readFileContent,
];

export function registerAllTools(server: McpServer): void {
  for (const tool of tools) {
    tool.register(server);
  }
}
