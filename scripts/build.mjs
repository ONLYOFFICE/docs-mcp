#!/usr/bin/env node
import { execSync } from "child_process";
import { cpSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd, env = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

rmSync(join(root, "dist"), { recursive: true, force: true });

// 1. Type-check
run("tsc --noEmit");

// 2. Vite build (singlefile HTML for editor UI)
run("cross-env INPUT=src/ext-apps/editor/index.html vite build");

// 3. Copy assets
cpSync(join(root, "assets"), join(root, "dist", "assets"), { recursive: true });

// 4. Bundle server with bun
run(
  'bun build "src/index.ts" --outfile "dist/index.js" --target node --banner "#!/usr/bin/env node"',
);
