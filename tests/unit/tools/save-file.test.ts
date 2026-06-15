import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("save-file", () => {
  test("enqueues a saveFile command and returns download guidance", async () => {
    const { createSaveFileHandler } =
      await import("../../../src/tools/definitions/save-file.ts");
    const calls: unknown[] = [];
    const handler = createSaveFileHandler({
      randomUUID: () => "command-1",
      commandQueue: {
        async enqueue(sessionId, command, timeoutMs) {
          calls.push({ sessionId, command, timeoutMs });
          return null;
        },
      },
    });

    const result = await handler({ sessionId: "session-1" });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        command: { id: "command-1", type: "saveFile" },
        timeoutMs: 10000,
      },
    ]);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Save command dispatched. Please check your browser's download folder.",
        },
      ],
      structuredContent: {
        message:
          "Save command dispatched. Please check your browser's download folder.",
      },
    });
  });

  test("propagates queue errors", async () => {
    const { createSaveFileHandler } =
      await import("../../../src/tools/definitions/save-file.ts");
    const error = new Error("queue failed");
    const handler = createSaveFileHandler({
      commandQueue: {
        async enqueue() {
          throw error;
        },
      },
    });

    await expect(handler({ sessionId: "session-1" })).rejects.toBe(error);
  });

  test("registers the MCP tool definition", async () => {
    const { saveFile } =
      await import("../../../src/tools/definitions/save-file.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    saveFile.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "save_file",
      {
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: expect.anything(),
        },
        outputSchema: {
          message: expect.anything(),
        },
      },
      expect.any(Function),
    ]);
  });
});
