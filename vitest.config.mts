import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // `server-only` throws outside the react-server condition; tests run on plain Node.
      "server-only": path.join(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
