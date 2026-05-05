import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue, type Command } from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";

type PollEditorCommandsInput = {
  sessionId: string;
};

type PollEditorCommandsDeps = {
  commandQueue?: {
    longPoll(sessionId: string): Promise<Command[]>;
  };
};

export function createPollEditorCommandsHandler(deps: PollEditorCommandsDeps = {}) {
  const queue = deps.commandQueue ?? commandQueue;

  return async ({ sessionId }: PollEditorCommandsInput) => {
    const commands = await queue.longPoll(sessionId);
    return { content: [], structuredContent: { commands } };
  };
}

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
      createPollEditorCommandsHandler()
    );
  },
};
