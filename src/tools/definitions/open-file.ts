import {
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../../config.js";
import { EDITOR_APP_RESOURCE_URI } from "../../resources/definitions/editor.js";
import type { McpTool } from "../index.js";
import { createEditorConfig } from "../../domain/document-server/editor-config.js";
import { getDocumentType, getExtension } from "../../domain/document-server/file-utils.js";
import { formatsProvider } from "../../domain/document-server/formats-provider.js";
import { basename } from "path";
import { fileURLToPath } from "url";
import { stat } from "fs/promises";

const OpenAIFileSchema = z.object({
  download_url: z.url().describe("Direct download URL of the file to open."),
  file_id: z.string().describe("Unique identifier of the file."),
  file_name: z.string().describe("File name including extension (e.g. report.docx)."),
}).optional();

export const openFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "open_file",
      {
        title: "Open File",
        description: "Open an existing file in the ONLYOFFICE Editor. Returns a sessionId required by list_editor_tools, call_editor_tool, and save_file.",
        inputSchema: {
          fileUrl: z.url().optional().describe("Direct download URL of the file to open."),
          openai_file: OpenAIFileSchema.describe("File object returned by OpenAI file upload API. If provided, the file will be downloaded from the download_url."),
          mode: z.enum(["edit", "view"]).default("edit").describe("Editor mode: 'edit' to allow editing, 'view' for read-only."),
        },
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
          "openai/fileParams": ["openai_file"],
        },
      },
      async ({ mode, fileUrl, openai_file }) => {
        let fileName = undefined;
        let downloadUrl = undefined;
        let isLocalFile = false;

        if (fileUrl) {
          isLocalFile = fileUrl.startsWith("file://");

          if (isLocalFile && CONFIG.TRANSPORT !== "stdio") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Local file:// URLs are only supported with stdio transport."
                }
              ],
               isError: true,
            };
          }

          if (isLocalFile) {
            const filePath = fileURLToPath(fileUrl);

            try {
              await stat(filePath);
            } catch {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `File not found: ${fileUrl}`
                  }
                ],
                isError: true,
              };
            }
          }

          fileName = basename(fileUrl);
          downloadUrl = fileUrl;
        } else if (openai_file) {
          fileName = openai_file.file_name;
          downloadUrl = openai_file.download_url;
        } else {
          return {
            content: [
              {
                type: "text" as const,
                text: "No file specified. Please provide a fileUrl parameter or openai_file."
              }
            ],
            isError: true,
          };
        }

        const sessionId = crypto.randomUUID();

        const extension = getExtension(fileName);
        const documentType = await getDocumentType(extension);

        if (!documentType) {
          const supportedExtensions = await formatsProvider.getListViewableExtensions();

          return {
            content: [
              {
                type: "text",
                text: `The file type .${extension} is not supported. Supported file types: ${supportedExtensions.join(", ")}.`,
              },
            ],
            isError: true,
          };
        }

        const config = await createEditorConfig({
          sessionId,
          fileName,
          fileUrl: isLocalFile ? "_data_" : downloadUrl,
          mode,
        });

        return {
          content: [],
          structuredContent: {
            sessionId,
            documentServerBaseUrl: CONFIG.DOCUMENT_SERVER_BASE_URL,
            config,
            ...(isLocalFile ? { fileUrl: downloadUrl } : {}),
          },
        };
      }
    );
  },
};
