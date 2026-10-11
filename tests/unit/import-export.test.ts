import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/core/settings";
import { exportSettings, importSettings } from "../../src/platform/storage";

// storage.ts usa chrome.* solo en load/save; export/import son puros.

describe("export/import de configuración", () => {
  it("export produce JSON parseable con schemaVersion", () => {
    const parsed = JSON.parse(exportSettings(DEFAULT_SETTINGS)) as {
      schemaVersion: number;
    };
    expect(parsed.schemaVersion).toBe(1);
  });

  it("roundtrip export -> import conserva los datos", () => {
    const s = {
      ...DEFAULT_SETTINGS,
      profile: "privacy" as const,
      blocking: {
        ...DEFAULT_SETTINGS.blocking,
        blockedDomains: ["a.example.com"]
      }
    };
    expect(importSettings(exportSettings(s))).toEqual(s);
  });

  it("rechaza JSON inválido", () => {
    expect(() => importSettings("{not json")).toThrow();
    expect(() => importSettings("")).toThrow();
  });

  it("rechaza datos que no cumplen el schema", () => {
    expect(() => importSettings('"hola"')).toThrow(TypeError);
    expect(() => importSettings('{"schemaVersion":99}')).toThrow(TypeError);
  });
});
