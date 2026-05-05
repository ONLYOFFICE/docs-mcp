import { describe, expect, test } from "bun:test";
import { CommandQueue } from "../../../src/domain/editor-session/command-queue.ts";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("editor command tool flow", () => {
  test("polls a queued command and resolves it with a result", async () => {
    const { createPollEditorCommandsHandler } = await import(
      "../../../src/tools/definitions/poll-editor-commands.ts"
    );
    const { createSetEditorCommandResultHandler } = await import(
      "../../../src/tools/definitions/set-editor-command-result.ts"
    );
    const queue = new CommandQueue();
    const commandResult = queue.enqueue(
      "session-1",
      { id: "command-1", type: "aiListTools", payload: { documentType: "word" } },
      1_000,
    );
    const pollHandler = createPollEditorCommandsHandler({ commandQueue: queue });
    const resultHandler = createSetEditorCommandResultHandler({ commandQueue: queue });

    await expect(pollHandler({ sessionId: "session-1" })).resolves.toEqual({
      content: [],
      structuredContent: {
        commands: [
          { id: "command-1", type: "aiListTools", payload: { documentType: "word" } },
        ],
      },
    });

    await expect(
      resultHandler({
        sessionId: "session-1",
        commandId: "command-1",
        result: { tools: ["insertText"] },
      }),
    ).resolves.toEqual({ content: [{ type: "text", text: "ok" }] });
    await expect(commandResult).resolves.toEqual({ tools: ["insertText"] });
  });
});
