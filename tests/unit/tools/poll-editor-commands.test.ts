import { describe, expect, test } from "bun:test";
import type { Command } from "../../../src/domain/editor-session/command-queue.ts";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("poll-editor-commands", () => {
  test("returns commands from the command queue", async () => {
    const { createPollEditorCommandsHandler } =
      await import("../../../src/tools/definitions/poll-editor-commands.ts");
    const commands: Command[] = [
      {
        id: "command-1",
        type: "aiListTools",
        payload: { documentType: "word" },
      },
    ];
    const calls: string[] = [];
    const handler = createPollEditorCommandsHandler({
      commandQueue: {
        async longPoll(sessionId) {
          calls.push(sessionId);
          return commands;
        },
      },
    });

    const result = await handler({ sessionId: "session-1" });

    expect(calls).toEqual(["session-1"]);
    expect(result).toEqual({
      content: [],
      structuredContent: { commands },
    });
  });

  test("registers the MCP tool definition", async () => {
    const { pollEditorCommands } =
      await import("../../../src/tools/definitions/poll-editor-commands.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    pollEditorCommands.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "poll_editor_commands",
      {
        inputSchema: {
          sessionId: expect.anything(),
        },
        _meta: { visibility: ["app"] },
      },
      expect.any(Function),
    ]);
  });
});
