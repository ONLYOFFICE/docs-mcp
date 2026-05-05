import { describe, expect, test } from "bun:test";
import { pathToFileURL } from "url";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("file-utils", () => {
  test("extracts a decoded file name from an HTTP URL", async () => {
    const { getFileNameFromUrl } = await import("../../../src/domain/document-server/file-utils.ts");

    expect(getFileNameFromUrl("https://example.com/files/Quarterly%20Report.docx?download=1")).toBe(
      "Quarterly Report.docx",
    );
  });

  test("extracts a file name from a file URL", async () => {
    const { getFileNameFromUrl } = await import("../../../src/domain/document-server/file-utils.ts");
    const fileUrl = pathToFileURL("C:\\tmp\\Budget 2026.xlsx").toString();

    expect(getFileNameFromUrl(fileUrl)).toBe("Budget 2026.xlsx");
  });

  test("falls back to basename for non-URL input", async () => {
    const { getFileNameFromUrl } = await import("../../../src/domain/document-server/file-utils.ts");

    expect(getFileNameFromUrl("relative/path/presentation.pptx")).toBe("presentation.pptx");
  });

  test("returns a lower-cased extension", async () => {
    const { getExtension } = await import("../../../src/domain/document-server/file-utils.ts");

    expect(getExtension("Report.DOCX")).toBe("docx");
    expect(getExtension("archive.tar.gz")).toBe("gz");
  });

  test("returns an empty extension for names without a usable suffix", async () => {
    const { getExtension } = await import("../../../src/domain/document-server/file-utils.ts");

    expect(getExtension("README")).toBe("");
    expect(getExtension(".env")).toBe("");
  });
});
