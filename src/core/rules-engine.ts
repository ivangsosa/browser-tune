import type { ExtensionSettings } from "./types";

/**
 * Regla DNR en formato interno (subset del schema de la API).
 * Solo acciones seguras: block/allow — nunca redirect/modifyHeaders.
 */
export interface DnrRule {
  id: number;
  priority: number;
  action: { type: "block" | "allow" };
  condition: { requestDomains: string[] };
}

/**
 * Rangos de IDs reservados para reglas dinámicas administradas por la
 * extensión. Los IDs de rulesets estáticos viven en sus propios archivos.
 * Solo se diffean/eliminan reglas dentro de este rango — nunca las ajenas.
 */
export const USER_BLOCK_RULE_BASE = 1_000_000;
export const EXCLUSION_RULE_BASE = 2_000_000;
export const MANAGED_RULE_END = 3_000_000;

export function isManagedRuleId(id: number): boolean {
  return id >= USER_BLOCK_RULE_BASE && id < MANAGED_RULE_END;
}

const BLOCK_PRIORITY = 1;
// allow precede a block por definición de la API; la prioridad alta solo
// hace explícita la intención en el diff y debugging.
const ALLOW_PRIORITY = 100;

/** Reglas dinámicas deseadas a partir de la configuración. */
export function desiredDynamicRules(settings: ExtensionSettings): DnrRule[] {
  if (!settings.blocking.enabled) return [];
  const rules: DnrRule[] = [];
  settings.blocking.blockedDomains.forEach((domain, i) => {
    rules.push({
      id: USER_BLOCK_RULE_BASE + i,
      priority: BLOCK_PRIORITY,
      action: { type: "block" },
      condition: { requestDomains: [domain] }
    });
  });
  settings.blocking.excludedDomains.forEach((domain, i) => {
    rules.push({
      id: EXCLUSION_RULE_BASE + i,
      priority: ALLOW_PRIORITY,
      action: { type: "allow" },
      condition: { requestDomains: [domain] }
    });
  });
  return rules;
}

export interface RuleDiff {
  addRules: DnrRule[];
  removeRuleIds: number[];
}

const sameRule = (a: DnrRule, b: DnrRule): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Diff entre reglas deseadas y las reglas administradas actualmente.
 * Las reglas reemplazadas van tanto en remove como en add — la API procesa
 * los removes primero dentro de la misma llamada atómica.
 */
export function diffRules(desired: DnrRule[], current: DnrRule[]): RuleDiff {
  const desiredById = new Map(desired.map((r) => [r.id, r]));
  const currentById = new Map(current.map((r) => [r.id, r]));
  return {
    addRules: desired.filter((r) => {
      const c = currentById.get(r.id);
      return !c || !sameRule(r, c);
    }),
    removeRuleIds: current
      .filter((r) => {
        const d = desiredById.get(r.id);
        return !d || !sameRule(r, d);
      })
      .map((r) => r.id)
  };
}
