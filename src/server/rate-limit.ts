import type { Request, RequestHandler, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  maxInFlight: number;
};

type ClientState = {
  timestamps: number[];
  inFlight: number;
};

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sendRateLimitError(res: Response, message: string): void {
  res.status(429).json({
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null,
  });
}

export function createRateLimitMiddleware(options: RateLimitOptions): RequestHandler {
  const clients = new Map<string, ClientState>();

  return (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();
    const state = clients.get(key) ?? { timestamps: [], inFlight: 0 };
    state.timestamps = state.timestamps.filter((timestamp) => now - timestamp < options.windowMs);

    if (state.inFlight >= options.maxInFlight) {
      clients.set(key, state);
      sendRateLimitError(res, "Too many in-flight requests");
      return;
    }

    if (state.timestamps.length >= options.maxRequests) {
      clients.set(key, state);
      sendRateLimitError(res, "Rate limit exceeded");
      return;
    }

    state.timestamps.push(now);
    state.inFlight += 1;
    clients.set(key, state);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
      if (state.inFlight === 0 && state.timestamps.length === 0) {
        clients.delete(key);
      }
    };

    res.on("finish", release);
    res.on("close", release);

    next();
  };
}
