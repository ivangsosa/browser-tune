import {
  diffRules,
  isManagedRuleId,
  type DnrRule
} from "../core/rules-engine";

type ChromeRule = chrome.declarativeNetRequest.Rule;

function toChromeRule(rule: DnrRule): ChromeRule {
  return {
    id: rule.id,
    priority: rule.priority,
    action: {
      type: rule.action.type as chrome.declarativeNetRequest.RuleActionType
    },
    condition: {
      requestDomains: rule.condition.requestDomains,
      // Sin main_frame: un dominio bloqueado navegado directamente no debe
      // romper la UX con una página de error.
      excludedResourceTypes: ["main_frame"]
    }
  } as ChromeRule;
}

/** Reglas dinámicas actualmente administradas por la extensión (por rango de ID). */
export async function getManagedDynamicRules(): Promise<DnrRule[]> {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules
    .filter((r) => isManagedRuleId(r.id))
    .map((r) => ({
      id: r.id,
      priority: r.priority ?? 1,
      action: { type: r.action.type.toLowerCase() as "block" | "allow" },
      condition: { requestDomains: r.condition.requestDomains ?? [] }
    }));
}

/**
 * Aplica el diff entre deseado y actual de forma atómica e idempotente.
 * Solo modifica reglas dentro del rango administrado.
 */
export async function applyDynamicRules(
  desired: DnrRule[]
): Promise<{ added: number; removed: number }> {
  const current = await getManagedDynamicRules();
  const diff = diffRules(desired, current);
  if (diff.addRules.length === 0 && diff.removeRuleIds.length === 0) {
    return { added: 0, removed: 0 };
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
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
