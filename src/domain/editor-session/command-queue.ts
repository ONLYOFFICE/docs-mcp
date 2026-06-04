const LONG_POLL_TIMEOUT_MS = 30_000;
const POLL_BATCH_WAIT_MS = 200;

export type CommandType = "saveFile";

export interface Command {
  id: string;
  type: CommandType;
  payload?: unknown;
}

interface PendingCommand extends Command {
  dispatched: boolean;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

type SessionId = string;

export class CommandTimeoutError extends Error {
  constructor(
    public readonly commandId: string,
    public readonly sessionId: string,
  ) {
    super(`Command "${commandId}" timed out for session "${sessionId}"`);
    this.name = "CommandTimeoutError";
  }
}

export class CommandQueue {
  private sessions = new Map<SessionId, Map<string, PendingCommand>>();
  private pollWaiters = new Map<SessionId, () => void>();

  enqueue(
    sessionId: SessionId,
    command: Command,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.expire(sessionId, command.id),
        timeoutMs,
      );

      const pending: PendingCommand = {
        ...command,
        dispatched: false,
        resolve,
        reject,
        timer,
      };

      this.getOrCreateSession(sessionId).set(command.id, pending);

      // Wake up any long-polling waiter for this session
      const waiter = this.pollWaiters.get(sessionId);
      if (waiter) {
        this.pollWaiters.delete(sessionId);
        waiter();
      }
    });
  }

  async longPoll(sessionId: SessionId): Promise<Command[]> {
    if (this.hasUndispatched(sessionId)) {
      await new Promise((r) => setTimeout(r, POLL_BATCH_WAIT_MS));
    } else {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          this.pollWaiters.delete(sessionId);
          resolve();
        }, LONG_POLL_TIMEOUT_MS);

        const prev = this.pollWaiters.get(sessionId);
        if (prev) prev();

        this.pollWaiters.set(sessionId, () => {
          clearTimeout(timer);
          resolve();
        });
      });

      if (this.hasUndispatched(sessionId)) {
        await new Promise((r) => setTimeout(r, POLL_BATCH_WAIT_MS));
      }
    }

    return this.poll(sessionId);
  }

  private hasUndispatched(sessionId: SessionId): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    for (const cmd of session.values()) {
      if (!cmd.dispatched) return true;
    }
    return false;
  }

  poll(sessionId: SessionId): Command[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const undispatched: Command[] = [];

    for (const cmd of session.values()) {
      if (cmd.dispatched) continue;
      cmd.dispatched = true;
      undispatched.push(stripInternal(cmd));
    }

    return undispatched;
  }

  resolve(sessionId: SessionId, commandId: string, data: unknown): boolean {
    const cmd = this.sessions.get(sessionId)?.get(commandId);
    if (!cmd) return false;

    clearTimeout(cmd.timer);
    this.remove(sessionId, commandId);
    cmd.resolve(data);

    return true;
  }

  private expire(sessionId: SessionId, commandId: string): void {
    const cmd = this.sessions.get(sessionId)?.get(commandId);
    if (!cmd) return;

    this.remove(sessionId, commandId);
    cmd.reject(new CommandTimeoutError(commandId, sessionId));
  }

  private remove(sessionId: SessionId, commandId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.delete(commandId);
    if (session.size === 0) this.sessions.delete(sessionId);
  }

  private getOrCreateSession(
    sessionId: SessionId,
  ): Map<string, PendingCommand> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;

    const session = new Map<string, PendingCommand>();
    this.sessions.set(sessionId, session);
    return session;
  }
}

function stripInternal({ id, type, payload }: PendingCommand): Command {
  return { id, type, payload };
}

export const commandQueue = new CommandQueue();
