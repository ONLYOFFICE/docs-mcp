import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type TransportMode } from "../../runtime.js";
import { EDITOR_APP_RESOURCE_URI } from "../../resources/definitions/editor.js";
import type { McpTool } from "../index.js";
import { validateAllowedDocumentFileUrl } from "../../domain/document-file-url-access.js";
import { createEditorConfig } from "../../domain/document-server/editor-config.js";
import {
  getDocumentType,
  getFileNameFromUrl,
} from "../../domain/document-server/file-utils.js";
import { type LocalFileAccessResult } from "../../domain/local-file-access.js";
import {
  createCreateEditorConfigHandler,
  EditorConfigOutputSchema,
} from "./create-editor-config.js";

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
  mode: "edit" | "view";
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
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);

  const createEditorConfigHandler = createCreateEditorConfigHandler(deps);

  return async ({ fileUrl, openai_file }: OpenFileInput) => {
    const sessionId = randomUUID();

    let fileName: string;

    if (fileUrl) {
      fileName = getFileNameFromUrl(fileUrl);
    } else if (openai_file) {
      fileName = openai_file.file_name;
      fileUrl = openai_file.download_url;
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

    return await createEditorConfigHandler({ sessionId, fileName, fileUrl });
  };
}

export const openFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "open_file",
      {
        title: "Open File",
        description:
          "Open an existing file in the ONLYOFFICE Editor. Returns a sessionId required by save_file.",
        inputSchema: {
          fileUrl: z
            .url()
            .optional()
            .describe("Direct download URL of the file to open."),
          openai_file: OpenAIFileSchema.describe(
            "File object returned by OpenAI file upload API. If provided, the file will be downloaded from the download_url.",
          ),
          mode: z
            .enum(["edit", "view"])
            .default("edit")
            .describe(
              "Editor mode: 'edit' to allow editing, 'view' for read-only.",
            ),
        },
        outputSchema: EditorConfigOutputSchema,
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
          "openai/fileParams": ["openai_file"],
        },
      },
      createOpenFileHandler(),
    );
  },
};
