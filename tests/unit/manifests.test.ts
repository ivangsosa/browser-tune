import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

describe("manifiestos", () => {
  for (const target of ["chrome", "firefox"] as const) {
    it(`${target}: JSON válido con campos MV3 requeridos`, () => {
      const manifest = JSON.parse(
        readFileSync(resolve(ROOT, "manifests", `${target}.json`), "utf8")
      );
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toBe("__MSG_appTitle__");
      expect(manifest.default_locale).toBe("en");
      expect(manifest.permissions).toContain("storage");
      expect(manifest.permissions).toContain("declarativeNetRequest");
      expect(manifest.permissions).not.toContain("<all_urls>");
      expect(
        manifest.declarative_net_request.rule_resources[0].enabled
      ).toBe(true);
    });
  }

  it("firefox declara gecko.id y strict_min_version", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(ROOT, "manifests", "firefox.json"), "utf8")
    );
    expect(manifest.browser_specific_settings.gecko.id).toBeTruthy();
    expect(
      manifest.browser_specific_settings.gecko.strict_min_version
    ).toBeTruthy();
  });

  it("ruleset predefinido existe y es un array de reglas válido", () => {
    const rules = JSON.parse(
      readFileSync(resolve(ROOT, "rulesets", "predefined.json"), "utf8")
    );
    expect(Array.isArray(rules)).toBe(true);
  });
});
