import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue, CommandTimeoutError } from "../command-queue.js";
import type { McpTool } from "./tool.js";

export const listEditorTools: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "list_editor_tools",
      {
        description: "List all plugin tools available in the current ONLYOFFICE editing session, with their names and input schemas. Always call this before call_editor_tool to discover valid tool names.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: z
            .string()
            .describe("Session ID returned by open_file or create_file."),
        },
      },
      async ({ sessionId }) => {
        try {
          const result = await commandQueue.enqueue(sessionId, { id: crypto.randomUUID(), type: "aiListTools" }, 10000);
          return { content: [], structuredContent: { tools: result } };
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
