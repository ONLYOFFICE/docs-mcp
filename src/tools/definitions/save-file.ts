import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue } from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";

type SaveFileInput = {
  sessionId: string;
};

type SaveFileDeps = {
  commandQueue?: {
    enqueue(sessionId: string, command: { id: string; type: "saveFile" }, timeoutMs: number): Promise<unknown>;
  };
  randomUUID?: () => string;
};

export function createSaveFileHandler(deps: SaveFileDeps = {}) {
  const queue = deps.commandQueue ?? commandQueue;
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);

  return async ({ sessionId }: SaveFileInput) => {
    await queue.enqueue(sessionId, { id: randomUUID(), type: "saveFile" }, 10000);

    return {
      content: [{
        type: "text" as const,
        text: "Save command dispatched. Please check your browser's download folder.",
      }],
    };
  };
}

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
      createSaveFileHandler()
    );
  },
};
