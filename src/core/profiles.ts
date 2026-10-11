import { PROFILE_TEMPLATES } from "../data/default-profiles";
import type { ExtensionSettings, ProfileId } from "./types";

function sameBlocking(
  a: ExtensionSettings["blocking"],
  b: ExtensionSettings["blocking"]
): boolean {
  return (
    a.enabled === b.enabled &&
    a.enabledRulesets.join(",") === b.enabledRulesets.join(",") &&
    a.blockedDomains.join(",") === b.blockedDomains.join(",") &&
    a.excludedDomains.join(",") === b.excludedDomains.join(",") &&
    a.resourceTypes.join(",") === b.resourceTypes.join(",")
  );
}

function sameTabDiscard(
  a: ExtensionSettings["tabDiscard"],
  b: ExtensionSettings["tabDiscard"]
): boolean {
  return (
    a.enabled === b.enabled &&
    a.inactiveMinutes === b.inactiveMinutes &&
    a.excludedDomains.join(",") === b.excludedDomains.join(",")
  );
}

/** Perfil que coincide exactamente con la config actual, o "custom". */
export function deriveProfileId(settings: ExtensionSettings): ProfileId {
  for (const [id, template] of Object.entries(PROFILE_TEMPLATES)) {
    if (
      sameBlocking(settings.blocking, template.blocking) &&
      sameTabDiscard(settings.tabDiscard, template.tabDiscard)
    ) {
      return id as ProfileId;
    }
  }
  return "custom";
}

/**
 * Aplica un perfil como plantilla. "custom" devuelve la config actual sin
 * cambios: el perfil refleja la personalización, no la pisa.
 */
export function applyProfileTemplate(
  settings: ExtensionSettings,
  profile: ProfileId
): ExtensionSettings {
  if (profile === "custom") return { ...settings, profile: "custom" };
  const template = PROFILE_TEMPLATES[profile];
  return {
    ...settings,
    profile,
    blocking: { ...template.blocking },
    tabDiscard: { ...template.tabDiscard }
  };
}
