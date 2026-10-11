/** chrome.i18n.getMessage con fallback a la clave (visible en lugar de vacío). */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Localiza el DOM: todo elemento con data-i18n recibe su texto traducido;
 * data-i18n-placeholder traduce el placeholder de inputs/textareas.
 */
export function localizePage(): void {
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n!);
  }
  for (const el of document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder!);
  }
}
