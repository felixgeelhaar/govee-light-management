import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    exclude: ["test/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Measure every source file, not just the ones a test imported.
      // Without these two the number counted only imported files and read
      // 64.56% while the real figure was 34.75% — flattering precisely the
      // files with no tests at all (every action class is at 0%).
      all: true,
      include: ["src/**/*.ts"],
      // A floor at today's real coverage, to ratchet upward. Raise it with
      // each batch of new tests; never lower it to make a change fit.
      thresholds: {
        statements: 34,
        branches: 28,
        functions: 53,
        lines: 34,
      },
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "test/**",
        "coverage/**",
      ],
    },
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@shared": path.resolve(import.meta.dirname, "./src/shared"),
    },
  },
});
