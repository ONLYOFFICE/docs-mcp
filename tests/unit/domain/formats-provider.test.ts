import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("FormatsProvider", () => {
  test("fetches document formats from the Document Server metadata endpoint", async () => {
    const { FormatsProvider } = await import("../../../src/domain/document-server/formats-provider.ts");
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return jsonResponse([{ name: "docx", type: "word", actions: ["edit"], convert: [], mime: [] }]);
    };
    const provider = new FormatsProvider("https://document-server.example/base", fetchImpl);

    await expect(provider.getDocFormats()).resolves.toEqual([
      { name: "docx", type: "word", actions: ["edit"], convert: [], mime: [] },
    ]);
    expect(calls).toEqual(["https://document-server.example/meta/formats"]);
  });

  test("uses cached document formats within the cache TTL", async () => {
    const { FormatsProvider } = await import("../../../src/domain/document-server/formats-provider.ts");
    let callCount = 0;
    const fetchImpl = async () => {
      callCount += 1;
      return jsonResponse([{ name: "xlsx", type: "cell", actions: ["edit"], convert: [], mime: [] }]);
    };
    const provider = new FormatsProvider("https://document-server.example", fetchImpl, () => 1_000);

    expect(await provider.getDocFormats()).toHaveLength(1);
    expect(await provider.getDocFormats()).toHaveLength(1);
    expect(callCount).toBe(1);
  });

  test("throws when the Document Server metadata request fails", async () => {
    const { FormatsProvider } = await import("../../../src/domain/document-server/formats-provider.ts");
    const fetchImpl = async () => new Response("nope", { status: 503, statusText: "Unavailable" });
    const provider = new FormatsProvider("https://document-server.example", fetchImpl);

    await expect(provider.getDocFormats()).rejects.toThrow(
      "Failed to fetch formats from Document Server: 503 Unavailable",
    );
  });

  test("finds formats by extension", async () => {
    const { FormatsProvider } = await import("../../../src/domain/document-server/formats-provider.ts");
    const provider = new FormatsProvider("https://document-server.example", async () =>
      jsonResponse([
        { name: "docx", type: "word", actions: ["edit"], convert: [], mime: [] },
        { name: "pdf", type: "pdf", actions: ["view"], convert: [], mime: [] },
      ]),
    );

    await expect(provider.getDocFormatByExtension("pdf")).resolves.toEqual({
      name: "pdf",
      type: "pdf",
      actions: ["view"],
      convert: [],
      mime: [],
    });
    await expect(provider.getDocFormatByExtension("txt")).resolves.toBeUndefined();
  });

  test("lists only viewable extensions", async () => {
    const { FormatsProvider } = await import("../../../src/domain/document-server/formats-provider.ts");
    const provider = new FormatsProvider("https://document-server.example", async () =>
      jsonResponse([
        { name: "docx", type: "word", actions: ["edit"], convert: [], mime: [] },
        { name: "bin", type: "", actions: [], convert: [], mime: [] },
        { name: "pdf", type: "pdf", actions: ["view"], convert: [], mime: [] },
      ]),
    );

    await expect(provider.getListViewableExtensions()).resolves.toEqual(["docx", "pdf"]);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}
