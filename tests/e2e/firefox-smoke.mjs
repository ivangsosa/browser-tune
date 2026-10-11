// Smoke e2e en Firefox real vía geckodriver (WebDriver clásico, sin dependencias).
// Requiere: firefox, geckodriver y `npm run build:firefox`. Uso: npm run test:e2e:firefox
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const DIST = resolve(import.meta.dirname, "../../dist/firefox");
// geckodriver instalado vía snap solo ve $HOME (sin dotfiles): se copia el paquete ahí.
const TMP = mkdtempSync(resolve(homedir(), "browser-tune-e2e-"));
const EXT = resolve(TMP, "firefox");
cpSync(DIST, EXT, { recursive: true });
const GECKO_PORT = 4444;
const UUID = "5d0b1c2e-7f1a-4c1e-9a55-1d2e3f4a5b6c";
const ADDON_ID = "browser-tune@browser-tune.dev";
const BASE = `http://127.0.0.1:${GECKO_PORT}`;

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const server = createServer((req, res) => {
  if (req.url?.startsWith("/pixel")) {
    res.writeHead(200, { "content-type": "image/gif" });
    res.end(GIF);
  } else {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<!doctype html><p>hi</p>");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const gecko = spawn("geckodriver", ["--port", String(GECKO_PORT), "--allow-system-access"], { stdio: "ignore" });
const cleanup = async (sid) => {
  if (sid) await call("DELETE", `/session/${sid}`).catch(() => {});
  gecko.kill();
  server.close();
  rmSync(TMP, { recursive: true, force: true });
};

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${json.value?.message ?? res.status}`);
  return json.value;
}

for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(`${BASE}/status`)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

let sid;
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push(["ok", name]);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
  }
};

try {
  const session = await call("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": {
          args: ["-headless"],
          prefs: {
            "extensions.webextensions.uuids": JSON.stringify({ [ADDON_ID]: UUID }),
            "intl.accept_languages": "en-US, en",
            "general.useragent.locale": "en-US"
          }
        }
      }
    }
  });
  sid = session.sessionId;
  await call("POST", `/session/${sid}/moz/addon/install`, { path: EXT, temporary: true });

  const goto = (url) => call("POST", `/session/${sid}/url`, { url });
  const run = (script, args = []) =>
    call("POST", `/session/${sid}/execute/async`, {
      script: `const done = arguments[arguments.length - 1]; (async () => { ${script} })().then(done, e => done({ __error: String(e) }));`,
      args
    }).then((v) => {
      if (v?.__error) throw new Error(v.__error);
      return v;
    });
  const send = (msg) => run("return await chrome.runtime.sendMessage(arguments[0]);", [msg]);
  const pixelLoads = async () => {
    await call("POST", `/session/${sid}/window`, { handle: siteHandle });
    await goto(`http://127.0.0.1:${port}/`);
    return run(
      `return await new Promise((ok) => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false);
        i.src = "http://localhost:" + arguments[0] + "/pixel?" + Math.random(); });`,
      [port]
    );
  };
  // WebDriver no navega a moz-extension://: se abre una pestaña desde el contexto chrome.
  const ctx = (context) => call("POST", `/session/${sid}/moz/context`, { context });
  const handles = () => call("GET", `/session/${sid}/window/handles`);
  const openExtPage = async (file) => {
    const before = new Set(await handles());
    await ctx("chrome");
    await call("POST", `/session/${sid}/execute/sync`, {
      script: `const win = Services.wm.getMostRecentWindow("navigator:browser");
        const tab = win.gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
        win.gBrowser.selectedTab = tab;`,
      args: [`moz-extension://${UUID}/${file}`]
    });
    await ctx("content");
    let fresh;
    for (let i = 0; i < 50 && !fresh; i++) {
      fresh = (await handles()).find((h) => !before.has(h));
      if (!fresh) await new Promise((r) => setTimeout(r, 100));
    }
    if (!fresh) throw new Error("no se abrió la pestaña de la extensión");
    await call("POST", `/session/${sid}/window`, { handle: fresh });
    return fresh;
  };
  const siteHandle = (await handles())[0];
  const options = async () => {
    await call("POST", `/session/${sid}/window`, { handle: siteHandle });
    await openExtPage("options.html");
  };
  const withBlocking = async (blocking) => {
    await options();
    const { settings } = await send({ type: "getState" });
    return send({ type: "saveSettings", settings: { ...settings, blocking: { ...settings.blocking, ...blocking } } });
  };

  await options();
  await check("la extensión carga y reporta capacidades", async () => {
    const s = await send({ type: "getState" });
    assert.equal(s.capabilities.dnr, true);
    assert.equal(s.capabilities.tabDiscard, true);
    assert.equal(s.capabilities.isFirefox, true);
    assert.equal(s.derivedProfile, "balanced");
  });
  await check("UI de opciones renderiza en inglés", async () => {
    await options();
    const title = await run('return document.querySelector("[data-i18n=profileLabel]").textContent;');
    assert.equal(title, "Profile");
  });
  await check("bloquea un dominio de usuario y se revierte", async () => {
    assert.equal(await pixelLoads(), true);
    const res = await withBlocking({ blockedDomains: ["localhost"] });
    assert.equal(res.ok, true, res.error);
    assert.equal(await pixelLoads(), false);
    await withBlocking({ blockedDomains: [] });
    assert.equal(await pixelLoads(), true);
  });
  await check("aplicar dos veces es idempotente", async () => {
    await withBlocking({ blockedDomains: ["localhost"] });
    const again = await send({ type: "reapply" });
    assert.equal(again.ok, true);
    assert.equal(again.summary.rulesAdded, 0);
    await withBlocking({ blockedDomains: [] });
  });
  await check("las exclusiones ganan al bloqueo", async () => {
    await withBlocking({ blockedDomains: ["localhost"], excludedDomains: ["localhost"] });
    assert.equal(await pixelLoads(), true);
    await withBlocking({ blockedDomains: [], excludedDomains: [] });
  });
  await check("tipos de recurso: solo bloquea los elegidos", async () => {
    await withBlocking({ blockedDomains: ["localhost"], resourceTypes: ["script"] });
    assert.equal(await pixelLoads(), true);
    await withBlocking({ resourceTypes: ["image"] });
    assert.equal(await pixelLoads(), false);
    await withBlocking({ blockedDomains: [], resourceTypes: [] });
  });
  await check("pausa por sitio permite lo bloqueado y se revierte", async () => {
    await withBlocking({ blockedDomains: ["localhost"] });
    assert.equal(await pixelLoads(), false);
    await options();
    assert.equal((await send({ type: "pauseSite", domain: "127.0.0.1", minutes: 5 })).ok, true);
    assert.equal(await pixelLoads(), true);
    await options();
    await send({ type: "resumeSite", domain: "127.0.0.1" });
    assert.equal(await pixelLoads(), false);
    await withBlocking({ blockedDomains: [] });
  });
  await check("ruleset 'tracking' se puede habilitar y deshabilitar", async () => {
    await options();
    assert.equal((await send({ type: "setProfile", profile: "privacy" })).ok, true);
    assert.equal((await send({ type: "getState" })).derivedProfile, "privacy");
    assert.equal((await send({ type: "setProfile", profile: "balanced" })).ok, true);
  });
  await check("descarte manual solo descarta pestañas elegibles (http, no activa, no fijada)", async () => {
    await options();
    const res = await send({ type: "discardNow" });
    assert.equal(res.ok, true);
    const discarded = await run(
      "return (await chrome.tabs.query({ discarded: true })).map(t => ({ url: t.url, active: t.active, pinned: t.pinned }));"
    );
    assert.equal(discarded.length, res.discarded);
    for (const t of discarded) {
      assert.match(t.url, /^https?:\/\//);
      assert.equal(t.active || t.pinned, false);
    }
    assert.equal((await send({ type: "getState" })).discardedTabs, res.discarded);
    const badge = await run("return await chrome.action.getBadgeText({});");
    assert.equal(badge, String(res.discarded));
  });
  await check("importar JSON inválido se rechaza", async () => {
    await options();
    assert.equal((await send({ type: "importSettings", json: "{ nope" })).ok, false);
  });
} catch (e) {
  results.push(["FAIL", "setup", e.message]);
} finally {
  await cleanup(sid);
}

for (const [status, name, msg] of results) {
  console.log(`${status === "ok" ? "  ✓" : "  ✘"} ${name}${msg ? `\n      ${msg}` : ""}`);
}
const failed = results.filter(([s]) => s !== "ok").length;
console.log(`\nFirefox: ${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
