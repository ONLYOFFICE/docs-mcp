import { createServer } from "./server.js";
import { startStreamableHTTPServer } from "./src/server/http.js";
import { startStdioServer } from "./src/server/stdio.js";

async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
