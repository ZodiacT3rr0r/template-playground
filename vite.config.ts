import { defineConfig as defineViteConfig, mergeConfig } from "vite";
import { defineConfig as defineVitestConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import nodePolyfills from "vite-plugin-node-stdlib-browser";
import { createRequire } from "module";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

const require = createRequire(import.meta.url);
const nodeStdlibEntryPath = require.resolve("node-stdlib-browser");
const nodeStdlibCjsDir = path.dirname(nodeStdlibEntryPath);
const nodeStdlibRoot = path.dirname(nodeStdlibCjsDir);
const nodeEmptyCjsPath = path.join(nodeStdlibCjsDir, "mock", "empty.js");
const nodeEmptyEsmPath = path.join(nodeStdlibRoot, "esm", "mock", "empty.js");
const nodeEmptyPathPattern = /node-stdlib-browser[\\/](cjs|esm)[\\/]mock[\\/]empty\.js$/;
// https://vitejs.dev/config/
const viteConfig = defineViteConfig({
  plugins: [nodePolyfills(), react(), visualizer({
    emitFile: true,
    filename: "stats.html",
  })],
  resolve: {
    alias: {
      // Prevent zlib from being replaced with an empty shim in optimized deps.
      zlib: "browserify-zlib",
      util: "/src/polyfills/util.cjs",
      "node:util": "/src/polyfills/util.cjs",
      // cicero-core references fs.readdir/fs.stat in code paths guarded by feature checks.
      // In-browser we need an object-shaped fs module, not a null stub.
      fs: "/src/polyfills/fs.ts",
      "node:fs": "/src/polyfills/fs.ts",
      "fs/promises": "/src/polyfills/fs.ts",
      "node:fs/promises": "/src/polyfills/fs.ts",
      // node-stdlib-browser uses this empty shim for several core modules, including fs.
      // Its default export is null by default, which crashes on property checks like fs.readdir.
      "node-stdlib-browser/mock/empty.js": "/src/polyfills/node-empty.ts",
      "node-stdlib-browser/esm/mock/empty.js": "/src/polyfills/node-empty.ts",
      "node-stdlib-browser/cjs/mock/empty.js": "/src/polyfills/node-empty.ts",
      [nodeEmptyEsmPath]: "/src/polyfills/node-empty.ts",
      [nodeEmptyCjsPath]: "/src/polyfills/node-empty.ts",
    },
  },
  optimizeDeps: {
    include: ["immer", "zlib", "browserify-zlib"],
    needsInterop: ['@accordproject/template-engine'],
    esbuildOptions: {
      plugins: [
        {
          name: "node-empty-object-shim",
          setup(build) {
            // node-stdlib-browser's default empty shim exports null.
            // Some runtime checks in cicero-core access fs.readdir directly,
            // so we force this module to export an object-shaped stub.
            build.onLoad({ filter: nodeEmptyPathPattern }, () => ({
              contents: "module.exports = {};",
              loader: "js",
            }));
          },
        },
      ],
    },
  },
});


// https://vitest.dev/config/
const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/utils/testing/setup.ts",
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    server: {
      deps: {
        inline: ["monaco-editor"],
      },
    },
  },
  resolve: {
    alias: process.env.VITEST ? {
      "monaco-editor": "monaco-editor/esm/vs/editor/editor.api",
    } : {},
  },
});

export default mergeConfig(viteConfig, vitestConfig);
