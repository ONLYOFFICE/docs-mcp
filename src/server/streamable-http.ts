import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { CorsOptions } from "cors";
import type { Request, Response } from "express";
import { CONFIG } from "../config.js";

const LOCALHOST_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

type StreamableHTTPServerOptions = {
  host: string;
  port: number;
};

function normalizeOrigin(origin: string): string {
  return new URL(origin).origin;
}

function createCorsOptions(): CorsOptions {
  const allowAllOrigins = CONFIG.CORS_ALLOWED_ORIGINS.includes("*");
  const allowedOrigins = new Set(
    CONFIG.CORS_ALLOWED_ORIGINS
      .filter((origin) => origin !== "*")
      .map((origin) => normalizeOrigin(origin)),
  );

  return {
    origin(origin, callback) {
      if (!origin || allowAllOrigins || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
  };
}

export async function startStreamableHTTPServer(
  createServer: () => McpServer,
  options: StreamableHTTPServerOptions,
): Promise<void> {
  const allowedHosts = [...new Set([...LOCALHOST_ALLOWED_HOSTS, options.host, ...CONFIG.HTTP_ALLOWED_HOSTS])];
  const app = createMcpExpressApp({ host: options.host, allowedHosts });
  app.use(cors(createCorsOptions()));

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
    console.log(`MCP server listening on http://${options.host}:${options.port}/mcp`);
  });

  const shutdown = () => {
    console.error("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
