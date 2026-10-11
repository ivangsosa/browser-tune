import { applyProfileTemplate, deriveProfileId } from "../core/profiles";
import { sanitizeSettings } from "../core/settings";
import type {
  ApplyResponse,
  BgRequest,
  StateResponse
} from "../core/messages";
import { getCapabilities } from "../platform/capabilities";
import { getManagedDynamicRules } from "../platform/network-rules";
import {
  importSettings,
  loadSettings,
  saveSettings
} from "../platform/storage";
import { applySettings } from "./apply-profile";

// onInstalled/onStartup: migrar/persistir settings y re-aplicar el estado
// deseado. Todo se reconstruye desde storage — nada depende de memoria del SW.
async function restoreAndApply(): Promise<void> {
  const settings = await loadSettings();
  await applySettings(settings);
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const settings = await loadSettings();
    if (details.reason === "install" || details.reason === "update") {
      await saveSettings(settings);
    }
    await applySettings(settings);
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void restoreAndApply();
});

async function persistAndApply(
  settings: ReturnType<typeof sanitizeSettings>
): Promise<ApplyResponse> {
  try {
    await saveSettings(settings);
    const summary = await applySettings(settings);
    return { ok: true, settings, summary };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function handleMessage(
  msg: BgRequest
): Promise<StateResponse | ApplyResponse> {
  switch (msg.type) {
    case "getState": {
      const settings = await loadSettings();
      const managedRuleCount = (await getManagedDynamicRules()).length;
      return {
        settings,
        derivedProfile: deriveProfileId(settings),
        capabilities: getCapabilities(),
        managedRuleCount
      };
    }
    case "setProfile": {
      const current = await loadSettings();
      return persistAndApply(applyProfileTemplate(current, msg.profile));
    }
    case "saveSettings":
      return persistAndApply(sanitizeSettings(msg.settings));
    case "importSettings":
      return persistAndApply(importSettings(msg.json));
    default:
      return { ok: false, error: "mensaje desconocido" };
  }
}

chrome.runtime.onMessage.addListener((msg: BgRequest, _sender, send) => {
  void handleMessage(msg)
    .then(send)
    .catch((e: unknown) =>
      send({ ok: false, error: e instanceof Error ? e.message : String(e) })
    );
  return true; // respuesta asíncrona
});
