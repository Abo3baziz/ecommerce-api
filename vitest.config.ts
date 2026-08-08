import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.integration.test.ts",
      "tests/e2e/**/*.api.test.ts",
    ],
    setupFiles: ["tests/setup/env.setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Integration/e2e tests share the Postgres schema (user decision), so
    // never run multiple test files against the database at the same time.
    fileParallelism: false,
  },
});
