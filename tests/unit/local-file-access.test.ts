import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { pathToFileURL } from "url";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

let tempRoot: string;

describe("local-file-access", () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "docs-mcp-local-file-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  test("rejects invalid local file URLs", async () => {
    const { resolveAllowedLocalFile } = await import("../../src/domain/local-file-access.ts");

    expect(await resolveAllowedLocalFile("not-a-file-url", [tempRoot])).toEqual({
      ok: false,
      reason: "invalid_url",
    });
  });

  test("requires configured allowed roots", async () => {
    const { resolveAllowedLocalFile } = await import("../../src/domain/local-file-access.ts");
    const filePath = path.join(tempRoot, "document.docx");
    await writeFile(filePath, "content");

    expect(await resolveAllowedLocalFile(pathToFileURL(filePath).toString(), [])).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  test("rejects missing files", async () => {
    const { resolveAllowedLocalFile } = await import("../../src/domain/local-file-access.ts");
    const filePath = path.join(tempRoot, "missing.docx");

    expect(await resolveAllowedLocalFile(pathToFileURL(filePath).toString(), [tempRoot])).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  test("rejects files outside allowed roots", async () => {
    const { resolveAllowedLocalFile } = await import("../../src/domain/local-file-access.ts");
    const allowedRoot = path.join(tempRoot, "allowed");
    const outsideRoot = path.join(tempRoot, "outside");
    const filePath = path.join(outsideRoot, "document.docx");
    await mkdir(allowedRoot);
    await mkdir(outsideRoot);
    await writeFile(filePath, "content");

    expect(await resolveAllowedLocalFile(pathToFileURL(filePath).toString(), [allowedRoot])).toEqual({
      ok: false,
      reason: "outside_allowed_roots",
    });
  });

  test("allows files inside allowed roots", async () => {
    const { resolveAllowedLocalFile } = await import("../../src/domain/local-file-access.ts");
    const filePath = path.join(tempRoot, "document.docx");
    await writeFile(filePath, "content");
    const resolvedFilePath = await realpath(filePath);

    const result = await resolveAllowedLocalFile(pathToFileURL(filePath).toString(), [tempRoot]);

    expect(result).toEqual({
      ok: true,
      filePath: resolvedFilePath,
      size: 7,
    });
  });

  test("formats access errors", async () => {
    const { formatLocalFileAccessError } = await import("../../src/domain/local-file-access.ts");

    expect(formatLocalFileAccessError("file://bad", "invalid_url")).toBe(
      "Invalid local file URL: file://bad",
    );
    expect(formatLocalFileAccessError("file:///missing.docx", "not_found")).toBe(
      "Local file not found: file:///missing.docx",
    );
  });
});
