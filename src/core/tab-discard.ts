/** Coincidencia dominio + subdominios (misma semántica que requestDomains). */
export function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function urlMatchesDomainList(
  url: string | undefined,
  domains: string[]
): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => hostMatchesDomain(host, d));
}

/** Solo http(s) es descartable de forma segura (nada de páginas internas). */
export function isDiscardableUrl(url: string | undefined): boolean {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/** Snapshot estructural de una pestaña — testeable sin chrome.tabs. */
export interface TabSnapshot {
  id?: number | undefined;
  pinned?: boolean | undefined;
  active?: boolean | undefined;
  audible?: boolean | undefined;
  discarded?: boolean | undefined;
  autoDiscardable?: boolean | undefined;
  url?: string | undefined;
}

/**
 * Protecciones: nunca descartar fijadas, la activa de cada ventana, audibles,
 * ya descartadas, con autoDiscardable=false, URLs no-http(s) ni dominios
 * excluidos por el usuario.
 */
export function isDiscardable(
  tab: TabSnapshot,
  excludedDomains: string[]
): boolean {
  if (tab.id === undefined) return false;
  if (tab.pinned || tab.active || tab.audible || tab.discarded) return false;
  if (tab.autoDiscardable === false) return false;
  if (!isDiscardableUrl(tab.url)) return false;
  return !urlMatchesDomainList(tab.url, excludedDomains);
}
