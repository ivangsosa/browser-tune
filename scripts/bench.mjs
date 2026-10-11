/**
 * Benchmark local reproducible: mide requests que llegan a la red y tiempo de
 * carga, con y sin bloqueo. NO mide RAM (ver docs/benchmarks.md para eso).
 *
 * Uso: npm run bench
 * Escenario: una página con 40 recursos de tercero (localhost:<port>) + 8 propios.
 * Con blocking sobre "localhost", los 40 nunca tocan la red.
 * Salida: benchmarks/results/<fecha>.json + resumen por consola.
 */
/* global chrome */
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DIST = new URL("../dist/chrome", import.meta.url).pathname;
const THIRD_PARTY = 40;
const FIRST_PARTY = 8;

const hitCounts = new Map();
const server = http.createServer((req, res) => {
  const path = req.url ?? "/";
  hitCounts.set(path.split("?")[0], (hitCounts.get(path.split("?")[0]) ?? 0) + 1);
  if (path === "/page") {
    const imgs = Array.from({ length: THIRD_PARTY }, (_, i) => `<img src="http://localhost:${PORT}/t${i}.png">`).join("");
    const own = Array.from({ length: FIRST_PARTY }, (_, i) => `<img src="/o${i}.png">`).join("");
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><title>bench</title><h1>bench</h1>${imgs}${own}`);
    return;
  }
  res.writeHead(200, { "content-type": "image/png" });
  res.end(Buffer.from("89504e47", "hex"));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

let browser = null;

try {
  const { chromium } = await import("@playwright/test");
  const ctx = await chromium.launchPersistentContext(
    join(tmpdir(), `bt-bench-${Date.now()}`),
    {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`
      ]
    }
  );
  browser = ctx;
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  const extId = new URL(sw.url()).host;
  const ui = await ctx.newPage();
  await ui.goto(`chrome-extension://${extId}/options.html`);
  const send = (msg) => ui.evaluate((m) => chrome.runtime.sendMessage(m), msg);

  const applyBlocking = async (blockedDomains) => {
    const res = await send({
      type: "saveSettings",
      settings: {
        schemaVersion: 1,
        profile: "custom",
        blocking: {
          enabled: true,
          enabledRulesets: [],
          blockedDomains,
          excludedDomains: [],
          resourceTypes: ["image", "script", "stylesheet", "font", "media", "xmlhttprequest", "other"]
        },
        tabDiscard: { enabled: false, inactiveMinutes: 15, excludedDomains: [] }
      }
    });
    if (!res.ok) throw new Error(res.error);
  };

  const measure = async () => {
    hitCounts.clear();
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${PORT}/page`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const loadMs = Date.now() - t0;
    const thirdParty = [...hitCounts.keys()].filter((k) => k.startsWith("/t")).length;
    await page.close();
    return { loadMs, thirdPartyHits: thirdParty };
  };

  await applyBlocking([]);
  const baseline = await measure();
  await applyBlocking(["localhost"]);
  const blocked = await measure();
  await applyBlocking([]);

  const results = {
    date: new Date().toISOString(),
    scenario: { thirdParty: THIRD_PARTY, firstParty: FIRST_PARTY },
    baseline,
    withBlocking: blocked,
    blockedRequests: THIRD_PARTY - blocked.thirdPartyHits
  };
  mkdirSync("benchmarks/results", { recursive: true });
  const file = `benchmarks/results/${results.date.replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(results, null, 2));
  console.log("\n=== browser-tune benchmark ===");
  console.log(`Requests a terceros que llegaron a la red:`);
  console.log(`  sin bloqueo:   ${baseline.thirdPartyHits}/${THIRD_PARTY}`);
  console.log(`  con bloqueo:   ${blocked.thirdPartyHits}/${THIRD_PARTY}`);
  console.log(`Tiempo de carga de la página:`);
  console.log(`  sin bloqueo:   ${baseline.loadMs} ms`);
  console.log(`  con bloqueo:   ${blocked.loadMs} ms`);
  console.log(`\nResultados: ${file}`);
  console.log("Nota: mide requests y tiempo de carga, NO memoria. Los números varían entre corridas.");
} finally {
  await browser?.close();
  server.close();
}
