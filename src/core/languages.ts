/** Idiomas de la interfaz (deben coincidir con las carpetas de _locales). */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" }
];

export const AUTO_LANGUAGE = "auto";

export function isSupportedLanguage(code: unknown): code is string {
  return LANGUAGES.some((l) => l.code === code);
}

export interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

/**
 * Formato de mensajes estilo chrome.i18n: $NAME$ -> placeholders[name].content,
 * y en el content "$1".."$9" -> substitutions. Sirve para el idioma manual.
 */
export function formatMessage(
  entry: MessageEntry,
  substitutions?: string | string[]
): string {
  const subs =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions];
  const withNamed = entry.message.replace(/\$([A-Za-z0-9_@]+)\$/g, (m, name) => {
    const ph = entry.placeholders?.[String(name).toLowerCase()];
    return ph ? ph.content : m;
  });
  return withNamed.replace(/\$([1-9])/g, (_m, n) => subs[Number(n) - 1] ?? "");
}
