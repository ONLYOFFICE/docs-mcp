import {
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../../config.js";
import { EDITOR_APP_RESOURCE_URI } from "../../resources/definitions/editor.js";
import type { McpTool } from "../index.js";
import { createEditorConfig } from "../../utils/editor-config.js";

const FILE_TYPES = ["docx", "xlsx", "pptx"] as const;
const fileTypeSchema = z.enum(FILE_TYPES);

function getBlankFileUrl(locale: string, fileType: z.infer<typeof fileTypeSchema>): string {
  return `blank://${locale}/${fileType}`;
}

function getFileName(fileName: string, fileType: z.infer<typeof fileTypeSchema>): string {
  return fileName.endsWith(`.${fileType}`) ? fileName : `${fileName}.${fileType}`;
}

export const createFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "create_file",
      {
        title: "Create File",
        description: "Create a new blank document, spreadsheet, or presentation and open it in the ONLYOFFICE Editor. Returns a sessionId required by list_editor_tools, call_editor_tool, and save_file.",
        inputSchema: {
          fileName: z.string().describe("Name for the new file, with or without extension (e.g. 'My Report')."),
          fileType: fileTypeSchema.describe("Document type: 'docx' for text document, 'xlsx' for spreadsheet, 'pptx' for presentation."),
          locale: z.string().optional().describe("Template locale (e.g. 'en', 'en-US', 'en-GB', 'de', 'es'). Determines the language of the template content."),
        },
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
        },
      },
      async ({ fileName, fileType, locale }) => {
        const sessionId = crypto.randomUUID();
        const config = await createEditorConfig({
          sessionId,
          fileName: getFileName(fileName, fileType),
          fileUrl: `_data_`,
          mode: "edit",
        });

        return {
          content: [],
          structuredContent: {
            sessionId,
            documentServerBaseUrl: CONFIG.DOCUMENT_SERVER_BASE_URL,
            config,
            fileUrl: getBlankFileUrl(locale || "default", fileType),
          },
        };
      }
    );
  },
};
