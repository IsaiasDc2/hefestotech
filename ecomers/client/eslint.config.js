import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "public", "coverage", "test-results", "playwright-report"]),
  {
    files: ["**/*.{js,jsx,mjs}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: ["*.config.js", "scripts/**", "e2e/**", "**/*.test.{js,jsx,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]);
