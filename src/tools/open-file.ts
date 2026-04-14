import {
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONFIG } from "../config.js";
import { EDITOR_APP_RESOURCE_URI } from "../resources/editor.js";
import type { McpTool } from "./tool.js";
import { createEditorConfig } from "../utils/editor-config.js";

const FileSchema = z.object({
  download_url: z.url().describe("Direct download URL of the file to open."),
  file_id: z.string().describe("Unique identifier of the file."),
  file_name: z.string().describe("File name including extension (e.g. report.docx)."),
});

export const openFile: McpTool = {
  register(server: McpServer): void {
    registerAppTool(
      server,
      "open_file",
      {
        title: "Open File",
        description: "Open an existing file in the ONLYOFFICE Editor. Returns a sessionId required by list_editor_tools, call_editor_tool, and save_file.",
        inputSchema: {
          file: FileSchema,
        },
        _meta: {
          ui: { resourceUri: EDITOR_APP_RESOURCE_URI },
          "openai/fileParams": ["file"],
        },
      },
      async ({ file }) => {
        const fileName = file.file_name;
        const fileUrl = file.download_url;
        const sessionId = crypto.randomUUID();
        const config = await createEditorConfig({
          sessionId,
          fileName,
          fileUrl,
        });

        return {
          content: [],
          structuredContent: {
            sessionId,
            documentServerBaseUrl: CONFIG.DOCUMENT_SERVER_BASE_URL,
            config,
          },
        };
      }
    );
  },
};
