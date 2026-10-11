import { describe, expect, it } from "vitest";
import {
  activePauses,
  desiredDynamicRules,
  desiredPauseRules,
  diffRules,
  isManagedRuleId,
  isPauseRuleId,
  makeCondition,
  PAUSE_RULE_BASE,
  withPause
} from "../../src/core/rules-engine";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../../src/core/settings";
import {
  analyzeDomainInput,
  normalizeResourceTypes
} from "../../src/core/validation";
import { deriveProfileId } from "../../src/core/profiles";
import { PROFILE_TEMPLATES } from "../../src/data/default-profiles";
import type { ExtensionSettings } from "../../src/core/types";

const withBlocked = (
  domains: string[],
  resourceTypes: ExtensionSettings["blocking"]["resourceTypes"] = []
): ExtensionSettings => ({
  ...DEFAULT_SETTINGS,
  blocking: { ...DEFAULT_SETTINGS.blocking, blockedDomains: domains, resourceTypes }
});

describe("pausas por sitio", () => {
  it("genera dos reglas allow de sesión por sitio, en el rango de pausas", () => {
    const rules = desiredPauseRules([{ domain: "a.com", until: 10 }]);
    expect(rules).toHaveLength(2);
    expect(rules.every((r) => r.action.type === "allow")).toBe(true);
    expect(rules.every((r) => isPauseRuleId(r.id))).toBe(true);
    expect(rules.every((r) => !isManagedRuleId(r.id))).toBe(true);
    expect(rules[0]?.condition).toEqual({ initiatorDomains: ["a.com"] });
    expect(rules[1]?.condition).toEqual({ requestDomains: ["a.com"] });
    expect(rules[0]?.id).toBe(PAUSE_RULE_BASE);
  });

  it("la prioridad de pausa supera a las reglas de bloqueo", () => {
    const [pause] = desiredPauseRules([{ domain: "a.com", until: 10 }]);
    const [block] = desiredDynamicRules(withBlocked(["ads.com"]));
    expect(pause!.priority).toBeGreaterThan(block!.priority);
  });

  it("descarta pausas vencidas y ordena por dominio", () => {
    const now = 1000;
    const active = activePauses(
      [
        { domain: "z.com", until: 2000 },
        { domain: "old.com", until: 999 },
        { domain: "b.com", until: 3000 }
      ],
      now
    );
    expect(active.map((p) => p.domain)).toEqual(["b.com", "z.com"]);
  });

  it("withPause renueva en lugar de duplicar", () => {
    const next = withPause([{ domain: "a.com", until: 1 }], "a.com", 5);
    expect(next).toEqual([{ domain: "a.com", until: 5 }]);
  });

  it("es idempotente: mismas pausas -> diff vacío", () => {
    const rules = desiredPauseRules([{ domain: "a.com", until: 10 }]);
    expect(diffRules(rules, rules)).toEqual({ addRules: [], removeRuleIds: [] });
  });
});

describe("tipos de recurso", () => {
  it("normaliza: descarta inválidos y duplicados, orden estable", () => {
    expect(normalizeResourceTypes(["image", "bogus", "script", "image"])).toEqual([
      "script",
      "image"
    ]);
    expect(normalizeResourceTypes("script")).toEqual([]);
  });

  it("sanitizeSettings acepta resourceTypes y lo rellena si falta", () => {
    const withTypes = sanitizeSettings({
      schemaVersion: 1,
      blocking: { resourceTypes: ["script", "main_frame"] }
    });
    expect(withTypes.blocking.resourceTypes).toEqual(["script"]);
    const without = sanitizeSettings({ schemaVersion: 1 });
    expect(without.blocking.resourceTypes).toEqual([]);
  });

  it("las reglas de bloqueo del usuario llevan resourceTypes; las allow no", () => {
    const s = withBlocked(["ads.com"], ["script"]);
    s.blocking.excludedDomains = ["ok.com"];
    const [block, allow] = desiredDynamicRules(s);
    expect(block!.condition.resourceTypes).toEqual(["script"]);
    expect(allow!.condition.resourceTypes).toBeUndefined();
  });

  it("makeCondition es canónico (omite vacíos, ordena tipos)", () => {
    expect(
      makeCondition({ requestDomains: ["a.com"], resourceTypes: ["script", "image"] })
    ).toEqual({ requestDomains: ["a.com"], resourceTypes: ["image", "script"] });
    expect(makeCondition({ requestDomains: [], resourceTypes: [] })).toEqual({});
  });

  it("cambiar resourceTypes produce un diff (replace) y el perfil pasa a custom", () => {
    const before = desiredDynamicRules(withBlocked(["ads.com"]));
    const after = desiredDynamicRules(withBlocked(["ads.com"], ["image"]));
    const diff = diffRules(after, before);
    expect(diff.addRules).toHaveLength(1);
    expect(diff.removeRuleIds).toHaveLength(1);
    const custom = withBlocked([], ["image"]);
    expect(deriveProfileId(custom)).toBe("custom");
  });
});

describe("perfiles con segundo ruleset", () => {
  it("Privacy habilita la lista ampliada y Balanced no", () => {
    expect(PROFILE_TEMPLATES.privacy.blocking.enabledRulesets).toContain("tracking");
    expect(PROFILE_TEMPLATES.balanced.blocking.enabledRulesets).not.toContain(
      "tracking"
    );
  });
});

describe("analyzeDomainInput", () => {
  it("separa válidos de inválidos y deduplica", () => {
    const r = analyzeDomainInput([
      "Ads.com",
      "ads.com",
      "https://x.org/path",
      "not a domain",
      "",
      "-bad-.com"
    ]);
    expect(r.valid).toEqual(["ads.com", "x.org"]);
    expect(r.invalid).toEqual(["not a domain", "-bad-.com"]);
  });
});
