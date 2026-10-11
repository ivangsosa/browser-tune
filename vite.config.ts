import { defineConfig } from "vite";

// Base compartida para los builds por entrada. El empaquetado real por
// navegador lo orquesta scripts/build.mjs (una llamada de Vite por entry,
// formato iife para que sirva tanto en service worker como en event page).
export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: false,
    minify: true
  },
  resolve: {
    extensions: [".ts", ".js"]
  }
});
