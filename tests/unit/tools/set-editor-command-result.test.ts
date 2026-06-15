import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("set-editor-command-result", () => {
  test("resolves a known command result", async () => {
    const { createSetEditorCommandResultHandler } =
      await import("../../../src/tools/definitions/set-editor-command-result.ts");
    const calls: Array<{
      sessionId: string;
      commandId: string;
      data: unknown;
    }> = [];
    const handler = createSetEditorCommandResultHandler({
      commandQueue: {
        resolve(sessionId, commandId, data) {
          calls.push({ sessionId, commandId, data });
          return true;
        },
      },
    });

    const result = await handler({
      sessionId: "session-1",
      commandId: "command-1",
      result: { tools: ["insertText"] },
    });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        commandId: "command-1",
        data: { tools: ["insertText"] },
      },
    ]);
    expect(result).toEqual({
      content: [{ type: "text", text: "ok" }],
      structuredContent: {
        status: "ok",
        found: true,
      },
    });
  });

  test("reports unknown command IDs", async () => {
    const { createSetEditorCommandResultHandler } =
      await import("../../../src/tools/definitions/set-editor-command-result.ts");
    const handler = createSetEditorCommandResultHandler({
      commandQueue: {
        resolve() {
          return false;
        },
      },
    });

    await expect(
      handler({
        sessionId: "session-1",
        commandId: "missing-command",
        result: null,
      }),
    ).resolves.toEqual({
      content: [{ type: "text", text: "unknown commandId" }],
      structuredContent: {
        status: "unknown_command_id",
        found: false,
      },
    });
  });

  test("registers the MCP tool definition", async () => {
    const { setEditorCommandResult } =
      await import("../../../src/tools/definitions/set-editor-command-result.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    setEditorCommandResult.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "set_editor_command_result",
      {
        inputSchema: {
          sessionId: expect.anything(),
          commandId: expect.anything(),
          result: expect.anything(),
        },
        outputSchema: {
          status: expect.anything(),
          found: expect.anything(),
        },
        _meta: { ui: { visibility: ["app"] } },
      },
      expect.any(Function),
    ]);
  });
});
