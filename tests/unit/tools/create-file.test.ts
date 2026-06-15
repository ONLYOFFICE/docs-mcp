import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("create-file", () => {
  test("builds blank file URLs", async () => {
    const { getBlankFileUrl } =
      await import("../../../src/tools/definitions/create-file.ts");

    expect(getBlankFileUrl("en-US", "docx")).toEqual(expect.anything());
    expect(getBlankFileUrl("default", "xlsx")).toEqual(expect.anything());
  });

  test("adds the selected extension when the file name has no matching suffix", async () => {
    const { getFileName } =
      await import("../../../src/tools/definitions/create-file.ts");

    expect(getFileName("Report", "docx")).toBe("Report.docx");
    expect(getFileName("Report.docx", "docx")).toBe("Report.docx");
    expect(getFileName("Report.pdf", "docx")).toBe("Report.pdf.docx");
  });

  test("creates a document session for each supported file type", async () => {
    const { createCreateFileHandler } =
      await import("../../../src/tools/definitions/create-file.ts");
    const calls: unknown[] = [];
    const handler = createCreateFileHandler({
      randomUUID: () => "session-1",
      documentServerBaseUrl: "https://document-server.example",
      createEditorConfig: async (params) => {
        calls.push(params);
        return {
          document: { key: params.sessionId, title: params.fileName },
          editorConfig: { mode: params.mode },
        };
      },
    });

    await expect(
      handler({ fileName: "Document", fileType: "docx", locale: "en" }),
    ).resolves.toEqual({
      content: [],
      structuredContent: {
        sessionId: "session-1",
        documentServerBaseUrl: "https://document-server.example",
        shardkey: "session-1",
        config: {
          document: { key: "session-1", title: "Document.docx" },
          editorConfig: { mode: "edit" },
        },
      },
    });
    await expect(
      handler({ fileName: "Sheet", fileType: "xlsx", locale: "de" }),
    ).resolves.toMatchObject({
      structuredContent: {
        shardkey: "session-1",
        config: { document: { key: "session-1", title: "Sheet.xlsx" } },
      },
    });
    await expect(
      handler({ fileName: "Deck", fileType: "pptx", locale: "fr" }),
    ).resolves.toMatchObject({
      structuredContent: {
        shardkey: "session-1",
        config: { document: { key: "session-1", title: "Deck.pptx" } },
      },
    });
    expect(calls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Document.docx",
        fileUrl: expect.anything(),
        mode: "edit",
        locale: "en",
      },
      {
        sessionId: "session-1",
        fileName: "Sheet.xlsx",
        fileUrl: expect.anything(),
        mode: "edit",
        locale: "de",
      },
      {
        sessionId: "session-1",
        fileName: "Deck.pptx",
        fileUrl: expect.anything(),
        mode: "edit",
        locale: "fr",
      },
    ]);
  });

  test("uses the default template locale when locale is omitted", async () => {
    const { createCreateFileHandler } =
      await import("../../../src/tools/definitions/create-file.ts");
    const handler = createCreateFileHandler({
      randomUUID: () => "session-1",
      documentServerBaseUrl: "https://document-server.example",
      createEditorConfig: async () => ({ document: { key: "session-1" } }),
    });

    await expect(
      handler({ fileName: "Document", fileType: "docx" }),
    ).resolves.toMatchObject({
      structuredContent: {
        shardkey: "session-1",
      },
    });
  });

  test("registers the MCP app tool definition", async () => {
    const { createFile } =
      await import("../../../src/tools/definitions/create-file.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    createFile.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "create_file",
      {
        title: "Create File",
        inputSchema: {
          fileName: expect.anything(),
          fileType: expect.anything(),
          locale: expect.anything(),
        },
        outputSchema: {
          sessionId: expect.anything(),
          documentServerBaseUrl: expect.anything(),
          shardkey: expect.anything(),
          config: expect.anything(),
          fileUrl: expect.anything(),
        },
        _meta: {
          ui: { resourceUri: "ui://editor/index.html" },
          "ui/resourceUri": "ui://editor/index.html",
        },
      },
      expect.any(Function),
    ]);
  });
});
