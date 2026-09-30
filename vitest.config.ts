import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/**/*.test.{ts,tsx}",
      "packages/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
  },
});
