import type { ProfileId, ProfileTemplate } from "../core/types";

/**
 * Perfiles predefinidos. Son plantillas: aplicar uno estampa estos valores
 * sobre la configuración; "custom" no tiene plantilla.
 * Valores propuestos, no óptimos universales.
 */
export const PROFILE_TEMPLATES: Record<
  Exclude<ProfileId, "custom">,
  ProfileTemplate
> = {
  balanced: {
    blocking: {
      enabled: true,
      enabledRulesets: ["predefined"],
      blockedDomains: [],
      excludedDomains: []
    },
    tabDiscard: {
      enabled: false,
      inactiveMinutes: 30,
      excludedDomains: []
    }
  },
  "low-resource": {
    blocking: {
      enabled: true,
      enabledRulesets: ["predefined"],
      blockedDomains: [],
      excludedDomains: []
    },
    tabDiscard: {
      enabled: true,
      inactiveMinutes: 15,
      excludedDomains: []
    }
  },
  privacy: {
    blocking: {
      enabled: true,
      enabledRulesets: ["predefined"],
      blockedDomains: [],
      excludedDomains: []
    },
    tabDiscard: {
      enabled: false,
      inactiveMinutes: 30,
      excludedDomains: []
    }
  }
};

/** Rulesets predefinidos disponibles (metadata para la UI, labels vía i18n). */
export const AVAILABLE_RULESETS: readonly { id: string; labelKey: string }[] = [
  { id: "predefined", labelKey: "rulesetPredefined" }
];
