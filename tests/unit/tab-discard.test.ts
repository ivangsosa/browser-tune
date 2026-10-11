import { describe, expect, it } from "vitest";
import {
  hostMatchesDomain,
  isDiscardable,
  isDiscardableUrl,
  urlMatchesDomainList,
  type TabSnapshot
} from "../../src/core/tab-discard";

describe("hostMatchesDomain", () => {
  it("coincide dominio y subdominios", () => {
    expect(hostMatchesDomain("example.com", "example.com")).toBe(true);
    expect(hostMatchesDomain("a.b.example.com", "example.com")).toBe(true);
    expect(hostMatchesDomain("notexample.com", "example.com")).toBe(false);
    expect(hostMatchesDomain("example.com.evil.org", "example.com")).toBe(false);
  });
});

describe("isDiscardableUrl", () => {
  it("solo http(s) es descartable", () => {
    expect(isDiscardableUrl("https://a.com")).toBe(true);
    expect(isDiscardableUrl("http://a.com")).toBe(true);
    for (const u of [
      "about:blank",
      "chrome://extensions",
      "chrome-extension://x/popup.html",
      "moz-extension://x/options.html",
      "edge://settings",
      "file:///etc/passwd",
      "view-source:https://a.com",
      "data:text/html,x",
      undefined
    ]) {
      expect(isDiscardableUrl(u)).toBe(false);
    }
  });
});

describe("urlMatchesDomainList", () => {
  it("matchea dominio+subdominios y tolera URLs inválidas", () => {
    expect(urlMatchesDomainList("https://mail.g.com/x", ["g.com"])).toBe(true);
    expect(urlMatchesDomainList("https://other.net", ["g.com"])).toBe(false);
    expect(urlMatchesDomainList("not a url", ["g.com"])).toBe(false);
    expect(urlMatchesDomainList(undefined, ["g.com"])).toBe(false);
  });
});

describe("isDiscardable", () => {
  const base: TabSnapshot = { id: 1, url: "https://site.com" };

  it("una pestaña normal e inactiva es descartable", () => {
    expect(isDiscardable(base, [])).toBe(true);
  });

  it("protege fijadas, activas, audibles, ya descartadas y autoDiscardable=false", () => {
    for (const t of [
      { ...base, pinned: true },
      { ...base, active: true },
      { ...base, audible: true },
      { ...base, discarded: true },
      { ...base, autoDiscardable: false }
    ]) {
      expect(isDiscardable(t, [])).toBe(false);
    }
  });

  it("protege páginas internas y URLs ausentes", () => {
    expect(isDiscardable({ id: 1, url: "chrome://newtab" }, [])).toBe(false);
    expect(isDiscardable({ id: 1 }, [])).toBe(false);
    expect(isDiscardable({ url: "https://site.com" }, [])).toBe(false);
  });

  it("respeta los dominios excluidos por el usuario", () => {
    expect(isDiscardable(base, ["site.com"])).toBe(false);
    expect(isDiscardable({ ...base, url: "https://sub.site.com" }, ["site.com"])).toBe(false);
    expect(isDiscardable(base, ["other.com"])).toBe(true);
  });
});
