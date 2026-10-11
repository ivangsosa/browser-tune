import {
  DEFAULT_SETTINGS,
  migrateSettings,
  SETTINGS_KEY
} from "../core/settings";
import type { ExtensionSettings, PauseEntry } from "../core/types";
import { appendActivity, type ActivityEntry } from "../core/activity";

/**
 * Lee la configuración persistida. Devuelve defaults si no existe o si los
 * datos guardados no superan la validación/migración (nunca lanza).
 */
export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = raw[SETTINGS_KEY];
  if (stored === undefined) return { ...DEFAULT_SETTINGS };
  try {
    return migrateSettings(stored);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  settings: ExtensionSettings
): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

const PAUSES_KEY = "pauses";
const LAST_ERROR_KEY = "lastError";
const ACTIVITY_KEY = "activityLog";
export const LANGUAGE_KEY = "uiLanguage";

export async function loadPauses(): Promise<PauseEntry[]> {
  const raw = await chrome.storage.local.get(PAUSES_KEY);
  const v: unknown = raw[PAUSES_KEY];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (p): p is PauseEntry =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as PauseEntry).domain === "string" &&
      typeof (p as PauseEntry).until === "number"
  );
}

export async function savePauses(pauses: PauseEntry[]): Promise<void> {
  await chrome.storage.local.set({ [PAUSES_KEY]: pauses });
}

/** Último error de aplicación (storage.session: no persiste entre sesiones). */
export async function getLastError(): Promise<string | null> {
  if (!chrome.storage.session) return null;
  const raw = await chrome.storage.session.get(LAST_ERROR_KEY);
  const v: unknown = raw[LAST_ERROR_KEY];
  return typeof v === "string" ? v : null;
}

export async function setLastError(message: string | null): Promise<void> {
  if (!chrome.storage.session) return;
  if (message === null) await chrome.storage.session.remove(LAST_ERROR_KEY);
  else await chrome.storage.session.set({ [LAST_ERROR_KEY]: message });
}

export async function loadActivity(): Promise<ActivityEntry[]> {
  const raw = await chrome.storage.local.get(ACTIVITY_KEY);
  const v: unknown = raw[ACTIVITY_KEY];
  return Array.isArray(v) ? (v as ActivityEntry[]) : [];
}

export async function logActivity(
  entry: Omit<ActivityEntry, "ts">
): Promise<void> {
  try {
    const log = await loadActivity();
    await chrome.storage.local.set({
      [ACTIVITY_KEY]: appendActivity(log, entry)
    });
  } catch {
    // El historial es informativo: nunca debe romper una operación.
  }
}

export async function clearActivity(): Promise<void> {
  await chrome.storage.local.remove(ACTIVITY_KEY);
}

export function exportSettings(settings: ExtensionSettings): string {
  return JSON.stringify(settings, null, 2);
}

/**
 * Parsea y valida un JSON importado. Lanza ante JSON inválido o datos que no
 * cumplen el schema — el llamador decide cómo mostrar el error.
 */
export function importSettings(json: string): ExtensionSettings {
  const parsed: unknown = JSON.parse(json);
  return migrateSettings(parsed);
}
