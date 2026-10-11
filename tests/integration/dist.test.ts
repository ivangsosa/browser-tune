import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_EXISTS = existsSync(resolve(ROOT, "dist/chrome/manifest.json"));

/**
 * Verificación de paquetes construidos. Requiere `npm run build` previo;
 * se omite silenciosamente si dist/ no existe (en CI corre tras el build).
 */
describe.skipIf(!DIST_EXISTS)("paquetes dist/", () => {
  for (const target of ["chrome", "firefox"] as const) {
    const dir = resolve(ROOT, "dist", target);
    const manifest = DIST_EXISTS
      ? JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"))
      : null;

    it(`${target}: estructura completa`, () => {
      for (const f of [
        "manifest.json",
        "background.js",
        "popup.html",
        "popup.js",
        "options.html",
        "options.js",
        "rulesets/predefined.json",
        "rulesets/tracking.json",
        ...["en", "es", "pt", "fr", "de"].map(
          (l) => `_locales/${l}/messages.json`
        )
      ]) {
        expect(existsSync(resolve(dir, f)), f).toBe(true);
      }
      expect(statSync(resolve(dir, "background.js")).size).toBeGreaterThan(0);
    });

    it(`${target}: manifiesto MV3 válido y mínimo privilegio`, () => {
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.default_locale).toBe("en");
      expect(manifest.permissions).not.toContain("<all_urls>");
      expect(manifest.host_permissions ?? []).toEqual([]);
      expect(manifest.icons).toBeTruthy();
      // Todas las rutas referenciadas existen en el paquete.
      for (const iconPath of Object.values<string>(manifest.icons)) {
        expect(existsSync(resolve(dir, iconPath)), iconPath).toBe(true);
      }
    });

    it(`${target}: rulesets estáticos con schema DNR válido`, () => {
      const resources: { id: string; enabled: boolean; path: string }[] =
        manifest.declarative_net_request.rule_resources;
      // Firefox bug 1921353: al menos un ruleset estático habilitado.
      expect(resources.some((r) => r.enabled)).toBe(true);
      const ACTIONS = ["block", "allow", "allowAllRequests", "upgradeScheme"];
      for (const res of resources) {
        const rules = JSON.parse(readFileSync(resolve(dir, res.path), "utf8"));
        const ids = new Set<number>();
        for (const rule of rules) {
          expect(rule.id, res.id).toBeGreaterThan(0);
          expect(ids.has(rule.id), `${res.id}: id duplicado ${rule.id}`).toBe(false);
          ids.add(rule.id);
          expect(ACTIONS).toContain(rule.action.type);
          expect(Array.isArray(rule.condition.requestDomains)).toBe(true);
          // Sin regex: solo dominios declarativos.
          expect(rule.condition.urlFilter).toBeUndefined();
          expect(rule.condition.regexFilter).toBeUndefined();
        }
      }
    });
  }
});
