import type { Request, RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";

type HttpRateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

type InFlightLimitOptions = {
  maxRequests: number;
};

type ClientState = {
  inFlight: number;
};

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sendRateLimitError(res: Response, message: string): void {
  res.status(429).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

export function createHttpRateLimitMiddleware(
  options: HttpRateLimitOptions,
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Too many requests, please try again later.",
      },
      id: null,
    },
  });
}

export function createInFlightLimitMiddleware(
  options: InFlightLimitOptions,
): RequestHandler {
  const clients = new Map<string, ClientState>();

  return (req, res, next) => {
    const key = getClientKey(req);
    const state = clients.get(key) ?? { inFlight: 0 };

    if (state.inFlight >= options.maxRequests) {
      clients.set(key, state);
      sendRateLimitError(res, "Too many in-flight requests");
      return;
    }

    state.inFlight += 1;
    clients.set(key, state);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
      if (state.inFlight === 0) {
        clients.delete(key);
      }
    };

    res.on("finish", release);
    res.on("close", release);

    next();
  };
}
