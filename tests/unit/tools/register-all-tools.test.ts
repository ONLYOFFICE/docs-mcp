import { describe, expect, test } from "bun:test";

process.env.DOCUMENT_SERVER_BASE_URL = "http://document-server.example";
process.env.DOCUMENT_SERVER_JWT_SECRET = "test-secret";

describe("registerAllTools", () => {
  test("registers every MCP tool definition", async () => {
    const { registerAllTools } = await import("../../../src/tools/index.ts");
    const registrations: unknown[] = [];
    const server = {
      registerTool: (...args: unknown[]) => {
        registrations.push(args);
      },
    };

    registerAllTools(server as never);

    expect(registrations.map(([name]) => name)).toEqual([
      "create_file",
      "open_file",
      "save_file",
      "poll_editor_commands",
      "set_editor_command_result",
      "read_file_content",
    ]);
    for (const registration of registrations) {
      expect(registration).toEqual([
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      ]);
    }
  });
});
