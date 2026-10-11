import type {
  BlockingSettings,
  ExtensionSettings,
  ProfileId,
  TabDiscardSettings
} from "./types";
import {
  isValidInactiveMinutes,
  normalizeDomainList,
  normalizeResourceTypes
} from "./validation";

export const SETTINGS_KEY = "settings";
export const MAX_BLOCKED_DOMAINS = 5000;
export const PROFILE_IDS: readonly ProfileId[] = [
  "balanced",
  "low-resource",
  "privacy",
  "custom"
];

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 1,
  profile: "balanced",
  blocking: {
    enabled: true,
    enabledRulesets: ["predefined"],
    blockedDomains: [],
    excludedDomains: [],
    resourceTypes: []
  },
  tabDiscard: {
    enabled: false,
    inactiveMinutes: 30,
    excludedDomains: []
  }
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toDomainList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return normalizeDomainList(v.filter((d): d is string => typeof d === "string"));
}

function toRulesetList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.filter((r): r is string => typeof r === "string" && r.length > 0);
}

function sanitizeBlocking(
  raw: unknown,
  defaults: BlockingSettings
): BlockingSettings {
  const r = isRecord(raw) ? raw : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaults.enabled,
    enabledRulesets: toRulesetList(r.enabledRulesets, defaults.enabledRulesets),
    blockedDomains: toDomainList(r.blockedDomains).slice(0, MAX_BLOCKED_DOMAINS),
    excludedDomains: toDomainList(r.excludedDomains),
    resourceTypes: normalizeResourceTypes(r.resourceTypes)
  };
}

function sanitizeTabDiscard(
  raw: unknown,
  defaults: TabDiscardSettings
): TabDiscardSettings {
  const r = isRecord(raw) ? raw : {};
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : defaults.enabled,
    inactiveMinutes: isValidInactiveMinutes(r.inactiveMinutes)
      ? r.inactiveMinutes
      : defaults.inactiveMinutes,
    excludedDomains: toDomainList(r.excludedDomains)
  };
}

/**
 * Valida y completa un objeto desconocido contra el schema v1.
 * Tolera campos faltantes (rellena con defaults); lanza si la raíz no es
 * un objeto o schemaVersion no es un número soportado.
 */
export function sanitizeSettings(raw: unknown): ExtensionSettings {
  if (!isRecord(raw)) {
    throw new TypeError("La configuración debe ser un objeto");
  }
  if (raw.schemaVersion !== 1) {
    throw new TypeError(`schemaVersion no soportado: ${String(raw.schemaVersion)}`);
  }
  const profile: ProfileId =
    typeof raw.profile === "string" &&
    (PROFILE_IDS as readonly string[]).includes(raw.profile)
      ? (raw.profile as ProfileId)
      : DEFAULT_SETTINGS.profile;
  return {
    schemaVersion: 1,
    profile,
    blocking: sanitizeBlocking(raw.blocking, DEFAULT_SETTINGS.blocking),
    tabDiscard: sanitizeTabDiscard(raw.tabDiscard, DEFAULT_SETTINGS.tabDiscard)
  };
}

/** Punto único de migración: hoy solo existe v1; versiones futuras se encadenan acá. */
export function migrateSettings(raw: unknown): ExtensionSettings {
  if (isRecord(raw) && raw.schemaVersion === undefined) {
    return { ...DEFAULT_SETTINGS };
  }
  return sanitizeSettings(raw);
}
