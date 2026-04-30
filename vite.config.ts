import { createLogger, defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

const prefixedLogger = createLogger();
for (const level of ["info", "warn", "error"] as const) {
  const fn = prefixedLogger[level];
  prefixedLogger[level] = (msg, opts) => fn(msg.replace(/^/mg, "[vite] "), opts);
}

export default defineConfig({
  customLogger: prefixedLogger,
  plugins: [
    viteSingleFile(),
    {
      name: "ext-apps-output-dir",
      enforce: "post",
      generateBundle(_, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type === "asset") {
            asset.fileName = asset.fileName.replace(
              /^src\/ext-apps\//,
              "ext-apps/",
            );
          }
        }
      },
    },
  ],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,

    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
