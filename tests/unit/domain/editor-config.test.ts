import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("createEditorConfig", () => {
  test("builds editor config from document metadata", async () => {
    const { createEditorConfig } =
      await import("../../../src/domain/document-server/editor-config.ts");
    const calls: unknown[] = [];

    const config = await createEditorConfig(
      {
        sessionId: "session-1",
        fileName: "Report.DOCX",
        fileUrl: "https://files.example.com/Report.DOCX",
        mode: "edit",
      },
      {
        getDocumentType: async (extension) => {
          calls.push({ fn: "getDocumentType", extension });
          return "word";
        },
        isEditable: async (extension) => {
          calls.push({ fn: "isEditable", extension });
          return true;
        },
        jwtAlgorithm: "HS512",
        jwtExpiresIn: 120,
        jwtSecret: "custom-secret",
        signJwt(payload, secret, options) {
          calls.push({ fn: "signJwt", payload, secret, options });
          return "signed-token";
        },
      },
    );

    const unsignedConfig = {
      document: {
        fileType: "docx",
        key: "session-1",
        title: "Report.DOCX",
        url: "https://files.example.com/Report.DOCX",
        permissions: {
          edit: true,
          chat: false,
          download: false,
          print: false,
        },
      },
      documentType: "word",
      editorConfig: {
        mode: "edit",
        customization: {
          forcesave: true,
          compactHeader: true,
          compactToolbar: true,
          anonymous: {
            request: false,
          },
        },
      },
    };

    expect(config).toEqual({
      ...unsignedConfig,
      token: "signed-token",
    });
    expect(calls).toEqual([
      { fn: "isEditable", extension: "docx" },
      { fn: "getDocumentType", extension: "docx" },
      {
        fn: "signJwt",
        payload: unsignedConfig,
        secret: "custom-secret",
        options: { algorithm: "HS512", expiresIn: 120 },
      },
    ]);
  });

  test("creates a verifiable JWT token", async () => {
    const { createEditorConfig } =
      await import("../../../src/domain/document-server/editor-config.ts");
    const config = await createEditorConfig(
      {
        sessionId: "session-1",
        fileName: "Budget.xlsx",
        fileUrl: "_data_",
        mode: "view",
      },
      {
        getDocumentType: async () => "cell",
        isEditable: async () => false,
        jwtAlgorithm: "HS256",
        jwtExpiresIn: 60,
        jwtSecret: "verify-secret",
      },
    );

    const payload = jwt.verify(config.token, "verify-secret") as jwt.JwtPayload;

    expect(payload.document).toEqual({
      fileType: "xlsx",
      key: "session-1",
      title: "Budget.xlsx",
      url: "_data_",
      permissions: {
        edit: false,
        chat: false,
        download: false,
        print: false,
      },
    });
    expect(payload.documentType).toBe("cell");
    expect(payload.editorConfig).toMatchObject({
      mode: "view",
      customization: {
        forcesave: true,
        compactHeader: true,
        compactToolbar: true,
        anonymous: {
          request: false,
        },
      },
    });
  });
});
