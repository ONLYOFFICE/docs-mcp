import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue, CommandTimeoutError } from "../command-queue.js";
import { CONFIG } from "../config.js";
import type { McpTool } from "./tool.js";

type DocumentType = "word" | "cell" | "slide" | "pdf";

const ENABLED_CONFIG: Record<DocumentType, string[] | "all"> = {
  word: CONFIG.DOCUMENT_SERVER_AI_WORD_TOOLS_ENABLED,
  cell: CONFIG.DOCUMENT_SERVER_AI_CELL_TOOLS_ENABLED,
  slide: CONFIG.DOCUMENT_SERVER_AI_SLIDE_TOOLS_ENABLED,
  pdf: CONFIG.DOCUMENT_SERVER_AI_PDF_TOOLS_ENABLED,
};

const DISABLED_CONFIG: Record<DocumentType, string[] | "all"> = {
  word: CONFIG.DOCUMENT_SERVER_AI_WORD_TOOLS_DISABLED,
  cell: CONFIG.DOCUMENT_SERVER_AI_CELL_TOOLS_DISABLED,
  slide: CONFIG.DOCUMENT_SERVER_AI_SLIDE_TOOLS_DISABLED,
  pdf: CONFIG.DOCUMENT_SERVER_AI_PDF_TOOLS_DISABLED,
};

function filterTools(tools: Array<{ name: string }>, documentType: string | null): Array<{ name: string }> {
  const type = documentType as DocumentType | null;
  if (!type || !(type in ENABLED_CONFIG)) return [];

  const enabled = ENABLED_CONFIG[type];
  const disabled = DISABLED_CONFIG[type];

  if (disabled === "all") return [];
  const result = enabled === "all" ? tools : tools.filter((t) => enabled.includes(t.name));
  return disabled.length > 0 ? result.filter((t) => !disabled.includes(t.name)) : result;
}

export const listEditorTools: McpTool = {
  register(server: McpServer): void {
    server.registerTool(
      "list_editor_tools",
      {
        description: "List all plugin tools available in the current ONLYOFFICE editing session, with their names and input schemas. Always call this before call_editor_tool to discover valid tool names.",
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          sessionId: z
            .string()
            .describe("Session ID returned by open_file or create_file."),
        },
      },
      async ({ sessionId }) => {
        try {
          const result = await commandQueue.enqueue(sessionId, { id: crypto.randomUUID(), type: "aiListTools" }, 10000);
          const { documentType, tools } = result as { documentType: string | null; tools: Array<{ name: string }> };
          return { content: [], structuredContent: { tools: filterTools(tools, documentType) } };
        } catch (err) {
          if (err instanceof CommandTimeoutError) {
            return { content: [{ type: "text" as const, text: "Timeout: no response from editor" }] };
          }
          throw err;
        }
      }
    );
  },
};
