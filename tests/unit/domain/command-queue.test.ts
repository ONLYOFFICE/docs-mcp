import { describe, expect, jest, test } from "bun:test";
import {
  CommandQueue,
  CommandTimeoutError,
} from "../../../src/domain/editor-session/command-queue.ts";

describe("CommandQueue", () => {
  test("poll returns each queued command only once", () => {
    const queue = new CommandQueue();
    const result = queue.enqueue(
      "session-1",
      {
        id: "command-1",
        type: "aiListTools",
        payload: { documentType: "word" },
      },
      1_000,
    );

    expect(queue.poll("session-1")).toEqual([
      {
        id: "command-1",
        type: "aiListTools",
        payload: { documentType: "word" },
      },
    ]);
    expect(queue.poll("session-1")).toEqual([]);

    expect(queue.resolve("session-1", "command-1", { ok: true })).toBe(true);
    expect(result).resolves.toEqual({ ok: true });
  });

  test("keeps sessions isolated", () => {
    const queue = new CommandQueue();
    const first = queue.enqueue(
      "session-1",
      { id: "command-1", type: "saveFile" },
      1_000,
    );
    const second = queue.enqueue(
      "session-2",
      { id: "command-2", type: "aiCallTool" },
      1_000,
    );

    expect(queue.poll("session-1")).toEqual([
      { id: "command-1", type: "saveFile" },
    ]);
    expect(queue.poll("session-2")).toEqual([
      { id: "command-2", type: "aiCallTool" },
    ]);

    expect(queue.resolve("session-1", "command-1", "first-result")).toBe(true);
    expect(queue.resolve("session-2", "command-2", "second-result")).toBe(true);
    expect(first).resolves.toBe("first-result");
    expect(second).resolves.toBe("second-result");
  });

  test("resolve returns false for an unknown command", () => {
    const queue = new CommandQueue();

    expect(queue.resolve("missing-session", "missing-command", null)).toBe(
      false,
    );
  });

  test("rejects queued command after timeout", async () => {
    const queue = new CommandQueue();
    const result = queue.enqueue(
      "session-1",
      { id: "command-1", type: "saveFile" },
      1,
    );

    await expect(result).rejects.toBeInstanceOf(CommandTimeoutError);
    expect(queue.resolve("session-1", "command-1", null)).toBe(false);
  });

  test("longPoll returns commands already in the queue", async () => {
    const queue = new CommandQueue();
    const enqueuePromise = queue.enqueue(
      "session-1",
      { id: "command-1", type: "saveFile" },
      5_000,
    );

    const commands = await queue.longPoll("session-1");

    expect(commands).toEqual([{ id: "command-1", type: "saveFile" }]);
    queue.resolve("session-1", "command-1", null);
    await enqueuePromise;
  });

  test("longPoll resolves with commands that arrive after it starts waiting", async () => {
    const queue = new CommandQueue();
    const pollPromise = queue.longPoll("session-1");

    const enqueuePromise = queue.enqueue(
      "session-1",
      { id: "command-1", type: "aiListTools" },
      5_000,
    );

    const commands = await pollPromise;
    expect(commands).toEqual([{ id: "command-1", type: "aiListTools" }]);

    queue.resolve("session-1", "command-1", { tools: [] });
    await enqueuePromise;
  });

  test("a new longPoll call evicts the previous waiter, which resolves with empty", async () => {
    const queue = new CommandQueue();

    const poll1 = queue.longPoll("session-1");
    const poll2 = queue.longPoll("session-1");

    await expect(poll1).resolves.toEqual([]);

    const enqueuePromise = queue.enqueue(
      "session-1",
      { id: "command-1", type: "saveFile" },
      5_000,
    );
    const commands = await poll2;
    expect(commands).toEqual([{ id: "command-1", type: "saveFile" }]);

    queue.resolve("session-1", "command-1", null);
    await enqueuePromise;
  });

  test("longPoll returns empty after the 30-second timeout", async () => {
    jest.useFakeTimers();
    try {
      const queue = new CommandQueue();
      const pollPromise = queue.longPoll("session-1");
      jest.advanceTimersByTime(30_000);
      await expect(pollPromise).resolves.toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
