import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker
} from "@playwright/test";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const EXT = resolve(import.meta.dirname, "../../dist/chrome");
const SHOTS = resolve(import.meta.dirname, "../../store-assets");

// 1x1 GIF: si carga -> onload; si DNR lo bloquea -> onerror.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

let server: Server;
let port: number;
let context: BrowserContext;
let worker: Worker;
let extId: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url?.startsWith("/pixel")) {
      res.writeHead(200, { "content-type": "image/gif" });
      res.end(GIF);
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><title>t</title><p>hi</p>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;

  context = await chromium.launchPersistentContext(
    mkdtempSync(resolve(tmpdir(), "bt-e2e-")),
    {
      channel: "chromium",
      headless: true,
      locale: "en-US",
      env: { ...process.env, LANGUAGE: "en_US:en", LC_ALL: "en_US.UTF-8", LANG: "en_US.UTF-8" } as Record<string, string>,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
    }
  );
  worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  extId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context.close();
  server.close();
});

/** Mensaje al background desde una página de la extensión (igual que la UI real). */
// Respuestas del background con forma dinámica según el mensaje: se tipan laxas a propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reply = any;

async function send(page: Page, msg: object): Promise<Reply> {
  return page.evaluate((m) => chrome.runtime.sendMessage(m), msg);
}

async function extPage(file: "popup" | "options"): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/${file}.html`);
  return page;
}

/** ¿Carga el pixel de localhost desde una página en 127.0.0.1? (false = bloqueado) */
async function pixelLoads(): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    return await page.evaluate(
      (p) =>
        new Promise<boolean>((done) => {
          const img = new Image();
          img.onload = () => done(true);
          img.onerror = () => done(false);
          img.src = `http://localhost:${p}/pixel?${Math.random()}`;
        }),
      port
    );
  } finally {
    await page.close();
  }
}

async function settingsWith(
  page: Page,
  blocking: Record<string, unknown>
): Promise<Reply> {
  const { settings } = await send(page, { type: "getState" });
  return send(page, {
    type: "saveSettings",
    settings: { ...settings, blocking: { ...settings.blocking, ...blocking } }
  });
}

test.describe.configure({ mode: "serial" });

test("la extensión carga y el popup refleja el estado real", async () => {
  const popup = await extPage("popup");
  const state = await send(popup, { type: "getState" });
  expect(state.capabilities.dnr).toBe(true);
  expect(state.capabilities.tabDiscard).toBe(true);
  expect(state.derivedProfile).toBe("balanced");
  await expect(popup.locator("#status")).toContainText("0");
  await expect(popup.locator("h1")).toHaveText("browser-tune");
  await popup.close();
});

test("bloquea un dominio de usuario y deja de hacerlo al quitarlo (reversible)", async () => {
  const page = await extPage("options");
  expect(await pixelLoads()).toBe(true);

  const res = await settingsWith(page, { blockedDomains: ["localhost"] });
  expect(res.ok).toBe(true);
  expect(res.summary.rulesAdded).toBe(1);
  expect(await pixelLoads()).toBe(false);

  await settingsWith(page, { blockedDomains: [] });
  expect(await pixelLoads()).toBe(true);
  await page.close();
});

test("aplicar dos veces es idempotente", async () => {
  const page = await extPage("options");
  await settingsWith(page, { blockedDomains: ["localhost"] });
  const again = await send(page, { type: "reapply" });
  expect(again.ok).toBe(true);
  expect(again.summary.rulesAdded).toBe(0);
  expect(again.summary.rulesRemoved).toBe(0);
  await settingsWith(page, { blockedDomains: [] });
  await page.close();
});

test("las exclusiones ganan al bloqueo", async () => {
  const page = await extPage("options");
  await settingsWith(page, {
    blockedDomains: ["localhost"],
    excludedDomains: ["localhost"]
  });
  expect(await pixelLoads()).toBe(true);
  await settingsWith(page, { blockedDomains: [], excludedDomains: [] });
  await page.close();
});

test("tipos de recurso: solo bloquea los elegidos", async () => {
  const page = await extPage("options");
  await settingsWith(page, {
    blockedDomains: ["localhost"],
    resourceTypes: ["script"]
  });
  expect(await pixelLoads()).toBe(true);
  await settingsWith(page, { resourceTypes: ["image"] });
  expect(await pixelLoads()).toBe(false);
  await settingsWith(page, { blockedDomains: [], resourceTypes: [] });
  await page.close();
});

