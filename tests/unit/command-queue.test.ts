import { describe, expect, test } from "bun:test";
import { CommandQueue, CommandTimeoutError } from "../../src/domain/editor-session/command-queue.ts";

describe("CommandQueue", () => {
  test("poll returns each queued command only once", () => {
    const queue = new CommandQueue();
    const result = queue.enqueue(
      "session-1",
      { id: "command-1", type: "aiListTools", payload: { documentType: "word" } },
      1_000,
    );

    expect(queue.poll("session-1")).toEqual([
      { id: "command-1", type: "aiListTools", payload: { documentType: "word" } },
    ]);
    expect(queue.poll("session-1")).toEqual([]);

    expect(queue.resolve("session-1", "command-1", { ok: true })).toBe(true);
    expect(result).resolves.toEqual({ ok: true });
  });

  test("keeps sessions isolated", () => {
    const queue = new CommandQueue();
    const first = queue.enqueue("session-1", { id: "command-1", type: "saveFile" }, 1_000);
    const second = queue.enqueue("session-2", { id: "command-2", type: "aiCallTool" }, 1_000);

    expect(queue.poll("session-1")).toEqual([{ id: "command-1", type: "saveFile" }]);
    expect(queue.poll("session-2")).toEqual([{ id: "command-2", type: "aiCallTool" }]);

    expect(queue.resolve("session-1", "command-1", "first-result")).toBe(true);
    expect(queue.resolve("session-2", "command-2", "second-result")).toBe(true);
    expect(first).resolves.toBe("first-result");
    expect(second).resolves.toBe("second-result");
  });

  test("resolve returns false for an unknown command", () => {
    const queue = new CommandQueue();

    expect(queue.resolve("missing-session", "missing-command", null)).toBe(false);
  });

  test("rejects queued command after timeout", async () => {
    const queue = new CommandQueue();
    const result = queue.enqueue("session-1", { id: "command-1", type: "saveFile" }, 1);

    await expect(result).rejects.toBeInstanceOf(CommandTimeoutError);
    expect(queue.resolve("session-1", "command-1", null)).toBe(false);
  });
});
