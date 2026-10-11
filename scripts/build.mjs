// Build por navegador: genera dist/chrome y dist/firefox.
// Uso: node scripts/build.mjs [chrome|firefox] — sin args compila ambos.
import { build } from "vite";
import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TARGETS = ["chrome", "firefox"];
const requested = process.argv[2];
const targets = requested ? [requested] : TARGETS;

if (!targets.every((t) => TARGETS.includes(t))) {
  console.error(`Target inválido: ${requested}. Usar: ${TARGETS.join("|")}`);
  process.exit(1);
}

// Cada entry sale como iife autocontenido: funciona en service worker (Chrome)
// y en background.scripts / páginas de extensión sin módulos (Firefox).
const JS_ENTRIES = [
  { name: "background", entry: "src/background/index.ts" },
  { name: "popup", entry: "src/ui/popup/popup.ts" },
  { name: "options", entry: "src/ui/options/options.ts" }
];

async function buildTarget(target) {
  const outDir = resolve(ROOT, "dist", target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const { name, entry } of JS_ENTRIES) {
    await build({
      root: ROOT,
      logLevel: "warn",
      build: {
        target: "es2022",
        minify: true,
        outDir,
        emptyOutDir: false,
        lib: { entry: resolve(ROOT, entry), formats: ["iife"], name },
        rollupOptions: {
          output: {
            entryFileNames: `${name}.js`,
            assetFileNames: `${name}.css`
          }
        }
      }
    });
  }

  // Manifiesto del target + assets estáticos + HTML de las páginas.
  await copyFile(
    resolve(ROOT, "manifests", `${target}.json`),
    resolve(outDir, "manifest.json")
  );
  await cp(resolve(ROOT, "rulesets"), resolve(outDir, "rulesets"), { recursive: true });
  await cp(resolve(ROOT, "_locales"), resolve(outDir, "_locales"), { recursive: true });
  await cp(resolve(ROOT, "icons"), resolve(outDir, "icons"), { recursive: true });
  await cp(resolve(ROOT, "src/ui/popup/index.html"), resolve(outDir, "popup.html"));
  await cp(resolve(ROOT, "src/ui/options/index.html"), resolve(outDir, "options.html"));

  console.log(`dist/${target} listo`);
}

for (const t of targets) await buildTarget(t);