test("pausa por sitio permite lo bloqueado y se revierte al reanudar", async () => {
  const page = await extPage("options");
  await settingsWith(page, { blockedDomains: ["localhost"] });
  expect(await pixelLoads()).toBe(false);

  expect((await send(page, { type: "pauseSite", domain: "127.0.0.1", minutes: 5 })).ok).toBe(true);
  const paused = await send(page, { type: "getState" });
  expect(paused.pauses).toHaveLength(1);
  expect(await pixelLoads()).toBe(true);

  await send(page, { type: "resumeSite", domain: "127.0.0.1" });
  expect((await send(page, { type: "getState" })).pauses).toHaveLength(0);
  expect(await pixelLoads()).toBe(false);

  await settingsWith(page, { blockedDomains: [] });
  await page.close();
});

test("registra actividad en el historial y permite borrarla", async () => {
  const page = await extPage("options");
  await send(page, { type: "pauseSite", domain: "example.com", minutes: 15 });
  await send(page, { type: "resumeSite", domain: "example.com" });
  let state = await send(page, { type: "getState" });
  expect(state.activityLog.map((e: { kind: string }) => e.kind)).toEqual(
    expect.arrayContaining(["pause", "resume"])
  );
  await send(page, { type: "clearActivity" });
  state = await send(page, { type: "getState" });
  expect(state.activityLog).toEqual([]);
  await page.close();
});

test("'excluir este sitio' agrega el dominio a las exclusiones", async () => {
  const page = await extPage("options");
  const res = await send(page, {
    type: "excludeSite",
    scope: "blocking",
    domain: "https://Example.org/path"
  });
  expect(res.ok).toBe(true);
  expect(res.settings.blocking.excludedDomains).toContain("example.org");
  expect(res.settings.profile).toBe("custom");
  const bad = await send(page, { type: "excludeSite", scope: "blocking", domain: "no es dominio" });
  expect(bad.ok).toBe(false);
  await send(page, { type: "setProfile", profile: "balanced" });
  await page.close();
});

test("descarte manual: las pestañas protegidas nunca se descartan", async () => {
  const page = await extPage("options");
  const pinned = await context.newPage();
  await pinned.goto(`http://127.0.0.1:${port}/pinned`);
  await page.evaluate(async (p) => {
    const [tab] = await chrome.tabs.query({ url: `http://127.0.0.1:${p}/pinned` });
    await chrome.tabs.update(tab!.id!, { pinned: true });
  }, port);
  const active = await context.newPage();
  await active.goto(`http://127.0.0.1:${port}/active`);
  await active.bringToFront();

  // Solo hay pestañas protegidas: fijada, activa y páginas internas/de extensión.
  const res = await send(page, { type: "discardNow" });
  expect(res.ok).toBe(true);
  expect(res.discarded).toBe(0);
  expect((await send(page, { type: "getState" })).discardedTabs).toBe(0);
  await page.close();
  await pinned.close();
  await active.close();
});

// Chromium (153) bajo CDP/Playwright se cae ~1 s después de tabs.discard, incluso con
// una llamada directa sin código de la extensión. Se deja opt-in: BT_DISCARD=1.
test("descarte manual descarta pestañas elegibles y recargan al seleccionarlas", async () => {
  test.skip(!process.env.BT_DISCARD, "crash conocido de Chromium+CDP; definir BT_DISCARD=1");
  const page = await extPage("options");
  const a = await context.newPage();
  await a.goto(`http://127.0.0.1:${port}/a`);
  const active = await context.newPage();
  await active.goto(`http://127.0.0.1:${port}/active`);
  await active.bringToFront();

  const res = await send(page, { type: "discardNow" });
  expect(res.discarded).toBeGreaterThanOrEqual(1);
  expect((await send(page, { type: "getState" })).discardedTabs).toBeGreaterThanOrEqual(1);
  await a.bringToFront();
  await expect(a.locator("p")).toHaveText("hi");
  await page.close();
  await a.close();
  await active.close();
});

