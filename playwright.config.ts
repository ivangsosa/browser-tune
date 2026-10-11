import { defineConfig } from "@playwright/test";

// e2e en Chromium con la extensión real cargada desde dist/chrome.
// Requiere `npm run build:chrome` previo. Un worker: comparten un navegador por archivo.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  outputDir: "test-results"
});
