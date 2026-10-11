import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ["tests/**"],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    ignores: ["dist", "node_modules", "web-ext-artifacts", "test-results", "playwright-report"]
  }
);
