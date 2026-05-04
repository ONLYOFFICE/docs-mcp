import type { TransportMode } from "./runtime.js";

type CliOptions = {
  transport: TransportMode;
};

export function parseCliOptions(argv: string[]): CliOptions {
  const hasHttp = argv.includes("--http");
  const hasStdio = argv.includes("--stdio");

  if (hasHttp && hasStdio) {
    throw new Error("Use either --http or --stdio, not both.");
  }

  return {
    transport: hasStdio ? "stdio" : "http",
  };
}
