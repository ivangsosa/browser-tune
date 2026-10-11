import {
  AUTO_LANGUAGE,
  formatMessage,
  isSupportedLanguage,
  type MessageEntry
} from "../core/languages";
import { LANGUAGE_KEY } from "../platform/storage";

let override: Record<string, MessageEntry> | null = null;

/**
 * Carga el idioma elegido manualmente (si lo hay). Con "auto" se usa el
 * idioma del navegador vía chrome.i18n. Llamar antes de renderizar.
 */
export async function initI18n(): Promise<string> {
  const stored = (await chrome.storage.local.get(LANGUAGE_KEY))[LANGUAGE_KEY];
  const choice =
    typeof stored === "string" && isSupportedLanguage(stored)
      ? stored
      : AUTO_LANGUAGE;
  if (choice !== AUTO_LANGUAGE) {
    try {
      const res = await fetch(
        chrome.runtime.getURL(`_locales/${choice}/messages.json`)
      );
      override = (await res.json()) as Record<string, MessageEntry>;
      document.documentElement.lang = choice;
    } catch {
      override = null;
    }
  } else {
    document.documentElement.lang = chrome.i18n.getUILanguage().split("-")[0] ?? "en";
  }
  return choice;
}

export async function setLanguage(choice: string): Promise<void> {
  await chrome.storage.local.set({ [LANGUAGE_KEY]: choice });
}

/** Traducción con fallback a chrome.i18n y luego a la clave (visible, no vacío). */
export function t(key: string, substitutions?: string | string[]): string {
  const entry = override?.[key];
  if (entry) return formatMessage(entry, substitutions);
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * Localiza el DOM: data-i18n -> texto; data-i18n-placeholder -> placeholder;
 * data-i18n-label -> aria-label.
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
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nLabel!));
  }
}
