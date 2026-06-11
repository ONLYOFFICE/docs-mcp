import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { CorsOptions } from "cors";
import type { Request, Response } from "express";
import { CONFIG } from "../config.js";
import {
  createHttpRateLimitMiddleware,
  createInFlightLimitMiddleware,
} from "./rate-limit.js";

type StreamableHTTPServerOptions = {
  host: string;
  port: number;
};

type HealthCheckResult = {
  status: "ok";
  timestamp: string;
};

function createCorsOptions(): CorsOptions {
  if (CONFIG.HTTP_CORS_ALLOWED_ORIGINS.length === 0) {
    return {
      origin: false,
    };
  }

  if (CONFIG.HTTP_CORS_ALLOWED_ORIGINS.includes("*")) {
    return {
      origin: "*",
    };
  }

  return {
    origin: [...new Set(CONFIG.HTTP_CORS_ALLOWED_ORIGINS)],
  };
}

function handleHealthCheck(_req: Request, res: Response): void {
  const result: HealthCheckResult = {
    status: "ok",
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(result);
}

export async function startStreamableHTTPServer(
  createServer: () => McpServer,
  options: StreamableHTTPServerOptions,
): Promise<void> {
  const app = createMcpExpressApp({
    host: options.host,
    allowedHosts:
      CONFIG.HTTP_ALLOWED_HOSTS.length > 0
        ? [...new Set(CONFIG.HTTP_ALLOWED_HOSTS)]
        : undefined,
  });
  app.set("trust proxy", CONFIG.HTTP_TRUST_PROXY);
  app.use(cors(createCorsOptions()));
  app.get("/health", handleHealthCheck);
  app.use(
    createHttpRateLimitMiddleware({
      windowMs: CONFIG.HTTP_RATE_LIMIT_WINDOW_MS,
      maxRequests: CONFIG.HTTP_RATE_LIMIT_MAX_REQUESTS,
    }),
  );
  app.use(
    createInFlightLimitMiddleware({
      maxRequests: CONFIG.HTTP_RATE_LIMIT_MAX_IN_FLIGHT,
    }),
  );

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(options.port, options.host, (err) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log(
      `MCP server listening on http://${options.host}:${options.port}/mcp`,
    );
  });

  const shutdown = () => {
    console.error("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
