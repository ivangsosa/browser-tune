import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  MAX_BLOCKED_DOMAINS,
  migrateSettings,
  sanitizeSettings
} from "../../src/core/settings";

function validSettings() {
  return {
    schemaVersion: 1,
    profile: "low-resource",
    blocking: {
      enabled: true,
      enabledRulesets: ["predefined"],
      blockedDomains: ["ads.example.com"],
      excludedDomains: ["mail.example.com"]
    },
    tabDiscard: {
      enabled: true,
      inactiveMinutes: 15,
      excludedDomains: ["docs.example.com"]
    }
  };
}

describe("sanitizeSettings", () => {
  it("acepta un objeto v1 completo y válido", () => {
    const s = sanitizeSettings(validSettings());
    expect(s.profile).toBe("low-resource");
    expect(s.blocking.blockedDomains).toEqual(["ads.example.com"]);
    expect(s.tabDiscard.inactiveMinutes).toBe(15);
  });

  it("rellena campos faltantes con defaults", () => {
    const s = sanitizeSettings({ schemaVersion: 1 });
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it("normaliza dominios y descarta entradas inválidas", () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      blocking: {
        enabled: true,
        enabledRulesets: [],
        blockedDomains: ["ADS.EXAMPLE.com", "bad domain", "ok.net"],
        excludedDomains: []
      }
    });
    expect(s.blocking.blockedDomains).toEqual(["ads.example.com", "ok.net"]);
  });

  it("aplica el cap de dominios bloqueados", () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      blocking: {
        blockedDomains: Array.from(
          { length: MAX_BLOCKED_DOMAINS + 10 },
          (_, i) => `d${i}.example.com`
        )
      }
    });
    expect(s.blocking.blockedDomains).toHaveLength(MAX_BLOCKED_DOMAINS);
  });

  it("rechaza raíz no objeto y schemaVersion incorrecta", () => {
    expect(() => sanitizeSettings("nope")).toThrow(TypeError);
    expect(() => sanitizeSettings(null)).toThrow(TypeError);
    expect(() => sanitizeSettings({ schemaVersion: 2 })).toThrow(TypeError);
    expect(() => sanitizeSettings({ schemaVersion: "1" })).toThrow(TypeError);
  });

  it("perfil desconocido vuelve al default", () => {
    const s = sanitizeSettings({ schemaVersion: 1, profile: "fast" });
    expect(s.profile).toBe("balanced");
  });

  it("inactiveMinutes inválido vuelve al default", () => {
    const s = sanitizeSettings({
      schemaVersion: 1,
      tabDiscard: { enabled: true, inactiveMinutes: -5 }
    });
    expect(s.tabDiscard.inactiveMinutes).toBe(30);
  });
});

describe("migrateSettings", () => {
  it("objeto sin schemaVersion -> defaults (primera instalación)", () => {
    expect(migrateSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("v1 válido pasa por sanitize", () => {
    expect(migrateSettings(validSettings()).profile).toBe("low-resource");
  });
});
