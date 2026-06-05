import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../../config.js";
import { getTransportMode, type TransportMode } from "../../runtime.js";
import { EDITOR_APP_RESOURCE_URI } from "../../resources/definitions/editor.js";
import type { McpTool } from "../index.js";
import {
  formatDocumentFileUrlAccessError,
  validateAllowedDocumentFileUrl,
} from "../../domain/document-file-url-access.js";
import { createEditorConfig } from "../../domain/document-server/editor-config.js";
import {
  getDocumentType,
  getExtension,
  getFileNameFromUrl,
} from "../../domain/document-server/file-utils.js";
import { formatsProvider } from "../../domain/document-server/formats-provider.js";
import {
  formatLocalFileAccessError,
  resolveAllowedLocalFile,
  type LocalFileAccessResult,
} from "../../domain/local-file-access.js";

const OpenAIFileSchema = z
  .object({
    download_url: z.url().describe("Direct download URL of the file to open."),
    file_id: z.string().describe("Unique identifier of the file."),
    file_name: z
      .string()
      .describe("File name including extension (e.g. report.docx)."),
  })
  .optional();

type OpenAIFile = z.infer<typeof OpenAIFileSchema>;

type OpenFileInput = {
  fileUrl?: string;
  openai_file?: OpenAIFile;
};

type OpenFileDeps = {
  createEditorConfig?: typeof createEditorConfig;
  documentServerBaseUrl?: string;
  formatsProvider?: {
    getListViewableExtensions(): Promise<string[]>;
  };
  getDocumentType?: typeof getDocumentType;
  getTransportMode?: () => TransportMode;
  randomUUID?: () => string;
  resolveAllowedLocalFile?: (uri: string) => Promise<LocalFileAccessResult>;
  validateAllowedDocumentFileUrl?: typeof validateAllowedDocumentFileUrl;
};

export function createOpenFileHandler(deps: OpenFileDeps = {}) {
  const buildEditorConfig = deps.createEditorConfig ?? createEditorConfig;
  const documentServerBaseUrl =
    deps.documentServerBaseUrl ?? CONFIG.DOCUMENT_SERVER_BASE_URL;
  const documentTypeForExtension = deps.getDocumentType ?? getDocumentType;
  const getMode = deps.getTransportMode ?? getTransportMode;
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);
  const resolveLocalFile =
    deps.resolveAllowedLocalFile ?? resolveAllowedLocalFile;
  const supportedFormatsProvider = deps.formatsProvider ?? formatsProvider;
  const validateDocumentFileUrl =
    deps.validateAllowedDocumentFileUrl ?? validateAllowedDocumentFileUrl;

  return async ({ fileUrl, openai_file }: OpenFileInput) => {
    let fileName: string;
    let downloadUrl: string;
    let isLocalFile = false;

    if (fileUrl) {
      isLocalFile = fileUrl.startsWith("file://");

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

      fileName = getFileNameFromUrl(fileUrl);
      downloadUrl = fileUrl;
    } else if (openai_file) {
      const validated = validateDocumentFileUrl(openai_file.download_url);
      if (!validated.ok) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatDocumentFileUrlAccessError(
                openai_file.download_url,
                validated,
              ),
            },
          ],
          isError: true,
        };
      }

      fileName = openai_file.file_name;
      downloadUrl = openai_file.download_url;
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text: "No file specified. Please provide a fileUrl parameter or openai_file.",
          },
        ],
        isError: true,
      };
    }

    const sessionId = randomUUID();

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
      fileUrl: isLocalFile ? "_data_" : downloadUrl,
      mode: "view",
    });

    return {
      content: [],
      structuredContent: {
        sessionId,
        documentServerBaseUrl,
        shardkey: config.document.key,
        config,
        ...(isLocalFile ? { fileUrl: downloadUrl } : {}),
      },
    };
  };
}

export const openFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "open_file",
      {
        title: "Open File",
        description: "Open an existing file in the ONLYOFFICE Editor.",
        inputSchema: {
          fileUrl: z
            .url()
            .optional()
            .describe("Direct download URL of the file to open."),
          openai_file: OpenAIFileSchema.describe(
            "File object returned by OpenAI file upload API. If provided, the file will be downloaded from the download_url.",
          ),
        },
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
          "openai/fileParams": ["openai_file"],
        },
      },
      createOpenFileHandler(),
    );
  },
};
