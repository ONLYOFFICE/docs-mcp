import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../../config.js";
import { EDITOR_APP_RESOURCE_URI } from "../../resources/definitions/editor.js";
import type { McpTool } from "../index.js";
import { createEditorConfig } from "../../domain/document-server/editor-config.js";
import { EditorConfigOutputSchema } from "./create-editor-config.js";

const FILE_TYPES = ["docx", "xlsx", "pptx"] as const;
const fileTypeSchema = z.enum(FILE_TYPES);
type FileType = z.infer<typeof fileTypeSchema>;

export function getBlankFileUrl(): string {
  return "https://static.onlyoffice.com/assets/docs/samples/blank";
}

export function getFileName(fileName: string, fileType: FileType): string {
  return fileName.endsWith(`.${fileType}`)
    ? fileName
    : `${fileName}.${fileType}`;
}

type CreateFileInput = {
  fileName: string;
  fileType: FileType;
  locale?: string;
};

type CreateFileDeps = {
  createEditorConfig?: typeof createEditorConfig;
  documentServerBaseUrl?: string;
  randomUUID?: () => string;
};

export function createCreateFileHandler(deps: CreateFileDeps = {}) {
  const buildEditorConfig = deps.createEditorConfig ?? createEditorConfig;
  const documentServerBaseUrl =
    deps.documentServerBaseUrl ?? CONFIG.DOCUMENT_SERVER_BASE_URL;
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);

  return async ({ fileName, fileType, locale }: CreateFileInput) => {
    const sessionId = randomUUID();
    const config = await buildEditorConfig({
      sessionId,
      fileName: getFileName(fileName, fileType),
      fileUrl: getBlankFileUrl(),
      mode: "edit",
      locale,
    });

    return {
      content: [],
      structuredContent: {
        sessionId,
        documentServerBaseUrl,
        shardkey: config.document.key,
        config,
      },
    };
  };
}

export const createFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "create_file",
      {
        title: "Create File",
        description:
          "Create a new blank document, spreadsheet, or presentation and open it in the ONLYOFFICE Editor. Returns a sessionId required by save_file.",
        inputSchema: {
          fileName: z
            .string()
            .describe(
              "Name for the new file, with or without extension (e.g. 'My Report').",
            ),
          fileType: fileTypeSchema.describe(
            "Document type: 'docx' for text document, 'xlsx' for spreadsheet, 'pptx' for presentation.",
          ),
          locale: z
            .string()
            .optional()
            .describe(
              "Template locale in BCP 47 language-region format (e.g. 'en-US', 'en-GB', 'ru-RU', 'sr-Cyrl-RS'). Use a full locale tag, not a language-only code like 'en' or 'ru'. Determines the language of the template content.",
            ),
        },
        outputSchema: EditorConfigOutputSchema,
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
        },
      },
      createCreateFileHandler(),
    );
  },
};
