import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("open-file", () => {
  test("returns an error when no file source is provided", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const handler = createOpenFileHandler();

    await expect(handler({})).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "No file specified. Please provide a fileUrl parameter or openai_file.",
        },
      ],
      isError: true,
    });
  });

  test("opens an allowed remote file URL", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const configCalls: unknown[] = [];
    const handler = createOpenFileHandler({
      randomUUID: () => "session-1",
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
      fileUrl:
        "https://files.example.com/reports/Quarterly%20Report.docx?download=1",
    });

    expect(configCalls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Quarterly Report.docx",
        fileUrl:
          "https://files.example.com/reports/Quarterly%20Report.docx?download=1",
        mode: "view",
      },
    ]);
    expect(result).toEqual({
      content: [],
      structuredContent: {
        sessionId: "session-1",
        documentServerBaseUrl: "https://document-server.example",
        shardkey: "session-1",
        config: {
          document: { key: "session-1", title: "Quarterly Report.docx" },
          editorConfig: { mode: "view" },
        },
      },
    });
  });

  test("returns formatted remote URL access errors", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const handler = createOpenFileHandler({
      validateAllowedDocumentFileUrl: () => ({
        ok: false,
        reason: "outside_allowed_origins",
        origin: "https://files.example.com",
      }),
    });

    await expect(
      handler({
        fileUrl: "https://files.example.com/report.docx",
      }),
    ).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "Document file URL origin is not allowed: https://files.example.com",
        },
      ],
      isError: true,
    });
  });

  test("opens an OpenAI file object", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const configCalls: unknown[] = [];
    const handler = createOpenFileHandler({
      randomUUID: () => "session-1",
      documentServerBaseUrl: "https://document-server.example",
      validateAllowedDocumentFileUrl: () => ({ ok: true }),
      getDocumentType: async () => "cell",
      createEditorConfig: async (params) => {
        configCalls.push(params);
        return {
          documentType: "cell",
          document: { key: params.sessionId, title: params.fileName },
        };
      },
    });

    const result = await handler({
      openai_file: {
        download_url: "https://files.example.com/sheet.xlsx",
        file_id: "file-1",
        file_name: "Budget.xlsx",
      },
    });

    expect(configCalls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Budget.xlsx",
        fileUrl: "https://files.example.com/sheet.xlsx",
        mode: "view",
      },
    ]);
    expect(result).toMatchObject({
      content: [],
      structuredContent: {
        sessionId: "session-1",
        documentServerBaseUrl: "https://document-server.example",
        shardkey: "session-1",
        config: {
          documentType: "cell",
          document: { key: "session-1", title: "Budget.xlsx" },
        },
      },
    });
  });

  test("returns supported extensions when the file type is not supported", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const handler = createOpenFileHandler({
      validateAllowedDocumentFileUrl: () => ({ ok: true }),
      getDocumentType: async () => null,
      formatsProvider: {
        async getListViewableExtensions() {
          return ["docx", "xlsx", "pptx"];
        },
      },
    });

    await expect(
      handler({
        fileUrl: "https://files.example.com/archive.zip",
      }),
    ).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "The file type .zip is not supported. Supported file types: docx, xlsx, pptx.",
        },
      ],
      isError: true,
    });
  });

  test("rejects local file URLs outside stdio transport", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    let resolverCalled = false;
    const handler = createOpenFileHandler({
      getTransportMode: () => "http",
      resolveAllowedLocalFile: async () => {
        resolverCalled = true;
        return { ok: false, reason: "not_found" };
      },
    });

    await expect(
      handler({ fileUrl: "file:///tmp/report.docx" }),
    ).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "Local file:// URLs are only supported with stdio transport.",
        },
      ],
      isError: true,
    });
    expect(resolverCalled).toBe(false);
  });

  test("returns formatted local file access errors", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const handler = createOpenFileHandler({
      getTransportMode: () => "stdio",
      resolveAllowedLocalFile: async () => ({
        ok: false,
        reason: "outside_allowed_roots",
      }),
    });

    await expect(
      handler({ fileUrl: "file:///tmp/report.docx" }),
    ).resolves.toEqual({
      content: [
        {
          type: "text",
          text: "Local file is outside the allowed directories: file:///tmp/report.docx",
        },
      ],
      isError: true,
    });
  });

  test("opens an allowed local file URL in stdio transport", async () => {
    const { createOpenFileHandler } =
      await import("../../../src/tools/definitions/open-file.ts");
    const configCalls: unknown[] = [];
    const handler = createOpenFileHandler({
      randomUUID: () => "session-1",
      documentServerBaseUrl: "https://document-server.example",
      getTransportMode: () => "stdio",
      resolveAllowedLocalFile: async () => ({
        ok: true,
        filePath: "C:\\tmp\\Report.docx",
        size: 7,
      }),
      getDocumentType: async () => "word",
      createEditorConfig: async (params) => {
        configCalls.push(params);
        return { document: { key: params.sessionId, url: params.fileUrl } };
      },
    });

    const result = await handler({
      fileUrl: "file:///C:/tmp/Report.docx",
    });

    expect(configCalls).toEqual([
      {
        sessionId: "session-1",
        fileName: "Report.docx",
        fileUrl: "_data_",
        mode: "view",
      },
    ]);
    expect(result).toEqual({
      content: [],
      structuredContent: {
        sessionId: "session-1",
        documentServerBaseUrl: "https://document-server.example",
        shardkey: "session-1",
        config: { document: { key: "session-1", url: "_data_" } },
        fileUrl: "file:///C:/tmp/Report.docx",
      },
    });
  });

  test("registers the MCP app tool definition", async () => {
    const { openFile } =
      await import("../../../src/tools/definitions/open-file.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    openFile.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "open_file",
      {
        title: "Open File",
        inputSchema: {
          fileUrl: expect.anything(),
          openai_file: expect.anything(),
        },
        _meta: {
          ui: { resourceUri: "ui://editor/index.html" },
          "ui/resourceUri": "ui://editor/index.html",
          "openai/fileParams": ["openai_file"],
        },
      },
      expect.any(Function),
    ]);
  });
});
