import type { ExtensionSettings, PauseEntry, ResourceType } from "./types";

export interface DnrCondition {
  requestDomains?: string[];
  initiatorDomains?: string[];
  resourceTypes?: ResourceType[];
}

/**
 * Regla DNR en formato interno (subset del schema de la API).
 * Solo acciones seguras: block/allow — nunca redirect/modifyHeaders.
 */
export interface DnrRule {
  id: number;
  priority: number;
  action: { type: "block" | "allow" };
  condition: DnrCondition;
}

/**
 * Rangos de IDs reservados para reglas dinámicas administradas por la
 * extensión. Los IDs de rulesets estáticos viven en sus propios archivos.
 * Solo se diffean/eliminan reglas dentro de este rango — nunca las ajenas.
 * Las reglas de sesión (pausas) usan su propio espacio de IDs.
 */
export const USER_BLOCK_RULE_BASE = 1_000_000;
export const EXCLUSION_RULE_BASE = 2_000_000;
export const MANAGED_RULE_END = 3_000_000;
export const PAUSE_RULE_BASE = 3_000_000;
export const PAUSE_RULE_END = 4_000_000;

export function isManagedRuleId(id: number): boolean {
  return id >= USER_BLOCK_RULE_BASE && id < MANAGED_RULE_END;
}

export function isPauseRuleId(id: number): boolean {
  return id >= PAUSE_RULE_BASE && id < PAUSE_RULE_END;
}

const BLOCK_PRIORITY = 1;
// allow precede a block por definición de la API; la prioridad alta solo
// hace explícita la intención en el diff y debugging.
const ALLOW_PRIORITY = 100;
// La pausa debe ganar también a cualquier regla estática (prioridad 1).
const PAUSE_PRIORITY = 200;

/**
 * Condición canónica: claves en orden fijo y sin vacíos, para que el diff
 * (JSON.stringify) sea estable entre reglas deseadas y las leídas del navegador.
 */
export function makeCondition(c: DnrCondition): DnrCondition {
  const out: DnrCondition = {};
  if (c.requestDomains?.length) out.requestDomains = [...c.requestDomains];
  if (c.initiatorDomains?.length) out.initiatorDomains = [...c.initiatorDomains];
  if (c.resourceTypes?.length) out.resourceTypes = [...c.resourceTypes].sort();
  return out;
}

/** Reglas dinámicas deseadas a partir de la configuración. */
export function desiredDynamicRules(settings: ExtensionSettings): DnrRule[] {
  if (!settings.blocking.enabled) return [];
  const rules: DnrRule[] = [];
  settings.blocking.blockedDomains.forEach((domain, i) => {
    rules.push({
      id: USER_BLOCK_RULE_BASE + i,
      priority: BLOCK_PRIORITY,
      action: { type: "block" },
      condition: makeCondition({
        requestDomains: [domain],
        resourceTypes: settings.blocking.resourceTypes
      })
    });
  });
  settings.blocking.excludedDomains.forEach((domain, i) => {
    rules.push({
      id: EXCLUSION_RULE_BASE + i,
      priority: ALLOW_PRIORITY,
      action: { type: "allow" },
      condition: makeCondition({ requestDomains: [domain] })
    });
  });
  return rules;
}

/**
 * Reglas de sesión para pausas: por sitio, una allow para lo que inicia la
 * página (terceros) y otra para las solicitudes al propio dominio.
 */
export function desiredPauseRules(pauses: PauseEntry[]): DnrRule[] {
  const rules: DnrRule[] = [];
  pauses.forEach((p, i) => {
    rules.push({
      id: PAUSE_RULE_BASE + i * 2,
      priority: PAUSE_PRIORITY,
      action: { type: "allow" },
      condition: makeCondition({ initiatorDomains: [p.domain] })
    });
    rules.push({
      id: PAUSE_RULE_BASE + i * 2 + 1,
      priority: PAUSE_PRIORITY,
      action: { type: "allow" },
      condition: makeCondition({ requestDomains: [p.domain] })
    });
  });
  return rules;
}

/** Pausas vigentes, ordenadas por dominio (IDs de regla estables). */
export function activePauses(
  pauses: PauseEntry[],
  now: number
): PauseEntry[] {
  return pauses
    .filter((p) => p.until > now)
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

/** Agrega o renueva la pausa de un dominio. */
export function withPause(
  pauses: PauseEntry[],
  domain: string,
  until: number
): PauseEntry[] {
  return [...pauses.filter((p) => p.domain !== domain), { domain, until }];
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
