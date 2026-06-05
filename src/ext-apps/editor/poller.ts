import type { App } from "@modelcontextprotocol/ext-apps";
import type {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";

export interface PollerOptions {
  /** Name of the app-only MCP tool to call (visibility: ["app"]). */
  tool: string;
  /** Arguments forwarded to the tool on every poll. */
  arguments?: CallToolRequest["params"]["arguments"];
  /** Called with the tool result after each successful poll. */
  onResult: (result: CallToolResult) => void;
  /** Called when the tool call throws (transport-level error). */
  onError?: (error: unknown) => void;
}

export class Poller {
  private active = false;

  constructor(
    private readonly app: App,
    private readonly options: PollerOptions,
  ) {}

  /**
   * Start long-polling: call the tool, wait for the response, repeat immediately.
   * Calling start() on an already-running poller is a no-op.
   */
  start(): void {
    if (this.active) return;
    this.active = true;
    void this.loop();
  }

  /**
   * Stop polling. The current in-flight request is allowed to complete,
   * but its result is discarded.
   */
  stop(): void {
    this.active = false;
  }

  private async loop(): Promise<void> {
    while (this.active) {
      try {
        const result = await this.app.callServerTool({
          name: this.options.tool,
          arguments: this.options.arguments ?? {},
        });

        if (this.active) {
          this.options.onResult(result);
        }
      } catch (error) {
        if (this.active) {
          this.options.onError?.(error);
          // Brief pause on error to avoid a tight retry loop
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }
}
