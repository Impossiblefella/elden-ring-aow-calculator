/**
 * build-server.mjs — Bundle the server with esbuild into a single CJS file.
 *
 * This avoids the ESM .js extension issues and lets the Electron app run
 * the server with plain `node bundle.js`.
 */
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

await esbuild.build({
  entryPoints: [path.join(root, "packages", "server", "src", "index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: path.join(root, "electron", "server-bundle.cjs"),
  external: [
    "express",
    "cors",
    "morgan",
    "fs",
    "path",
    "http",
    "url",
  ],
  loader: { ".json": "json" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

console.log("Server bundled to electron/server-bundle.cjs");
