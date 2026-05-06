import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

let tempRoot: string;

describe("read-file-content", () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "docs-mcp-read-file-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  test("reads a base64-encoded local file chunk", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const filePath = path.join(tempRoot, "document.txt");
    await writeFile(filePath, "hello world");
    const fileUrl = pathToFileURL(filePath).toString();
    const handler = createReadFileContentHandler({
      getTransportMode: () => "stdio",
      resolveAllowedLocalFile: async () => ({ ok: true, filePath, size: 11 }),
    });

    const result = await handler({ url: fileUrl, offset: 0, byteCount: 5 });

    expect(result).toEqual({
      content: [],
      structuredContent: {
        bytes: Buffer.from("hello").toString("base64"),
        offset: 0,
        byteCount: 5,
        totalBytes: 11,
        hasMore: true,
      },
    });
  });

  test("reads from the requested byte offset", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const filePath = path.join(tempRoot, "document.txt");
    await writeFile(filePath, "hello world");
    const handler = createReadFileContentHandler({
      getTransportMode: () => "stdio",
      resolveAllowedLocalFile: async () => ({ ok: true, filePath, size: 11 }),
    });

    const result = await handler({
      url: pathToFileURL(filePath).toString(),
      offset: 6,
      byteCount: 20,
    });

    expect(result).toEqual({
      content: [],
      structuredContent: {
        bytes: Buffer.from("world").toString("base64"),
        offset: 6,
        byteCount: 5,
        totalBytes: 11,
        hasMore: false,
      },
    });
  });

  test("rejects unsupported URL formats", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const handler = createReadFileContentHandler();

    await expect(handler({ url: "https://example.com/document.docx", offset: 0, byteCount: 10 })).resolves.toEqual({
      content: [],
      structuredContent: {
        error:
          "Invalid path format. Expected blank://{locale}/{fileType} or file:// URL, got: https://example.com/document.docx",
      },
    });
  });

  test("rejects malformed blank URLs", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const handler = createReadFileContentHandler();

    await expect(handler({ url: "blank://en", offset: 0, byteCount: 10 })).resolves.toEqual({
      content: [],
      structuredContent: { error: "Invalid blank URL: blank://en" },
    });
  });

  test("rejects local files outside stdio transport", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    let resolverCalled = false;
    const handler = createReadFileContentHandler({
      getTransportMode: () => "http",
      resolveAllowedLocalFile: async () => {
        resolverCalled = true;
        return { ok: false, reason: "not_found" };
      },
    });

    const result = await handler({ url: "file:///tmp/document.docx", offset: 0, byteCount: 10 });

    expect(result).toEqual({
      content: [],
      structuredContent: { error: "Local file access is only supported with stdio transport." },
    });
    expect(resolverCalled).toBe(false);
  });

  test("returns formatted local file access errors", async () => {
    const { createReadFileContentHandler } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const handler = createReadFileContentHandler({
      getTransportMode: () => "stdio",
      resolveAllowedLocalFile: async () => ({ ok: false, reason: "outside_allowed_roots" }),
    });

    const result = await handler({ url: "file:///tmp/document.docx", offset: 0, byteCount: 10 });

    expect(result).toEqual({
      content: [],
      structuredContent: {
        error: "Local file is outside the allowed directories: file:///tmp/document.docx",
      },
    });
  });

  test("registers the MCP tool definition", async () => {
    const { MAX_CHUNK_BYTES, readFileContent } = await import(
      "../../../src/tools/definitions/read-file-content.ts"
    );
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    readFileContent.register(server as never);

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject([
      "read_file_content",
      {
        inputSchema: {
          url: expect.anything(),
          offset: expect.anything(),
          byteCount: expect.anything(),
        },
        _meta: { visibility: ["app"] },
      },
      expect.any(Function),
    ]);
    expect(MAX_CHUNK_BYTES).toBe(512 * 1024);
  });
});
