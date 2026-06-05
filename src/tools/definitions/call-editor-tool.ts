import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  commandQueue,
  CommandTimeoutError,
} from "../../domain/editor-session/command-queue.js";
import type { McpTool } from "../index.js";

type CallEditorToolInput = {
  sessionId: string;
  tool: string;
  input?: Record<string, unknown>;
};

type CallEditorToolDeps = {
  commandQueue?: {
    enqueue(
      sessionId: string,
      command: {
        id: string;
        type: "aiCallTool";
        payload: { name: string; args?: Record<string, unknown> };
      },
      timeoutMs: number,
    ): Promise<unknown>;
  };
  randomUUID?: () => string;
};

export function createCallEditorToolHandler(deps: CallEditorToolDeps = {}) {
  const queue = deps.commandQueue ?? commandQueue;
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);

  return async ({ sessionId, tool, input }: CallEditorToolInput) => {
    try {
      const result = await queue.enqueue(
        sessionId,
        {
          id: randomUUID(),
          type: "aiCallTool",
          payload: { name: tool, args: input },
        },
        30000,
      );
      return { content: [], structuredContent: { result } };
    } catch (err) {
      if (err instanceof CommandTimeoutError) {
        return {
          content: [
            { type: "text" as const, text: "Timeout: no response from editor" },
          ],
          isError: true,
        };
      }
      throw err;
    }
  };
}

export const callEditorTool: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "call_editor_tool",
      {
        description:
          "Execute a named plugin tool inside the open ONLYOFFICE editor (e.g. insert table, change font). Always call list_editor_tools first to discover valid tool names and their required input schemas.",
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
            .describe(
              "Exact tool name from list_editor_tools. Do not invent names.",
            ),
          input: z
            .looseObject({})
            .optional()
            .describe(
              "Arguments for the selected tool, matching its schema from list_editor_tools.",
            ),
        },
      },
      createCallEditorToolHandler(),
    );
  },
};
