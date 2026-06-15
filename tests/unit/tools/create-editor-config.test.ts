import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("create-editor-config", () => {
  test("creates an editor config for an existing session", async () => {
    const { createCreateEditorConfigHandler } =
      await import("../../../src/tools/definitions/create-editor-config.ts");
    const configCalls: unknown[] = [];
    const handler = createCreateEditorConfigHandler({
      documentServerBaseUrl: "https://document-server.example",
      validateAllowedDocumentFileUrl: () => ({ ok: true }),
      getDocumentType: async () => "word",
      createEditorConfig: async (params) => {
        configCalls.push(params);
        return {
          document: { key: params.sessionId, title: params.fileName },
          editorConfig: { mode: params.mode },
        };
      },
    });

    const result = await handler({
      sessionId: "session-1",
      fileName: "Report.docx",
      fileUrl: "https://files.example.com/Report.docx",
      mode: "edit",
    });

    expect(configCalls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Report.docx",
        fileUrl: "https://files.example.com/Report.docx",
        mode: "edit",
      },
    ]);
    expect(result).toEqual({
      content: [],
      structuredContent: {
        sessionId: "session-1",
        documentServerBaseUrl: "https://document-server.example",
        shardkey: "session-1",
        config: {
          document: { key: "session-1", title: "Report.docx" },
          editorConfig: { mode: "edit" },
        },
      },
    });
  });

  test("registers the app-only MCP tool definition", async () => {
    const { createEditorConfig } =
      await import("../../../src/tools/definitions/create-editor-config.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    createEditorConfig.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "create_editor_config",
      {
        inputSchema: {
          sessionId: expect.anything(),
          fileName: expect.anything(),
          fileUrl: expect.anything(),
        },
        _meta: { ui: { visibility: ["app"] } },
      },
      expect.any(Function),
    ]);
  });
});
