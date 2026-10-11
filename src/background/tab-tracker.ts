import { isDiscardable } from "../core/tab-discard";
import type { ExtensionSettings } from "../core/types";
import { getCapabilities } from "../platform/capabilities";
import { loadSettings, logActivity } from "../platform/storage";

/**
 * Actividad por pestaña en storage.session: sobrevive a suspensiones del
 * service worker sin escribir a disco ni persistir entre sesiones.
 */
const ACTIVITY_KEY = "tabActivity";
const ALARM_NAME = "browser-tune:tab-sweep";

async function getActivity(): Promise<Record<number, number>> {
  const r = await chrome.storage.session.get(ACTIVITY_KEY);
  return (r[ACTIVITY_KEY] as Record<number, number> | undefined) ?? {};
}

async function setActivity(map: Record<number, number>): Promise<void> {
  await chrome.storage.session.set({ [ACTIVITY_KEY]: map });
}

export async function recordActivity(tabId: number): Promise<void> {
  const map = await getActivity();
  map[tabId] = Date.now();
  await setActivity(map);
}

export async function removeTab(tabId: number): Promise<void> {
  const map = await getActivity();
  delete map[tabId];
  await setActivity(map);
}

/** Tras un reinicio del SW: sembrar timestamps faltantes con "ahora" (conservador). */
export async function seedMissing(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const map = await getActivity();
  const now = Date.now();
  let dirty = false;
  for (const t of tabs) {
    if (t.id !== undefined && map[t.id] === undefined) {
      map[t.id] = now;
      dirty = true;
    }
  }
  if (dirty) await setActivity(map);
}

/**
 * Descarta las pestañas inactivas que superan el umbral. Devuelve cuántas se
 * descartaron. Conservador: una pestaña sin timestamp no se descarta.
 */
export async function sweep(settings: ExtensionSettings): Promise<number> {
  if (!settings.tabDiscard.enabled) return 0;
  const caps = getCapabilities();
  if (!caps.tabDiscard || !caps.sessionStorage) return 0;
  return discardEligible(settings, settings.tabDiscard.inactiveMinutes * 60_000);
}

/**
 * Descarte manual ("Descartar ahora"): mismas protecciones, sin esperar el
 * umbral de inactividad y aunque la función automática esté apagada.
 */
export async function discardNow(settings: ExtensionSettings): Promise<number> {
  if (!getCapabilities().tabDiscard) return 0;
  return discardEligible(settings, 0);
}

/** Cantidad de pestañas descartadas actualmente en el navegador. */
export async function countDiscarded(): Promise<number> {
  if (!getCapabilities().tabDiscard) return 0;
  return (await chrome.tabs.query({ discarded: true })).length;
}

/** Badge del ícono = pestañas descartadas (vacío en 0). */
export async function updateBadge(): Promise<void> {
  if (typeof chrome.action?.setBadgeText !== "function") return;
  const n = await countDiscarded();
  await chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#4a6ea9" });
}

async function discardEligible(
  settings: ExtensionSettings,
  thresholdMs: number
): Promise<number> {
  const now = Date.now();
  const activity = getCapabilities().sessionStorage ? await getActivity() : {};
  const tabs = await chrome.tabs.query({});
  let discarded = 0;

  for (const tab of tabs) {
    const id = tab.id;
    if (id === undefined) continue;
    if (!isDiscardable(tab, settings.tabDiscard.excludedDomains)) continue;
    if (thresholdMs > 0) {
      const last = activity[id];
      if (last === undefined || now - last < thresholdMs) continue;
    }
    try {
      await chrome.tabs.discard(id);
      delete activity[id];
      discarded++;
    } catch {
      // El navegador rechazó el descarte (p. ej. pestaña con estado protegido).
    }
  }
  if (discarded > 0 && getCapabilities().sessionStorage) {
    await setActivity(activity);
  }
  return discarded;
}

/** Arma/desarma la alarma de barrido según la config. Idempotente. */
export async function ensureAlarm(
  settings: ExtensionSettings
): Promise<void> {
  const caps = getCapabilities();
  if (!caps.alarms) return;
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (settings.tabDiscard.enabled && !existing) {
    await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  } else if (!settings.tabDiscard.enabled && existing) {
    await chrome.alarms.clear(ALARM_NAME);
  }
}

/**
 * Registra los listeners de actividad por eventos (cero polling) y el
 * listener de la alarma. Llamar en el top-level del background: los
 * listeners mueren con el SW y hay que re-registrarlos en cada wake.
 */
export function initTabTracking(): void {
  const caps = getCapabilities();
  if (!caps.sessionStorage) return;

  chrome.tabs.onActivated.addListener((info) => {
    void recordActivity(info.tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === "complete") void recordActivity(tabId);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void removeTab(tabId);
  });

  if (caps.alarms) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === ALARM_NAME) {
        void loadSettings()
          .then(sweep)
          .then(async (n) => {
            if (n > 0) {
              await logActivity({ kind: "discard", count: n });
              await updateBadge();
            }
          });
      }
    });
  }

  void seedMissing();
}
