import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue } from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";

type SetEditorCommandResultInput = {
  sessionId: string;
  commandId: string;
  result: unknown;
};

type SetEditorCommandResultDeps = {
  commandQueue?: {
    resolve(sessionId: string, commandId: string, data: unknown): boolean;
  };
};

export function createSetEditorCommandResultHandler(
  deps: SetEditorCommandResultDeps = {},
) {
  const queue = deps.commandQueue ?? commandQueue;

  return async ({
    sessionId,
    commandId,
    result,
  }: SetEditorCommandResultInput) => {
    const found = queue.resolve(sessionId, commandId, result);
    const text = found ? "ok" : "unknown commandId";
    return { content: [{ type: "text" as const, text }] };
  };
}

export const setEditorCommandResult: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "set_editor_command_result",
      {
        description:
          "Report the result of a command back to the MCP server after the editor client has executed it. App-only — called by the editor UI with the outcome of a command received via poll_editor_commands.",
        inputSchema: {
          sessionId: z
            .string()
            .describe("Session ID returned by open_file or create_file."),
          commandId: z
            .string()
            .describe(
              "ID of the command being responded to, as received from poll_editor_commands.",
            ),
          result: z
            .unknown()
            .describe(
              "Result data returned by the editor for the completed command.",
            ),
        },
        _meta: { visibility: ["app"] },
      },
      createSetEditorCommandResultHandler(),
    );
  },
};
