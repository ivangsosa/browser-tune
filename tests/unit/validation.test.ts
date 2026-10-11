import { describe, expect, it } from "vitest";
import {
  isValidInactiveMinutes,
  normalizeDomain,
  normalizeDomainList
} from "../../src/core/validation";

describe("normalizeDomain", () => {
  it("normaliza dominios simples", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
    expect(normalizeDomain("  sub.example.com  ")).toBe("sub.example.com");
  });

  it("extrae el hostname de URLs completas", () => {
    expect(normalizeDomain("https://example.com/path?q=1")).toBe("example.com");
    expect(normalizeDomain("example.com/path")).toBe("example.com");
    expect(normalizeDomain("http://user:pass@host.org:8080/x")).toBe("host.org");
  });

  it("quita puntos sobrantes", () => {
    expect(normalizeDomain(".example.com.")).toBe("example.com");
  });

  it("rechaza entradas inválidas", () => {
    for (const bad of [
      "",
      "   ",
      "not a domain",
      "-bad.com",
      "bad-.com",
      "foo..bar.com",
      "exa mple.com",
      "http://[::1",
      `${"a".repeat(254)}.com`
    ]) {
      expect(normalizeDomain(bad)).toBeNull();
    }
  });
});

describe("normalizeDomainList", () => {
  it("deduplica, ordena y descarta inválidas", () => {
    expect(
      normalizeDomainList(["b.com", "a.com", "b.com", "no válido", "A.com"])
    ).toEqual(["a.com", "b.com"]);
  });

  it("devuelve [] para entradas no normalizables", () => {
    expect(normalizeDomainList(["!!!", ""])).toEqual([]);
  });
});

describe("isValidInactiveMinutes", () => {
  it("acepta enteros dentro del rango", () => {
    expect(isValidInactiveMinutes(15)).toBe(true);
    expect(isValidInactiveMinutes(5)).toBe(true);
    expect(isValidInactiveMinutes(1440)).toBe(true);
  });

  it("rechaza fuera de rango y no enteros", () => {
    expect(isValidInactiveMinutes(4)).toBe(false);
    expect(isValidInactiveMinutes(1441)).toBe(false);
    expect(isValidInactiveMinutes(1.5)).toBe(false);
    expect(isValidInactiveMinutes("30")).toBe(false);
  });
});
