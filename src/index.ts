
import { CONFIG } from "./config.js";
import { startStreamableHTTPServer } from "./server/streamable-http.js";
import { startStdioServer } from "./server/stdio.js";
import { createServer } from "./server/index.js";

async function main() {
  if (CONFIG.TRANSPORT === "stdio") {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
