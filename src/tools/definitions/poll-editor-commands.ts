import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  commandQueue,
  type Command,
} from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

type PollEditorCommandsInput = {
  sessionId: string;
};

type PollEditorCommandsDeps = {
  commandQueue?: {
    longPoll(sessionId: string): Promise<Command[]>;
  };
};

export const PollEditorCommandsOutputSchema = {
  commands: z
    .array(
      z.object({
        id: z.string().describe("Command ID."),
        type: z.literal("saveFile").describe("Command type."),
        payload: z.unknown().optional().describe("Optional command payload."),
      }),
    )
    .describe("Commands pending for the editor client."),
};

export function createPollEditorCommandsHandler(
  deps: PollEditorCommandsDeps = {},
) {
  const queue = deps.commandQueue ?? commandQueue;

  return async ({ sessionId }: PollEditorCommandsInput) => {
    const commands = await queue.longPoll(sessionId);
    return { content: [], structuredContent: { commands } };
  };
}

export const pollEditorCommands: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "poll_editor_commands",
      {
        description:
          "Long-poll for pending commands queued for the document editor client. App-only — called by the editor UI on a regular interval to receive server-issued commands.",
        inputSchema: {
          sessionId: z.string().describe("Session ID returned by open_file."),
        },
        outputSchema: PollEditorCommandsOutputSchema,
        _meta: { ui: { visibility: ["app"] } },
      },
      createPollEditorCommandsHandler(),
    );
  },
};
