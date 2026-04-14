import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { CONFIG } from "../config.js";
import type { McpResource } from "./resource.js";

export const EDITOR_APP_RESOURCE_URI = "ui://editor/index.html";
const DIST_DIR = path.join(import.meta.dirname, "../../dist");
export const EDITOR_APP_PATH = path.join(DIST_DIR, "src", "ui", "editor", "index.html");

export const editorResource: McpResource = {
  register(server: McpServer): void {
    registerAppResource(
      server,
      "ONLYOFFICE Editor",
      EDITOR_APP_RESOURCE_URI,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        const html = await fs.readFile(EDITOR_APP_PATH, "utf-8");

        return {
          contents: [
            {
              uri: EDITOR_APP_RESOURCE_URI,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
              _meta: {
                ui: {
                  prefersBorder: true,
                  csp: {
                    resourceDomains: [CONFIG.DOCUMENT_SERVER_BASE_URL],
                    frameDomains: [CONFIG.DOCUMENT_SERVER_BASE_URL],
                  },
                },
              },
            },
          ],
        };
      }
    );
  },
};
