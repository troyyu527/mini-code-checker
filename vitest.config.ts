// Vitest config: tests live in tests/ and run in Node.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      // the Workers runtime module does not exist in Node; tests use a small stand-in
      "cloudflare:workers": fileURLToPath(new URL("./tests/fakes/cloudflareWorkers.ts", import.meta.url)),
    },
  },
  test: {
    dir: "tests",
    // list every source file, also the ones no test imports (those show 0 %)
    coverage: { include: ["client/**/*.{ts,tsx}", "server/**/*.ts", "shared/**/*.ts"] },
  },
});