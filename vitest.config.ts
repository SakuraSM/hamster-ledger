import { defineConfig } from "vitest/config";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    setupFiles: ["tests/helpers/dom-setup.ts"],
    include: [
      "tests/**/*.test.{ts,tsx}",
      "packages/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
  },
});
