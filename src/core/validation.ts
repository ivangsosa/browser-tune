import type { ResourceType } from "./types";

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const DOMAIN_RE = new RegExp(`^${DOMAIN_LABEL}(\\.${DOMAIN_LABEL})*$`);

export const BLOCKABLE_RESOURCE_TYPES: readonly ResourceType[] = [
  "script",
  "image",
  "sub_frame",
  "xmlhttprequest",
  "media",
  "font",
  "stylesheet",
  "ping",
  "websocket",
  "other"
];

/** Normaliza una entrada de usuario a un hostname en minúsculas, o null si es inválida. */
export function normalizeDomain(input: string): string | null {
  let v = input.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("://") || v.includes("/")) {
    try {
      v = new URL(v.includes("://") ? v : `https://${v}`).hostname;
    } catch {
      return null;
    }
  }
  v = v.replace(/^\.+|\.+$/g, "");
  if (v.length === 0 || v.length > 253 || !DOMAIN_RE.test(v)) return null;
  return v;
}

/** Normaliza, deduplica y ordena una lista de dominios. Descarta entradas inválidas. */
export function normalizeDomainList(inputs: string[]): string[] {
  const out = new Set<string>();
  for (const i of inputs) {
    const d = normalizeDomain(i);
    if (d) out.add(d);
  }
  return [...out].sort();
}

export interface DomainAnalysis {
  /** Dominios válidos, normalizados, sin duplicados, ordenados. */
  valid: string[];
  /** Líneas que no se pudieron interpretar como dominio (se ignoran al guardar). */
  invalid: string[];
}

/** Como normalizeDomainList, pero informa qué entradas se descartan (para la UI). */
export function analyzeDomainInput(inputs: string[]): DomainAnalysis {
  const valid = new Set<string>();
  const invalid: string[] = [];
  for (const i of inputs) {
    const d = normalizeDomain(i);
    if (d) valid.add(d);
    else if (i.trim()) invalid.push(i.trim());
  }
  return { valid: [...valid].sort(), invalid };
}

export function normalizeResourceTypes(v: unknown): ResourceType[] {
  if (!Array.isArray(v)) return [];
  const wanted = new Set(v);
  return BLOCKABLE_RESOURCE_TYPES.filter((t) => wanted.has(t));
}

export function isValidInactiveMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 5 &&
    value <= 1440
  );
}
