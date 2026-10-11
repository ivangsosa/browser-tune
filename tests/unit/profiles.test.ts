import { describe, expect, it } from "vitest";
import { PROFILE_TEMPLATES } from "../../src/data/default-profiles";
import {
  applyProfileTemplate,
  deriveProfileId
} from "../../src/core/profiles";
import { DEFAULT_SETTINGS } from "../../src/core/settings";
import type { ExtensionSettings } from "../../src/core/types";

function custom(): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    blocking: {
      ...DEFAULT_SETTINGS.blocking,
      blockedDomains: ["user.example.com"]
    },
    tabDiscard: { ...DEFAULT_SETTINGS.tabDiscard, inactiveMinutes: 60 }
  };
}

describe("applyProfileTemplate", () => {
  it("aplica la plantilla del perfil", () => {
    const s = applyProfileTemplate(DEFAULT_SETTINGS, "low-resource");
    expect(s.profile).toBe("low-resource");
    expect(s.tabDiscard.enabled).toBe(true);
    expect(s.tabDiscard.inactiveMinutes).toBe(15);
  });

  it("custom no pisa la configuración actual", () => {
    const s = applyProfileTemplate(custom(), "custom");
    expect(s.blocking.blockedDomains).toEqual(["user.example.com"]);
    expect(s.tabDiscard.inactiveMinutes).toBe(60);
    expect(s.profile).toBe("custom");
  });

  it("aplicar un perfil estampa sus valores (elección explícita del usuario)", () => {
    const s = applyProfileTemplate(custom(), "privacy");
    expect(s.blocking).toEqual(PROFILE_TEMPLATES.privacy.blocking);
    expect(s.tabDiscard).toEqual(PROFILE_TEMPLATES.privacy.tabDiscard);
  });
});

describe("deriveProfileId", () => {
  it("config default coincide con balanced", () => {
    expect(deriveProfileId(DEFAULT_SETTINGS)).toBe("balanced");
  });

  it("config idéntica a low-resource deriva ese perfil", () => {
    const s = applyProfileTemplate(DEFAULT_SETTINGS, "low-resource");
    expect(deriveProfileId(s)).toBe("low-resource");
  });

  it("cualquier edición manual deriva custom", () => {
    expect(deriveProfileId(custom())).toBe("custom");
  });
});
