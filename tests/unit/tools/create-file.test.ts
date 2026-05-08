import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("create-file", () => {
  test("builds blank file URLs", async () => {
    const { getBlankFileUrl } =
      await import("../../../src/tools/definitions/create-file.ts");

    expect(getBlankFileUrl("en-US", "docx")).toBe("blank://en-US/docx");
    expect(getBlankFileUrl("default", "xlsx")).toBe("blank://default/xlsx");
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
          document: { title: params.fileName },
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
        config: {
          document: { title: "Document.docx" },
          editorConfig: { mode: "edit" },
        },
        fileUrl: "blank://en/docx",
      },
    });
    await expect(
      handler({ fileName: "Sheet", fileType: "xlsx", locale: "de" }),
    ).resolves.toMatchObject({
      structuredContent: {
        config: { document: { title: "Sheet.xlsx" } },
        fileUrl: "blank://de/xlsx",
      },
    });
    await expect(
      handler({ fileName: "Deck", fileType: "pptx", locale: "fr" }),
    ).resolves.toMatchObject({
      structuredContent: {
        config: { document: { title: "Deck.pptx" } },
        fileUrl: "blank://fr/pptx",
      },
    });
    expect(calls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Document.docx",
        fileUrl: "_data_",
        mode: "edit",
      },
      {
        sessionId: "session-1",
        fileName: "Sheet.xlsx",
        fileUrl: "_data_",
        mode: "edit",
      },
      {
        sessionId: "session-1",
        fileName: "Deck.pptx",
        fileUrl: "_data_",
        mode: "edit",
      },
    ]);
  });

  test("uses the default template locale when locale is omitted", async () => {
    const { createCreateFileHandler } =
      await import("../../../src/tools/definitions/create-file.ts");
    const handler = createCreateFileHandler({
      randomUUID: () => "session-1",
      documentServerBaseUrl: "https://document-server.example",
      createEditorConfig: async () => ({ ok: true }),
    });

    await expect(
      handler({ fileName: "Document", fileType: "docx" }),
    ).resolves.toMatchObject({
      structuredContent: {
        fileUrl: "blank://default/docx",
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
        _meta: {
          ui: { resourceUri: "ui://editor/index.html" },
          "ui/resourceUri": "ui://editor/index.html",
        },
      },
      expect.any(Function),
    ]);
  });
});
