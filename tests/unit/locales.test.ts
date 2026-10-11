import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOCALES_DIR = resolve(import.meta.dirname, "../../_locales");

function load(locale: string): Record<string, { message: string }> {
  return JSON.parse(
    readFileSync(resolve(LOCALES_DIR, locale, "messages.json"), "utf8")
  );
}

describe("_locales", () => {
  const locales = readdirSync(LOCALES_DIR).sort();

  it("incluye en, es y pt", () => {
    expect(locales).toContain("en");
    expect(locales).toContain("es");
    expect(locales).toContain("pt");
  });

  it("todos los mensajes tienen message no vacío", () => {
    for (const locale of locales) {
      for (const [key, entry] of Object.entries(load(locale))) {
        expect(
          typeof entry.message === "string" && entry.message.length > 0,
          `${locale}/${key}`
        ).toBe(true);
      }
    }
  });

  it("mismas claves que el locale por defecto (en)", () => {
    const base = new Set(Object.keys(load("en")));
    for (const locale of locales.filter((l) => l !== "en")) {
      const keys = new Set(Object.keys(load(locale)));
      const missing = [...base].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !base.has(k));
      expect(missing, `${locale} faltantes`).toEqual([]);
      expect(extra, `${locale} sobrantes`).toEqual([]);
    }
  });
});
