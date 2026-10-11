import {
  applyProfileTemplate,
  deriveProfileId,
  effectiveProfileId
} from "../core/profiles";
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
  clearActivity,
  getLastError,
  importSettings,
  loadActivity,
  loadPauses,
  loadSettings,
  logActivity,
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
  seedMissing,
  updateBadge
} from "./tab-tracker";

// Registrar listeners en el top-level: el SW/event page puede morir y
// volver, y los listeners deben existir desde el primer evento.
initTabTracking();
initPauseExpiry();

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "discard-now") {
      void loadSettings()
        .then(discardNow)
        .then(async (n) => {
          if (n > 0) await logActivity({ kind: "discard", count: n });
          await updateBadge();
        });
    }
  });
}

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
    await updateBadge();
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
    derivedProfile: effectiveProfileId(settings),
    capabilities: getCapabilities(),
    managedRuleCount: getCapabilities().dnr
      ? (await getManagedDynamicRules()).length
      : 0,
    pauses: activePauses(await loadPauses(), Date.now()),
    discardedTabs: await countDiscarded(),
    lastError: await getLastError(),
    activityLog: await loadActivity()
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
      const res = await persistAndApply(applyProfileTemplate(current, msg.profile));
      if (res.ok) {
        await logActivity({
          kind: "profile",
          profile: msg.profile,
          added: res.summary?.rulesAdded ?? 0,
          removed: res.summary?.rulesRemoved ?? 0
        });
      }
      return res;
    }
    case "saveSettings": {
      const res = await persistAndApply(sanitizeSettings(msg.settings));
      if (res.ok) {
        await logActivity({
          kind: "apply",
          added: res.summary?.rulesAdded ?? 0,
          removed: res.summary?.rulesRemoved ?? 0
        });
      } else {
        await logActivity({ kind: "error", error: res.error ?? "unknown" });
      }
      return res;
    }
    case "importSettings": {
      const res = await persistAndApply(importSettings(msg.json));
      if (res.ok) await logActivity({ kind: "import" });
      return res;
    }
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
              blocking: {
                ...s.blocking,
                excludedDomains: [...s.blocking.excludedDomains, domain]
              }
            }
          : {
              ...s,
              tabDiscard: {
                ...s.tabDiscard,
                excludedDomains: [...s.tabDiscard.excludedDomains, domain]
              }
            };
      return persistAndApply(
        sanitizeSettings({ ...next, profile: deriveProfileId(next) })
      );
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
      const discarded = await discardNow(await loadSettings());
      if (discarded > 0) await logActivity({ kind: "discard", count: discarded });
      await updateBadge();
      return { ok: true, discarded };
    }
    case "clearActivity":
      await clearActivity();
      return { ok: true };
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
