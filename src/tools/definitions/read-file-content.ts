import { open, stat } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpTool } from "../index.js";
import { CONFIG } from "../../config.js";
import { formatLocalFileAccessError, resolveAllowedLocalFile } from "../../domain/local-file-access.js";

export const MAX_CHUNK_BYTES = 512 * 1024;

const TEMPLATES_DIR_PATH = import.meta.filename.endsWith(".ts")
  ? fileURLToPath(new URL("../../../assets/document-templates/", import.meta.url))
  : resolve(dirname(process.argv[1]), "assets", "document-templates");

/**
 * Resolves a blank file path using a three-step locale fallback:
 * 1. Full BCP47 tag:  assets/document-templates/{locale}/new.{ext}
 * 2. Language only:   assets/document-templates/{language}/new.{ext}
 * 3. Default:         assets/document-templates/default/new.{ext}
 */
async function resolveBlankFilePath(locale: string, fileType: string): Promise<{ filePath: string; size: number } | null> {
  const language = locale.split("-")[0];

  const candidates = [locale];
  if (language !== locale) candidates.push(language);
  candidates.push("default");

  for (const dir of candidates) {
    const filePath = resolve(TEMPLATES_DIR_PATH, dir, `new.${fileType}`);

    if (!filePath.startsWith(TEMPLATES_DIR_PATH)) continue;

    try {
      const { size } = await stat(filePath);
      return { filePath, size };
    } catch {
      // not found — try next candidate
    }
  }

  return null;
}

export const readFileContent: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "read_file_content",
      {
        description: "Read a chunk of a document file as base64-encoded bytes. App-only — called by the editor UI to stream files to the client.",
        inputSchema: {
          url: z.string().describe("Blank file URL in format blank://{locale}/{fileType}, or local file URL (stdio transport only)."),
          offset: z.number().int().min(0).default(0).describe("Byte offset to start reading from."),
          byteCount: z
            .number()
            .min(1)
            .max(MAX_CHUNK_BYTES)
            .default(MAX_CHUNK_BYTES)
            .describe("Bytes to read"),
        },
        _meta: { visibility: ["app"] },
      },
      async ({ url, offset, byteCount }) => {
        let filePath: string | undefined = undefined;
        let totalBytes: number = 0;

        if (url.startsWith("blank://")) {
          const parts = url.slice("blank://".length).split("/");
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            return {
              content: [],
              structuredContent: { error: `Invalid blank URL: ${url}` },
            };
          }

          const [locale, fileType] = parts;
          const resolved = await resolveBlankFilePath(locale, fileType);

          if (!resolved) {
            return {
              content: [],
              structuredContent: { error: `Template not found for locale "${locale}", type "${fileType}".` },
            };
          }

          filePath = resolved.filePath;
          totalBytes = resolved.size;
        }

        if (url.startsWith("file://")) {
          if (CONFIG.TRANSPORT !== "stdio") {
            return {
              content: [],
              structuredContent: { error: `Local file access is only supported with stdio transport.` },
            };
          }

          const resolved = await resolveAllowedLocalFile(url);
          if (!resolved.ok) {
            return {
              content: [],
              structuredContent: { error: formatLocalFileAccessError(url, resolved.reason) },
            };
          }
          filePath = resolved.filePath;
          totalBytes = resolved.size;
        } 
        
        if (!filePath) {
          return {
            content: [],
            structuredContent: { error: `Invalid path format. Expected blank://{locale}/{fileType} or file:// URL, got: ${url}` },
          };
        }

        let data: Buffer;
        try {
          const fh = await open(filePath, "r");
          try {
            const buf = Buffer.allocUnsafe(byteCount);
            const { bytesRead } = await fh.read(buf, 0, byteCount, offset);
            data = buf.subarray(0, bytesRead);
          } finally {
            await fh.close();
          }
        } catch {
          return {
            content: [],
            structuredContent: { error: `Failed to read file.` },
          };
        }

        const bytes = data.toString("base64");
        const hasMore = offset + data.length < totalBytes;

        return {
          content: [],
          structuredContent: {
            bytes,
            offset,
            byteCount: data.length,
            totalBytes,
            hasMore,
          },
        };
      }
    );
  },
};
