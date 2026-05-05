import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("document-file-url-access", () => {
  test("rejects invalid URLs", async () => {
    const { validateAllowedDocumentFileUrl } = await import(
      "../../src/domain/document-file-url-access.ts"
    );

    expect(validateAllowedDocumentFileUrl("not a url", ["*"])).toEqual({
      ok: false,
      reason: "invalid_url",
    });
  });

  test("rejects unsupported URL protocols", async () => {
    const { validateAllowedDocumentFileUrl } = await import(
      "../../src/domain/document-file-url-access.ts"
    );

    expect(validateAllowedDocumentFileUrl("ftp://example.com/file.docx", ["*"])).toEqual({
      ok: false,
      reason: "unsupported_protocol",
      origin: "ftp://example.com",
    });
  });

  test("requires configured allowed origins", async () => {
    const { validateAllowedDocumentFileUrl } = await import(
      "../../src/domain/document-file-url-access.ts"
    );

    expect(validateAllowedDocumentFileUrl("https://example.com/file.docx", [])).toEqual({
      ok: false,
      reason: "not_configured",
      origin: "https://example.com",
    });
  });

  test("allows any HTTP origin when wildcard is configured", async () => {
    const { validateAllowedDocumentFileUrl } = await import(
      "../../src/domain/document-file-url-access.ts"
    );

    expect(validateAllowedDocumentFileUrl("https://example.com/file.docx", ["*"])).toEqual({
      ok: true,
    });
  });

  test("allows matching origins and rejects other origins", async () => {
    const { validateAllowedDocumentFileUrl } = await import(
      "../../src/domain/document-file-url-access.ts"
    );
    const allowedOrigins = ["https://files.example.com/path-is-ignored"];

    expect(validateAllowedDocumentFileUrl("https://files.example.com/report.docx", allowedOrigins)).toEqual({
      ok: true,
    });
    expect(validateAllowedDocumentFileUrl("https://other.example.com/report.docx", allowedOrigins)).toEqual({
      ok: false,
      reason: "outside_allowed_origins",
      origin: "https://other.example.com",
    });
  });

  test("formats access errors", async () => {
    const { formatDocumentFileUrlAccessError } = await import(
      "../../src/domain/document-file-url-access.ts"
    );

    expect(formatDocumentFileUrlAccessError("notaurl", { ok: false, reason: "invalid_url" })).toBe(
      "Invalid document file URL: notaurl",
    );
    expect(
      formatDocumentFileUrlAccessError("https://example.com/file.docx", {
        ok: false,
        reason: "outside_allowed_origins",
        origin: "https://example.com",
      }),
    ).toBe("Document file URL origin is not allowed: https://example.com");
  });
});
