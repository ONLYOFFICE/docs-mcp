import { parseCliOptions } from "./cli.js";
import { startStreamableHTTPServer } from "./server/streamable-http.js";
import { startStdioServer } from "./server/stdio.js";
import { createServer } from "./server/index.js";
import { setTransportMode } from "./runtime.js";

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  setTransportMode(options.transport);

  if (options.transport === "stdio") {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
