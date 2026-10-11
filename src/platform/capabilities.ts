export interface Capabilities {
  /** declarativeNetRequest disponible y con permiso. */
  dnr: boolean;
  /** tabs.discard disponible. */
  tabDiscard: boolean;
  /** alarms disponible. */
  alarms: boolean;
  /** storage.session disponible (persistencia efímera que sobrevive al SW). */
  sessionStorage: boolean;
  /** Detección de navegador: getBrowserInfo solo existe en Firefox. */
  isFirefox: boolean;
}

/**
 * Detección en runtime — no asumir paridad entre navegadores. Si una
 * capability falta, la función se desactiva y la UI lo explica.
 */
export function getCapabilities(): Capabilities {
  const runtime = chrome.runtime as typeof chrome.runtime & {
    getBrowserInfo?: () => Promise<unknown>;
  };
  return {
    dnr: typeof chrome.declarativeNetRequest?.getDynamicRules === "function",
    tabDiscard: typeof chrome.tabs?.discard === "function",
    alarms: typeof chrome.alarms?.create === "function",
    sessionStorage: typeof chrome.storage?.session?.get === "function",
    isFirefox: typeof runtime.getBrowserInfo === "function"
  };
}
