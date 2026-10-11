import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatMessage, LANGUAGES } from "../../src/core/languages";

const ROOT = resolve(import.meta.dirname, "../..");
const LOCALES_DIR = resolve(ROOT, "_locales");

function load(locale: string): Record<string, { message: string }> {
  return JSON.parse(
    readFileSync(resolve(LOCALES_DIR, locale, "messages.json"), "utf8")
  );
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(resolve(dir, e.name))
      : [resolve(dir, e.name)]
  );
}

describe("_locales", () => {
  const locales = readdirSync(LOCALES_DIR).sort();

  it("las carpetas coinciden con la lista de idiomas de la UI", () => {
    expect(locales).toEqual(LANGUAGES.map((l) => l.code).sort());
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

  it("los placeholders $name$ de cada mensaje están definidos", () => {
    for (const locale of locales) {
      for (const [key, entry] of Object.entries(
        load(locale) as Record<
          string,
          { message: string; placeholders?: Record<string, unknown> }
        >
      )) {
        const used = [...entry.message.matchAll(/\$([a-z0-9_]+)\$/gi)].map((m) =>
          m[1]!.toLowerCase()
        );
        for (const name of used) {
          expect(
            Object.keys(entry.placeholders ?? {}),
            `${locale}/${key}`
          ).toContain(name);
        }
      }
    }
  });

  it("toda clave usada en el código y los HTML existe en el locale por defecto", () => {
    const en = load("en");
    const files = walk(resolve(ROOT, "src")).filter((f) => /\.(ts|html)$/.test(f));
    const used = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/data-i18n(?:-placeholder|-label)?="([^"]+)"/g)) {
        used.add(m[1]!);
      }
      for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_@]+)"/g)) used.add(m[1]!);
      for (const m of src.matchAll(/(?:textKey|labelKey):\s*"([A-Za-z0-9_@]+)"/g)) {
        used.add(m[1]!);
      }
    }
    for (const type of [
      "script", "image", "sub_frame", "xmlhttprequest", "media",
      "font", "stylesheet", "ping", "websocket", "other"
    ]) {
      used.add(`resType_${type}`);
    }
    const missing = [...used].filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });
});

describe("formatMessage (idioma manual)", () => {
  it("resuelve placeholders con sustituciones $1..$n", () => {
    const entry = {
      message: "Applied: +$added$ −$removed$",
      placeholders: { added: { content: "$1" }, removed: { content: "$2" } }
    };
    expect(formatMessage(entry, ["3", "1"])).toBe("Applied: +3 −1");
  });

  it("acepta una sustitución simple y mensajes sin placeholders", () => {
    expect(
      formatMessage({
        message: "Rules: $count$",
        placeholders: { count: { content: "$1" } }
      }, "7")
    ).toBe("Rules: 7");
    expect(formatMessage({ message: "Hola" })).toBe("Hola");
  });
});
