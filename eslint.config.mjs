import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended,
  {
    files: [
      "apps/web/src/**/*.{ts,tsx}",
      "packages/*/src/**/*.ts",
      "tests/**/*.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "error" },
  },
  {
    files: ["packages/*/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "File",
        "Blob",
        "navigator",
      ],
    },
  },
);
