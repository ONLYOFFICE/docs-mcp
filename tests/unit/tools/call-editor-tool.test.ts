import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("call-editor-tool", () => {
  test("enqueues an aiCallTool command and returns the editor result", async () => {
    const { createCallEditorToolHandler } = await import(
      "../../../src/tools/definitions/call-editor-tool.ts"
    );
    const calls: unknown[] = [];
    const handler = createCallEditorToolHandler({
      randomUUID: () => "command-1",
      commandQueue: {
        async enqueue(sessionId, command, timeoutMs) {
          calls.push({ sessionId, command, timeoutMs });
          return { ok: true, inserted: 3 };
        },
      },
    });

    const result = await handler({
      sessionId: "session-1",
      tool: "insertText",
      input: { text: "Hello" },
    });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        command: {
          id: "command-1",
          type: "aiCallTool",
          payload: { name: "insertText", args: { text: "Hello" } },
        },
        timeoutMs: 30000,
      },
    ]);
    expect(result).toEqual({
      content: [],
      structuredContent: { result: { ok: true, inserted: 3 } },
    });
  });

  test("passes through an omitted input object as undefined args", async () => {
    const { createCallEditorToolHandler } = await import(
      "../../../src/tools/definitions/call-editor-tool.ts"
    );
    const calls: unknown[] = [];
    const handler = createCallEditorToolHandler({
      randomUUID: () => "command-1",
      commandQueue: {
        async enqueue(sessionId, command, timeoutMs) {
          calls.push({ sessionId, command, timeoutMs });
          return "done";
        },
      },
    });

    await handler({ sessionId: "session-1", tool: "save" });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        command: {
          id: "command-1",
          type: "aiCallTool",
          payload: { name: "save", args: undefined },
        },
        timeoutMs: 30000,
      },
    ]);
  });

  test("returns timeout text when the editor does not respond", async () => {
    const { CommandTimeoutError } = await import(
      "../../../src/domain/editor-session/command-queue.ts"
    );
    const { createCallEditorToolHandler } = await import(
      "../../../src/tools/definitions/call-editor-tool.ts"
    );
    const handler = createCallEditorToolHandler({
      commandQueue: {
        async enqueue() {
          throw new CommandTimeoutError("command-1", "session-1");
        },
      },
    });

    await expect(
      handler({ sessionId: "session-1", tool: "insertText", input: { text: "Hello" } }),
    ).resolves.toEqual({
      content: [{ type: "text", text: "Timeout: no response from editor" }],
      isError: true,
    });
  });

  test("registers the MCP tool definition", async () => {
    const { callEditorTool } = await import("../../../src/tools/definitions/call-editor-tool.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    callEditorTool.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "call_editor_tool",
      {
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: expect.anything(),
          tool: expect.anything(),
          input: expect.anything(),
        },
      },
      expect.any(Function),
    ]);
  });
});
