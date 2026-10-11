import { applyProfileTemplate, deriveProfileId } from "../core/profiles";
import { sanitizeSettings } from "../core/settings";
import { normalizeDomain } from "../core/validation";
import type {
  ApplyResponse,
  BgRequest,
  StateResponse
} from "../core/messages";
import { getCapabilities } from "../platform/capabilities";
import { getManagedDynamicRules } from "../platform/network-rules";
import {
  getLastError,
  importSettings,
  loadPauses,
  loadSettings,
  saveSettings,
  setLastError
} from "../platform/storage";
import { activePauses } from "../core/rules-engine";
import { applySettings } from "./apply-profile";
import { initPauseExpiry, pauseSite, resumeSite } from "./pause";
import {
  countDiscarded,
  discardNow,
  initTabTracking,
  seedMissing
} from "./tab-tracker";

// Registrar listeners en el top-level: el SW/event page puede morir y
// volver, y los listeners deben existir desde el primer evento.
initTabTracking();
initPauseExpiry();

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

// onInstalled/onStartup: migrar/persistir settings y re-aplicar el estado
// deseado. Todo se reconstruye desde storage — nada depende de memoria del SW.
async function restoreAndApply(): Promise<void> {
  try {
    const settings = await loadSettings();
    await applySettings(settings);
    await seedMissing();
    await setLastError(null);
  } catch (e) {
    // Un wake no debe tumbar el SW: el próximo evento lo reintenta.
    console.error("browser-tune: restore falló", e);
    await setLastError(errorMessage(e));
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    try {
      const settings = await loadSettings();
      if (details.reason === "install" || details.reason === "update") {
        await saveSettings(settings);
      }
      await applySettings(settings);
      await setLastError(null);
    } catch (e) {
      console.error("browser-tune: onInstalled falló", e);
      await setLastError(errorMessage(e));
    }
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
    await setLastError(null);
    return { ok: true, settings, summary };
  } catch (e) {
    await setLastError(errorMessage(e));
    return { ok: false, error: errorMessage(e) };
  }
}

async function getState(): Promise<StateResponse> {
  const settings = await loadSettings();
  return {
    settings,
    derivedProfile: deriveProfileId(settings),
    capabilities: getCapabilities(),
    managedRuleCount: getCapabilities().dnr
      ? (await getManagedDynamicRules()).length
      : 0,
    pauses: activePauses(await loadPauses(), Date.now()),
    discardedTabs: await countDiscarded(),
    lastError: await getLastError()
  };
}

async function handleMessage(
  msg: BgRequest
): Promise<StateResponse | ApplyResponse> {
  switch (msg.type) {
    case "getState":
      return getState();
    case "setProfile": {
      const current = await loadSettings();
      return persistAndApply(applyProfileTemplate(current, msg.profile));
    }
    case "saveSettings":
      return persistAndApply(sanitizeSettings(msg.settings));
    case "importSettings":
      return persistAndApply(importSettings(msg.json));
    case "reapply":
      return persistAndApply(await loadSettings());
    case "excludeSite": {
      const domain = normalizeDomain(msg.domain);
      if (!domain) return { ok: false, error: "dominio inválido" };
      const s = await loadSettings();
      const next =
        msg.scope === "blocking"
          ? {
              ...s,
              profile: "custom" as const,
              blocking: {
                ...s.blocking,
                excludedDomains: [...s.blocking.excludedDomains, domain]
              }
            }
          : {
              ...s,
              profile: "custom" as const,
              tabDiscard: {
                ...s.tabDiscard,
                excludedDomains: [...s.tabDiscard.excludedDomains, domain]
              }
            };
      return persistAndApply(sanitizeSettings(next));
    }
    case "pauseSite": {
      const domain = normalizeDomain(msg.domain);
      const minutes = Math.min(Math.max(Math.round(msg.minutes), 1), 1440);
      if (!domain) return { ok: false, error: "dominio inválido" };
      try {
        await pauseSite(domain, minutes);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    }
    case "resumeSite": {
      const domain = normalizeDomain(msg.domain);
      if (!domain) return { ok: false, error: "dominio inválido" };
      try {
        await resumeSite(domain);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errorMessage(e) };
      }
    }
    case "discardNow": {
      if (!getCapabilities().tabDiscard) {
        return { ok: false, error: "tabs.discard no disponible" };
      }
      return { ok: true, discarded: await discardNow(await loadSettings()) };
    }
    default:
      return { ok: false, error: "mensaje desconocido" };
  }
}

chrome.runtime.onMessage.addListener((msg: BgRequest, _sender, send) => {
  void handleMessage(msg)
    .then(send)
    .catch((e: unknown) => send({ ok: false, error: errorMessage(e) }));
  return true; // respuesta asíncrona
});
