import type { TransportMode } from "./runtime.js";

type CliOptions = {
  transport: TransportMode;
  host: string;
  port: number;
};

function getOptionValue(argv: string[], name: string): string | undefined {
  const equalsPrefix = `${name}=`;
  const equalsValue = argv.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsValue) return equalsValue.slice(equalsPrefix.length);

  const index = argv.indexOf(name);
  if (index === -1) return undefined;

  return argv[index + 1];
}

function parsePort(value: string | undefined): number {
  if (!value) return 3001;

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `--port must be an integer between 1 and 65535, got: ${value}`,
    );
  }

  return port;
}

export function parseCliOptions(argv: string[]): CliOptions {
  const hasHttp = argv.includes("--http");
  const hasStdio = argv.includes("--stdio");

  if (hasHttp && hasStdio) {
    throw new Error("Use either --http or --stdio, not both.");
  }

  return {
    transport: hasStdio ? "stdio" : "http",
    host: getOptionValue(argv, "--host") ?? "127.0.0.1",
    port: parsePort(getOptionValue(argv, "--port")),
  };
}
