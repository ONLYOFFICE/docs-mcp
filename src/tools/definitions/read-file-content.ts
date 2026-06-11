import { open } from "fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpTool } from "../index.js";
import { getTransportMode, type TransportMode } from "../../runtime.js";
import {
  formatLocalFileAccessError,
  resolveAllowedLocalFile,
  type LocalFileAccessResult,
} from "../../domain/local-file-access.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

export const MAX_CHUNK_BYTES = 512 * 1024;

type ReadFileContentInput = {
  url: string;
  offset: number;
  byteCount: number;
};

type ReadFileContentDeps = {
  getTransportMode?: () => TransportMode;
  resolveAllowedLocalFile?: (uri: string) => Promise<LocalFileAccessResult>;
};

export function createReadFileContentHandler(deps: ReadFileContentDeps = {}) {
  const getMode = deps.getTransportMode ?? getTransportMode;
  const resolveLocalFile =
    deps.resolveAllowedLocalFile ?? resolveAllowedLocalFile;

  return async ({ url, offset, byteCount }: ReadFileContentInput) => {
    let filePath: string | undefined = undefined;
    let totalBytes: number = 0;

    if (url.startsWith("file://")) {
      if (getMode() !== "stdio") {
        return {
          content: [],
          structuredContent: {
            error: `Local file access is only supported with stdio transport.`,
          },
        };
      }

      const resolved = await resolveLocalFile(url);
      if (!resolved.ok) {
        return {
          content: [],
          structuredContent: {
            error: formatLocalFileAccessError(url, resolved.reason),
          },
        };
      }
      filePath = resolved.filePath;
      totalBytes = resolved.size;
    }

    if (!filePath) {
      return {
        content: [],
        structuredContent: {
          error: `Invalid path format. Expected file:// URL, got: ${url}`,
        },
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
    } catch (err) {
      console.error("[read-file-content] Failed to read file:", err);
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
  };
}

export const readFileContent: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "read_file_content",
      {
        description:
          "Read a chunk of a document file as base64-encoded bytes. App-only — called by the editor UI to stream files to the client.",
        inputSchema: {
          url: z.string().describe("Local file URL (stdio transport only)."),
          offset: z
            .number()
            .int()
            .min(0)
            .default(0)
            .describe("Byte offset to start reading from."),
          byteCount: z
            .number()
            .min(1)
            .max(MAX_CHUNK_BYTES)
            .default(MAX_CHUNK_BYTES)
            .describe("Bytes to read"),
        },
        _meta: { ui: { visibility: ["app"] } },
      },
      createReadFileContentHandler(),
    );
  },
};
