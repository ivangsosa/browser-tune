import {
  DEFAULT_SETTINGS,
  migrateSettings,
  SETTINGS_KEY
} from "../core/settings";
import type { ExtensionSettings } from "../core/types";

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
