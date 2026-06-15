import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../../config.js";
import { getTransportMode, type TransportMode } from "../../runtime.js";
import type { McpTool } from "../index.js";
import {
  formatDocumentFileUrlAccessError,
  validateAllowedDocumentFileUrl,
} from "../../domain/document-file-url-access.js";
import { createEditorConfig as buildEditorConfigDefault } from "../../domain/document-server/editor-config.js";
import {
  getDocumentType,
  getExtension,
} from "../../domain/document-server/file-utils.js";
import { formatsProvider } from "../../domain/document-server/formats-provider.js";
import {
  formatLocalFileAccessError,
  resolveAllowedLocalFile,
  type LocalFileAccessResult,
} from "../../domain/local-file-access.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";

type CreateEditorConfigInput = {
  sessionId: string;
  fileName: string;
  fileUrl: string;
  mode: "edit" | "view";
};

type CreateEditorConfigDeps = {
  createEditorConfig?: typeof buildEditorConfigDefault;
  documentServerBaseUrl?: string;
  formatsProvider?: {
    getListViewableExtensions(): Promise<string[]>;
  };
  getDocumentType?: typeof getDocumentType;
  getTransportMode?: () => TransportMode;
  resolveAllowedLocalFile?: (uri: string) => Promise<LocalFileAccessResult>;
  validateAllowedDocumentFileUrl?: typeof validateAllowedDocumentFileUrl;
};

export const EditorConfigOutputSchema = {
  sessionId: z.string().describe("Editor session ID."),
  documentServerBaseUrl: z
    .string()
    .describe("Base URL of the ONLYOFFICE Document Server."),
  shardkey: z.string().describe("Document key used as the editor shard key."),
  config: z.looseObject({}).describe("ONLYOFFICE Docs editor configuration."),
  fileUrl: z
    .string()
    .optional()
    .describe(
      "Original local file URL when streaming file bytes from the app.",
    ),
};

export function createCreateEditorConfigHandler(
  deps: CreateEditorConfigDeps = {},
) {
  const buildEditorConfig = deps.createEditorConfig ?? buildEditorConfigDefault;
  const documentServerBaseUrl =
    deps.documentServerBaseUrl ?? CONFIG.DOCUMENT_SERVER_BASE_URL;
  const documentTypeForExtension = deps.getDocumentType ?? getDocumentType;
  const getMode = deps.getTransportMode ?? getTransportMode;
  const resolveLocalFile =
    deps.resolveAllowedLocalFile ?? resolveAllowedLocalFile;
  const supportedFormatsProvider = deps.formatsProvider ?? formatsProvider;
  const validateDocumentFileUrl =
    deps.validateAllowedDocumentFileUrl ?? validateAllowedDocumentFileUrl;

  return async ({
    sessionId,
    fileName,
    fileUrl,
    mode,
  }: CreateEditorConfigInput) => {
    const isLocalFile = fileUrl.startsWith("file://");

    if (isLocalFile && getMode() !== "stdio") {
      return {
        content: [
          {
            type: "text" as const,
            text: "Local file:// URLs are only supported with stdio transport.",
          },
        ],
        isError: true,
      };
    }

    if (isLocalFile) {
      const resolved = await resolveLocalFile(fileUrl);

      if (!resolved.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatLocalFileAccessError(fileUrl, resolved.reason),
            },
          ],
          isError: true,
        };
      }
    }

    if (!isLocalFile) {
      const validated = validateDocumentFileUrl(fileUrl);

      if (!validated.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatDocumentFileUrlAccessError(fileUrl, validated),
            },
          ],
          isError: true,
        };
      }
    }

    const extension = getExtension(fileName);
    const documentType = await documentTypeForExtension(extension);

    if (!documentType) {
      const supportedExtensions =
        await supportedFormatsProvider.getListViewableExtensions();

      return {
        content: [
          {
            type: "text" as const,
            text: `The file type .${extension} is not supported. Supported file types: ${supportedExtensions.join(", ")}.`,
          },
        ],
        isError: true,
      };
    }

    const config = await buildEditorConfig({
      sessionId,
      fileName,
      fileUrl: isLocalFile ? "_data_" : fileUrl,
      mode,
    });

    return {
      content: [],
      structuredContent: {
        sessionId,
        documentServerBaseUrl,
        shardkey: config.document.key,
        config,
        ...(isLocalFile ? { fileUrl: fileUrl } : {}),
      },
    };
  };
}

export const createEditorConfig: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "create_editor_config",
      {
        description:
          "Create an ONLYOFFICE editor config for an existing editor session.",
        inputSchema: {
          sessionId: z
            .string()
            .describe("Existing editor session ID to reuse for the config."),
          fileName: z
            .string()
            .describe("File name including extension (e.g. report.docx)."),
          fileUrl: z
            .url()
            .describe(
              "Document URL to open. Local file:// URLs are supported only with stdio transport.",
            ),
          mode: z
            .enum(["edit", "view"])
            .default("edit")
            .describe(
              "Editor mode: 'edit' to allow editing, 'view' for read-only.",
            ),
        },
        outputSchema: EditorConfigOutputSchema,
        _meta: { ui: { visibility: ["app"] } },
      },
      createCreateEditorConfigHandler(),
    );
  },
};
