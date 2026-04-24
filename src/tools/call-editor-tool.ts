import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue, CommandTimeoutError } from "../command-queue.js";
import type { McpTool } from "./index.js";

export const callEditorTool: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "call_editor_tool",
      {
        description: "Execute a named plugin tool inside the open ONLYOFFICE editor (e.g. insert table, change font). Always call list_editor_tools first to discover valid tool names and their required input schemas.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: z
            .string()
            .describe("Session ID returned by open_file or create_file."),
          tool: z
            .string()
            .describe("Exact tool name from list_editor_tools. Do not invent names."),
          input: z
            .looseObject({})
            .optional()
            .describe("Arguments for the selected tool, matching its schema from list_editor_tools."),
        },
      },
      async ({ sessionId, tool, input }) => {
        try {
          const result = await commandQueue.enqueue(
            sessionId,
            { id: crypto.randomUUID(), type: "aiCallTool", payload: { name: tool, args: input } },
            30000
          );
          return { content: [], structuredContent: { result } };
        } catch (err) {
          if (err instanceof CommandTimeoutError) {
            return { content: [{ type: "text" as const, text: "Timeout: no response from editor" }] };
          }
          throw err;
        }
      }
    );
  },
};
