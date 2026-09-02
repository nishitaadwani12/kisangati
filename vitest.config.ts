import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tst/**/*.test.ts"],
    globalSetup: ["tst/setup/globalSetup.ts"],
    setupFiles: ["tst/setup/each.ts"],
    fileParallelism: false, // tests share one SQLite test DB; run serially
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret",
      OTP_DEV_ECHO: "1",
      CORS_ORIGINS: "",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Bootstrap-only / not unit-testable entrypoints:
      exclude: ["src/index.ts"],
      reporter: ["text", "html"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
