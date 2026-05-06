import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

const enabledConfig = {
  word: "all",
  cell: ["formatTable", "addChart"],
  slide: ["addNewSlide"],
  pdf: [],
} as const;

const disabledConfig = {
  word: ["writeMacro"],
  cell: [],
  slide: "all",
  pdf: [],
} as const;

describe("list-editor-tools", () => {
  test("filters tools by document type configuration", async () => {
    const { filterTools } = await import("../../../src/tools/definitions/list-editor-tools.ts");
    const tools = [
      { name: "insertText" },
      { name: "writeMacro" },
      { name: "formatTable" },
      { name: "addChart" },
      { name: "addNewSlide" },
    ];

    expect(filterTools(tools, "word", enabledConfig, disabledConfig)).toEqual([
      { name: "insertText" },
      { name: "formatTable" },
      { name: "addChart" },
      { name: "addNewSlide" },
    ]);
    expect(filterTools(tools, "cell", enabledConfig, disabledConfig)).toEqual([
      { name: "formatTable" },
      { name: "addChart" },
    ]);
    expect(filterTools(tools, "slide", enabledConfig, disabledConfig)).toEqual([]);
    expect(filterTools(tools, "unknown", enabledConfig, disabledConfig)).toEqual([]);
  });

  test("enqueues an aiListTools command and returns filtered tools", async () => {
    const { createListEditorToolsHandler } = await import(
      "../../../src/tools/definitions/list-editor-tools.ts"
    );
    const calls: unknown[] = [];
    const handler = createListEditorToolsHandler({
      randomUUID: () => "command-1",
      enabledConfig,
      disabledConfig,
      commandQueue: {
        async enqueue(sessionId, command, timeoutMs) {
          calls.push({ sessionId, command, timeoutMs });
          return {
            documentType: "cell",
            tools: [{ name: "formatTable" }, { name: "writeMacro" }, { name: "addChart" }],
          };
        },
      },
    });

    const result = await handler({ sessionId: "session-1" });

    expect(calls).toEqual([
      {
        sessionId: "session-1",
        command: { id: "command-1", type: "aiListTools" },
        timeoutMs: 10000,
      },
    ]);
    expect(result).toEqual({
      content: [],
      structuredContent: { tools: [{ name: "formatTable" }, { name: "addChart" }] },
    });
  });

  test("returns timeout text when the editor does not respond", async () => {
    const { CommandTimeoutError } = await import(
      "../../../src/domain/editor-session/command-queue.ts"
    );
    const { createListEditorToolsHandler } = await import(
      "../../../src/tools/definitions/list-editor-tools.ts"
    );
    const handler = createListEditorToolsHandler({
      commandQueue: {
        async enqueue() {
          throw new CommandTimeoutError("command-1", "session-1");
        },
      },
    });

    await expect(handler({ sessionId: "session-1" })).resolves.toEqual({
      content: [{ type: "text", text: "Timeout: no response from editor" }],
      isError: true,
    });
  });

  test("registers the MCP tool definition", async () => {
    const { listEditorTools } = await import("../../../src/tools/definitions/list-editor-tools.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    listEditorTools.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "list_editor_tools",
      {
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: expect.anything(),
        },
      },
      expect.any(Function),
    ]);
  });
});