test("sobrevive al reinicio del service worker (estado reconstruido desde storage)", async () => {
  const page = await extPage("options");
  await settingsWith(page, { blockedDomains: ["localhost"] });
  const before = await send(page, { type: "getState" });

  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  await cdp.send("ServiceWorker.stopAllWorkers");
  await page.waitForTimeout(500);

  const after = await send(page, { type: "getState" });
  expect(after.settings).toEqual(before.settings);
  expect(after.managedRuleCount).toBe(before.managedRuleCount);
  expect(await pixelLoads()).toBe(false);
  await settingsWith(page, { blockedDomains: [] });
  await page.close();
});

test("importar JSON inválido se rechaza sin tocar el estado", async () => {
  const page = await extPage("options");
  const before = await send(page, { type: "getState" });
  const bad = await send(page, { type: "importSettings", json: "{ not json" });
  expect(bad.ok).toBe(false);
  const bad2 = await send(page, { type: "importSettings", json: '{"schemaVersion":99}' });
  expect(bad2.ok).toBe(false);
  expect((await send(page, { type: "getState" })).settings).toEqual(before.settings);
  await page.close();
});

test("opciones: validación visible, cambios sin guardar y guardado", async () => {
  const page = await extPage("options");
  await page.fill("#blocked-domains", "ads.example\nnot a domain\n");
  await expect(page.locator("#blocked-info")).toContainText("1");
  await expect(page.locator("#blocked-info")).toContainText("not a domain");
  await page.locator("#blocked-domains").dispatchEvent("input");
  await expect(page.locator("#unsaved")).toBeVisible();
  await page.click("#save");
  await expect(page.locator("#unsaved")).toBeHidden();
  await expect(page.locator("#status")).toContainText("Applied");
  expect((await send(page, { type: "getState" })).settings.blocking.blockedDomains).toEqual(["ads.example"]);
  await settingsWith(page, { blockedDomains: [] });
  await page.close();
});

test("idioma: sigue al navegador y se puede forzar manualmente", async () => {
  const page = await extPage("popup");
  await expect(page.locator("[data-i18n=profileLabel]")).toHaveText("Profile");

  for (const [lang, word] of [["es", "Perfil"], ["pt", "Perfil"], ["fr", "Profil"], ["de", "Profil"]] as const) {
    await page.evaluate((l) => chrome.storage.local.set({ uiLanguage: l }), lang);
    await page.reload();
    await expect(page.locator("[data-i18n=profileLabel]")).toHaveText(word);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
  }
  await page.evaluate(() => chrome.storage.local.set({ uiLanguage: "auto" }));
  await page.reload();
  await expect(page.locator("[data-i18n=profileLabel]")).toHaveText("Profile");
  await page.close();
});

test("consejo 'solo Brave' no aparece en Chromium que no es Brave", async () => {
  const page = await extPage("options");
  const tips = await page.locator("#browser-tips li").allTextContents();
  expect(tips.length).toBeGreaterThanOrEqual(2);
  expect(tips.some((t) => t.includes("Brave only"))).toBe(false);
  await page.close();
});

test("errores de la API se muestran con opción de reintentar", async () => {
  const page = await extPage("options");
  await page.evaluate(() => chrome.storage.session.set({ lastError: "Rule count exceeded" }));
  await page.reload();
  await expect(page.locator("#error-box")).toBeVisible();
  await expect(page.locator("#error-text")).toContainText("Rule count exceeded");
  await page.click("#retry");
  await expect(page.locator("#error-box")).toBeHidden();
  await page.close();
});

test("capturas para las stores (solo con SCREENSHOTS=1)", async () => {
  test.skip(!process.env.SCREENSHOTS, "definir SCREENSHOTS=1 para generarlas");
  mkdirSync(SHOTS, { recursive: true });
  for (const scheme of ["light", "dark"] as const) {
    const options = await extPage("options");
    await options.setViewportSize({ width: 1280, height: 800 });
    await options.emulateMedia({ colorScheme: scheme });
    await options.screenshot({ path: resolve(SHOTS, `options-${scheme}.png`), fullPage: true });
    await options.close();

    const site = await context.newPage();
    await site.goto(`http://127.0.0.1:${port}/`);
    const popup = await extPage("popup");
    await popup.setViewportSize({ width: 320, height: 330 });
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.screenshot({ path: resolve(SHOTS, `popup-${scheme}.png`) });
    await popup.close();
    await site.close();
  }
});
