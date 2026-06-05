#!/usr/bin/env node
import { execSync } from "child_process";
import { existsSync, readdirSync, rmSync } from "fs";
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

function findExtApps() {
  const extAppsDir = join(root, "src", "ext-apps");
  if (!existsSync(extAppsDir)) {
    return [];
  }

  return readdirSync(extAppsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      input: `src/ext-apps/${entry.name}/index.html`,
    }))
    .filter((app) => existsSync(join(root, app.input)));
}

rmSync(join(root, "dist"), { recursive: true, force: true });

// 1. Type-check
run("tsc --noEmit");

// 2. Vite build (singlefile HTML for external apps)
for (const app of findExtApps()) {
  console.log(`Building external app: ${app.name}`);
  run("cross-env vite build", { INPUT: app.input });
}

// 3. Bundle server with bun
run(
  'bun build "src/index.ts" --outfile "dist/index.js" --target node --banner "#!/usr/bin/env node"',
);
