import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue } from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";

export const saveFile: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "save_file",
      {
        description: "Trigger a download of the currently open document to the user's browser. Call after the user has finished editing and wants to save the file locally.",
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: z.string().describe("Session ID returned by open_file or create_file."),
        },
      },
      async ({ sessionId }) => {
        await commandQueue.enqueue(sessionId, { id: crypto.randomUUID(), type: "saveFile" }, 10000);

        return {
          content: [{
            type: "text",
            text: "Save command dispatched. Please check your browser's download folder.",
          }],
        };
      }
    );
  },
};
