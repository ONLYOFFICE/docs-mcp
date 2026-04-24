import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue } from "../command-queue.js";
import type { McpTool } from "./index.js";

export const pollEditorCommands: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "poll_editor_commands",
      {
        description: "Long-poll for pending commands queued for the document editor client. App-only — called by the editor UI on a regular interval to receive server-issued commands.",
        inputSchema: {
          sessionId: z.string().describe("Session ID returned by open_file or create_file."),
        },
        _meta: { visibility: ["app"] },
      },
      async ({ sessionId }) => {
        const commands = await commandQueue.longPoll(sessionId);
        return { content: [], structuredContent: { commands } };
      }
    );
  },
};
