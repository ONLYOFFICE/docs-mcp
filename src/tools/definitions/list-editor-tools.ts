import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { commandQueue, CommandTimeoutError } from "../../domain/editor-session/command-queue.js";
import { CONFIG } from "../../config.js";
import type { McpTool } from "../index.js";

type DocumentType = "word" | "cell" | "slide" | "pdf";
type EditorTool = { name: string };
type ToolsConfig = Record<DocumentType, string[] | "all">;

const ENABLED_CONFIG: ToolsConfig = {
  word: CONFIG.DOCUMENT_SERVER_AI_WORD_TOOLS_ENABLED,
  cell: CONFIG.DOCUMENT_SERVER_AI_CELL_TOOLS_ENABLED,
  slide: CONFIG.DOCUMENT_SERVER_AI_SLIDE_TOOLS_ENABLED,
  pdf: CONFIG.DOCUMENT_SERVER_AI_PDF_TOOLS_ENABLED,
};

const DISABLED_CONFIG: ToolsConfig = {
  word: CONFIG.DOCUMENT_SERVER_AI_WORD_TOOLS_DISABLED,
  cell: CONFIG.DOCUMENT_SERVER_AI_CELL_TOOLS_DISABLED,
  slide: CONFIG.DOCUMENT_SERVER_AI_SLIDE_TOOLS_DISABLED,
  pdf: CONFIG.DOCUMENT_SERVER_AI_PDF_TOOLS_DISABLED,
};

export function filterTools(
  tools: EditorTool[],
  documentType: string | null,
  enabledConfig: ToolsConfig = ENABLED_CONFIG,
  disabledConfig: ToolsConfig = DISABLED_CONFIG,
): EditorTool[] {
  const type = documentType as DocumentType | null;
  if (!type || !(type in enabledConfig)) return [];

  const enabled = enabledConfig[type];
  const disabled = disabledConfig[type];

  if (disabled === "all") return [];
  const result = enabled === "all" ? tools : tools.filter((t) => enabled.includes(t.name));
  return disabled.length > 0 ? result.filter((t) => !disabled.includes(t.name)) : result;
}

type ListEditorToolsInput = {
  sessionId: string;
};

type ListEditorToolsDeps = {
  commandQueue?: {
    enqueue(sessionId: string, command: { id: string; type: "aiListTools" }, timeoutMs: number): Promise<unknown>;
  };
  randomUUID?: () => string;
  enabledConfig?: ToolsConfig;
  disabledConfig?: ToolsConfig;
};

export function createListEditorToolsHandler(deps: ListEditorToolsDeps = {}) {
  const queue = deps.commandQueue ?? commandQueue;
  const randomUUID = deps.randomUUID ?? crypto.randomUUID.bind(crypto);

  return async ({ sessionId }: ListEditorToolsInput) => {
    try {
      const result = await queue.enqueue(sessionId, { id: randomUUID(), type: "aiListTools" }, 10000);
      const { documentType, tools } = result as { documentType: string | null; tools: EditorTool[] };
      return {
        content: [],
        structuredContent: {
          tools: filterTools(tools, documentType, deps.enabledConfig, deps.disabledConfig),
        },
      };
    } catch (err) {
      if (err instanceof CommandTimeoutError) {
        return { content: [{ type: "text" as const, text: "Timeout: no response from editor" }], isError: true };
      }
      throw err;
    }
  };
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
      createListEditorToolsHandler()
    );
  },
};
