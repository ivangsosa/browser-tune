import { describe, expect, it } from "vitest";
import {
  desiredDynamicRules,
  diffRules,
  EXCLUSION_RULE_BASE,
  isManagedRuleId,
  USER_BLOCK_RULE_BASE,
  type DnrRule
} from "../../src/core/rules-engine";
import { DEFAULT_SETTINGS } from "../../src/core/settings";
import type { ExtensionSettings } from "../../src/core/types";

function settingsWith(
  blockedDomains: string[],
  excludedDomains: string[] = [],
  blockingEnabled = true
): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    blocking: {
      ...DEFAULT_SETTINGS.blocking,
      enabled: blockingEnabled,
      blockedDomains,
      excludedDomains
    }
  };
}

describe("desiredDynamicRules", () => {
  it("genera reglas block para dominios de usuario en el rango reservado", () => {
    const rules = desiredDynamicRules(
      settingsWith(["a.com", "b.com"])
    );
    expect(rules).toHaveLength(2);
    expect(rules[0]).toMatchObject({
      id: USER_BLOCK_RULE_BASE,
      action: { type: "block" },
      condition: { requestDomains: ["a.com"] }
    });
    expect(rules[1]!.id).toBe(USER_BLOCK_RULE_BASE + 1);
  });

  it("genera reglas allow para exclusiones en su propio rango", () => {
    const rules = desiredDynamicRules(settingsWith([], ["safe.com"]));
    expect(rules[0]).toMatchObject({
      id: EXCLUSION_RULE_BASE,
      action: { type: "allow" },
      condition: { requestDomains: ["safe.com"] }
    });
    expect(rules[0]!.priority).toBeGreaterThan(1);
  });

  it("blocking deshabilitado -> sin reglas", () => {
    expect(
      desiredDynamicRules(settingsWith(["a.com"], [], false))
    ).toEqual([]);
  });
});

describe("isManagedRuleId", () => {
  it("solo reconoce el rango administrado", () => {
    expect(isManagedRuleId(USER_BLOCK_RULE_BASE)).toBe(true);
    expect(isManagedRuleId(EXCLUSION_RULE_BASE)).toBe(true);
    expect(isManagedRuleId(1)).toBe(false);
    expect(isManagedRuleId(999_999)).toBe(false);
    expect(isManagedRuleId(3_000_000)).toBe(false);
  });
});

describe("diffRules", () => {
  const rule = (id: number): DnrRule => ({
    id,
    priority: 1,
    action: { type: "block" },
    condition: { requestDomains: [`d${id}.com`] }
  });

  it("idempotente: diff de iguales es vacío", () => {
    const a = [rule(USER_BLOCK_RULE_BASE)];
    const diff = diffRules(a, a);
    expect(diff.addRules).toEqual([]);
    expect(diff.removeRuleIds).toEqual([]);
  });

  it("agrega nuevas y quita obsoletas", () => {
    const diff = diffRules(
      [rule(USER_BLOCK_RULE_BASE + 1)],
      [rule(USER_BLOCK_RULE_BASE)]
    );
    expect(diff.addRules).toEqual([rule(USER_BLOCK_RULE_BASE + 1)]);
    expect(diff.removeRuleIds).toEqual([USER_BLOCK_RULE_BASE]);
  });

  it("una regla modificada va en remove y en add con el mismo id", () => {
    const modified = {
      ...rule(USER_BLOCK_RULE_BASE),
      condition: { requestDomains: ["nueva.com"] }
    };
    const diff = diffRules([modified], [rule(USER_BLOCK_RULE_BASE)]);
    expect(diff.removeRuleIds).toEqual([USER_BLOCK_RULE_BASE]);
    expect(diff.addRules).toEqual([modified]);
  });
});
