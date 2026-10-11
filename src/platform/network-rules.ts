import {
  diffRules,
  isManagedRuleId,
  isPauseRuleId,
  makeCondition,
  type DnrRule
} from "../core/rules-engine";
import type { ResourceType } from "../core/types";

type ChromeRule = chrome.declarativeNetRequest.Rule;

function toChromeRule(rule: DnrRule): ChromeRule {
  const { requestDomains, initiatorDomains, resourceTypes } = rule.condition;
  return {
    id: rule.id,
    priority: rule.priority,
    action: {
      type: rule.action.type as chrome.declarativeNetRequest.RuleActionType
    },
    condition: {
      requestDomains,
      initiatorDomains,
      // Sin main_frame: un dominio bloqueado navegado directamente no debe
      // romper la UX con una página de error. Con resourceTypes explícitos
      // (nunca incluyen main_frame) no hace falta excluirlo.
      ...(resourceTypes?.length
        ? { resourceTypes }
        : { excludedResourceTypes: ["main_frame"] })
    }
  } as ChromeRule;
}

function fromChromeRule(r: ChromeRule): DnrRule {
  return {
    id: r.id,
    priority: r.priority ?? 1,
    action: { type: r.action.type.toLowerCase() as "block" | "allow" },
    condition: makeCondition({
      ...(r.condition.requestDomains && {
        requestDomains: r.condition.requestDomains
      }),
      ...(r.condition.initiatorDomains && {
        initiatorDomains: r.condition.initiatorDomains
      }),
      ...(r.condition.resourceTypes && {
        resourceTypes: r.condition.resourceTypes as ResourceType[]
      })
    })
  };
}

/** Reglas dinámicas actualmente administradas por la extensión (por rango de ID). */
export async function getManagedDynamicRules(): Promise<DnrRule[]> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.filter((r) => isManagedRuleId(r.id)).map(fromChromeRule);
}

/** Reglas de sesión (pausas) administradas por la extensión. */
export async function getManagedSessionRules(): Promise<DnrRule[]> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.filter((r) => isPauseRuleId(r.id)).map(fromChromeRule);
}

/**
 * Aplica el diff entre deseado y actual de forma atómica e idempotente.
 * Solo modifica reglas dentro del rango administrado.
 */
export async function applyDynamicRules(
  desired: DnrRule[]
): Promise<{ added: number; removed: number }> {
  const diff = diffRules(desired, await getManagedDynamicRules());
  if (diff.addRules.length === 0 && diff.removeRuleIds.length === 0) {
    return { added: 0, removed: 0 };
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: diff.addRules.map(toChromeRule),
    removeRuleIds: diff.removeRuleIds
  });
  return { added: diff.addRules.length, removed: diff.removeRuleIds.length };
}

/** Igual que applyDynamicRules pero para reglas de sesión (pausas). */
export async function applySessionRules(
  desired: DnrRule[]
): Promise<{ added: number; removed: number }> {
  const diff = diffRules(desired, await getManagedSessionRules());
  if (diff.addRules.length === 0 && diff.removeRuleIds.length === 0) {
    return { added: 0, removed: 0 };
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: diff.addRules.map(toChromeRule),
    removeRuleIds: diff.removeRuleIds
  });
  return { added: diff.addRules.length, removed: diff.removeRuleIds.length };
}

/** Habilita/deshabilita rulesets estáticos según la config (idempotente). */
export async function applyEnabledRulesets(
  desiredIds: string[]
): Promise<{ enabled: string[]; disabled: string[] }> {
  const enabledNow = await chrome.declarativeNetRequest.getEnabledRulesets();
  const desired = new Set(desiredIds);
  const current = new Set(enabledNow);
  const enable = desiredIds.filter((id) => !current.has(id));
  const disable = enabledNow.filter((id) => !desired.has(id));
  if (enable.length === 0 && disable.length === 0) {
    return { enabled: [], disabled: [] };
  }
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable
  });
  return { enabled: enable, disabled: disable };
}
