import type { App } from "@modelcontextprotocol/ext-apps";
import type {
  CommandType,
  Command,
} from "../../domain/editor-session/command-queue.js";
import { Poller } from "./poller.js";

declare const DocsAPI: {
  DocEditor: new (id: string, config: object) => DocEditor;
};

interface DocEditor {
  denyEditingRights(): void;
  downloadAs(): void;
  openDocument(data: Uint8Array): void;
}

export type EditorConfig = {
  document: {
    permissions?: {
      edit?: boolean;
    };
    title?: string;
    url?: string;
  };
  documentType?: string | null;
  editorConfig: {
    lang?: string;
    mode?: string;
  };
  type?: "desktop" | "mobile" | "embedded";
  events?: Record<string, unknown>;
  token?: string;
};

const log = {
  info: console.log.bind(console, "[ONLYOFFICE-EDITOR-CLIENT]"),
  error: console.error.bind(console, "[ONLYOFFICE-EDITOR-CLIENT]"),
};

export class DocEditorClient {
  private docEditor: DocEditor | null = null;
  private poller: Poller | null = null;
  private pendingToolCommandId: string | null = null;
  private commandQueue: Command[] = [];

  constructor(
    private readonly app: App,
    private readonly containerId: string,
    private readonly documentServerBaseUrl: string,
    private readonly sessionId: string,
  ) {}

  async init(shardkey: string): Promise<void> {
    await this.loadScript(
      `${this.documentServerBaseUrl}/web-apps/apps/api/documents/api.js?shardkey=${shardkey}`,
    );
  }

  open(config: EditorConfig, fileUrl?: string): void {
    config.events = {
      onAppReady: () => {
        if (config.document?.url === "_data_" && fileUrl) {
          this.onAppReady(fileUrl);
        }
      },
      onDocumentReady: () => {
        const startPolling =
          config.document.permissions?.edit === true &&
          config.editorConfig?.mode === "edit";

        this.onDocumentReady(startPolling);
      },
      onRequestSaveAs: this.onRequestSaveAs,
      onSaveDocument: this.onSaveDocument,
      onDownloadAs: this.onDownloadAs,
    };

    this.docEditor = new DocsAPI.DocEditor(this.containerId, config);
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  private enqueueCommands(commands: Command[]): void {
    this.commandQueue.push(...commands);

    if (!this.pendingToolCommandId) this.processNext();
  }

  private processNext(): void {
    this.pendingToolCommandId = null;
    const command = this.commandQueue.shift();

    if (!command) return;

    this.pendingToolCommandId = command.id;
    const handlers: Record<CommandType, () => void> = {
      saveFile: () => this.saveFile(command),
    };

    handlers[command.type]?.();
  }

  private completeCommand(commandId: string, result: unknown): Promise<void> {
    return this.app
      .callServerTool({
        name: "set_editor_command_result",
        arguments: { sessionId: this.sessionId, commandId, result },
      })
      .then(
        () => {},
        (err) => log.error("set_editor_command_result failed:", err),
      )
      .finally(() => this.processNext());
  }

  private saveFile(command: Command): void {
    if (!this.docEditor) {
      void this.completeCommand(command.id, {
        error: "Document editor is not available.",
      });
      return;
    }

    try {
      this.docEditor.downloadAs();
      void this.completeCommand(command.id, { ok: true });
    } catch (error) {
      void this.completeCommand(command.id, {
        error: error instanceof Error ? error.message : "Failed to save file.",
      });
    }
  }

  private async readFileContent(url: string): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let offset = 0;

    for (;;) {
      const result = await this.app.callServerTool({
        name: "read_file_content",
        arguments: { url, offset },
      });

      const sc = result.structuredContent as
        | { error: string }
        | {
            bytes: string;
            byteCount: number;
            totalBytes: number;
            hasMore: boolean;
          };

      if ("error" in sc) {
        log.error("read_file_content error:", sc.error);
        throw new Error(`read_file_content: ${sc.error}`);
      }

      const { bytes, byteCount, hasMore } = sc;

      chunks.push(Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0)));
      offset += byteCount;

      if (!hasMore) break;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, pos);
      pos += chunk.length;
    }

    return buffer;
  }

  private readonly onAppReady = async (fileUrl: string) => {
    if (!this.docEditor) return;

    this.docEditor.openDocument(await this.readFileContent(fileUrl));
  };

  private readonly onDocumentReady = (startPolling: boolean) => {
    log.info("Document is ready (onDocumentReady)");

    if (startPolling) {
      this.poller = new Poller(this.app, {
        tool: "poll_editor_commands",
        arguments: { sessionId: this.sessionId },
        onResult: (result) => {
          const { commands } = result.structuredContent as {
            commands: Command[];
          };
          this.enqueueCommands(commands);
        },
        onError: (error) => {
          log.error("poll_editor_commands error:", error);
        },
      });
      this.poller.start();
    }
  };

  private readonly onRequestSaveAs = async (event: {
    data: { url: string };
  }) => {
    this.app.openLink({
      url: event.data.url,
    });
  };

  private readonly onSaveDocument = async () => {
    if (!this.docEditor) return;

    this.docEditor.downloadAs();
  };

  private readonly onDownloadAs = async (event: { data: { url: string } }) => {
    this.app.openLink({
      url: event.data.url,
    });
  };
}
