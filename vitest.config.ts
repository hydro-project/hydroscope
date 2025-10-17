import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
        minForks: 1,
        isolate: true,
        // Force fork processes to exit cleanly
        execArgv: [],
      },
    },
    // Limit file parallelism to prevent too many processes
    fileParallelism: true,
    maxConcurrency: 4,
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/performance/**"],
    onConsoleLog(_log, _type) {
      if (process.env.ENABLE_TEST_LOGS === "true") {
        return;
      }
      return false;
    },

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/dist/**", "**/*.config.*"],
    },
    watch: false,
    // Force processes to exit after tests complete
    teardownTimeout: 5000,
    hookTimeout: 10000,
    testTimeout: 30000,
    // Allow running individual tests with better output
    reporters: process.env.CI ? "default" : "verbose",
    // Ensure child processes are killed when parent exits
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/core": path.resolve(__dirname, "./src/core"),
      "@/bridges": path.resolve(__dirname, "./src/bridges"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/utils": path.resolve(__dirname, "./src/utils"),
    },
  },
});
