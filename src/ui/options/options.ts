import "./options.css";
import { initI18n, localizePage, setLanguage, t } from "../i18n";
import { AVAILABLE_RULESETS } from "../../data/default-profiles";
import { AUTO_LANGUAGE, LANGUAGES } from "../../core/languages";
import { MAX_BLOCKED_DOMAINS } from "../../core/settings";
import { deriveProfileId } from "../../core/profiles";
import { analyzeDomainInput, BLOCKABLE_RESOURCE_TYPES } from "../../core/validation";
import type {
  ApplyResponse,
  BgRequest,
  StateResponse
} from "../../core/messages";
import type {
  ExtensionSettings,
  ProfileId,
  ResourceType
} from "../../core/types";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const languageEl = $<HTMLSelectElement>("language");
const profileEl = $<HTMLSelectElement>("profile");
const blockingEnabledEl = $<HTMLInputElement>("blocking-enabled");
const rulesetsEl = $<HTMLElement>("rulesets");
const blockedEl = $<HTMLTextAreaElement>("blocked-domains");
const blockedInfoEl = $<HTMLElement>("blocked-info");
const typesEl = $<HTMLElement>("resource-types");
const excludedEl = $<HTMLTextAreaElement>("excluded-domains");
const excludedInfoEl = $<HTMLElement>("excluded-info");
const discardEnabledEl = $<HTMLInputElement>("discard-enabled");
const minutesEl = $<HTMLInputElement>("inactive-minutes");
const discardExcludedEl = $<HTMLTextAreaElement>("discard-excluded");
const discardInfoEl = $<HTMLElement>("discard-info");
const exportBtn = $<HTMLButtonElement>("export");
const downloadBtn = $<HTMLButtonElement>("download");
const importFileEl = $<HTMLInputElement>("import-file");
const exportJsonEl = $<HTMLTextAreaElement>("export-json");
const importBtn = $<HTMLButtonElement>("import");
const importJsonEl = $<HTMLTextAreaElement>("import-json");
const saveBtn = $<HTMLButtonElement>("save");
const revertBtn = $<HTMLButtonElement>("revert");
const unsavedEl = $<HTMLElement>("unsaved");
const statusEl = $<HTMLParagraphElement>("status");
const errorBoxEl = $<HTMLElement>("error-box");
const errorTextEl = $<HTMLElement>("error-text");
const retryBtn = $<HTMLButtonElement>("retry");
const tipsEl = $<HTMLUListElement>("browser-tips");
const activityListEl = $<HTMLUListElement>("activity-list");
const clearActivityBtn = $<HTMLButtonElement>("clear-activity");

const PROFILE_KEYS: Record<ProfileId, string> = {
  balanced: "profileBalanced",
  "low-resource": "profileLowResource",
  privacy: "profilePrivacy",
  custom: "profileCustom"
};

const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtStamp = (ts: number): string =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

function formatActivity(e: StateResponse["activityLog"][number]): string {
  switch (e.kind) {
    case "apply":
      return t("logApply", [String(e.added ?? 0), String(e.removed ?? 0)]);
    case "profile":
      return t(
        "logProfile",
        t(PROFILE_KEYS[(e.profile as ProfileId) ?? "custom"])
      );
    case "import":
      return t("logImport");
    case "pause":
      return t("logPause", [e.domain ?? "?", fmtTime(e.until ?? 0)]);
    case "resume":
      return t("logResume", e.domain ?? "?");
    case "discard":
      return t("logDiscard", String(e.count ?? 0));
    case "error":
      return t("logError", e.error ?? "unknown");
  }
}

function renderActivity(entries: StateResponse["activityLog"]): void {
  activityListEl.replaceChildren();
  if (entries.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = t("emptyActivity");
    activityListEl.append(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    const stamp = document.createElement("span");
    stamp.className = "stamp";
    stamp.textContent = fmtStamp(e.ts);
    li.append(stamp, ` ${formatActivity(e)}`);
    activityListEl.append(li);
  }
}

// Ajustes nativos que la extensión no puede tocar — solo se sugieren.
// internalUrl: se intenta abrir via tabs.create (si el navegador lo bloquea,
// el botón se reemplaza por texto copiable). docUrl: documentación oficial.
interface Tip {
  textKey: string;
  internalUrl?: string;
  docUrl?: string;
  braveOnly?: boolean;
}

/** Brave expone navigator.brave.isBrave(); en otros navegadores no existe. */
async function isBrave(): Promise<boolean> {
  const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
  try {
    return (await brave?.isBrave?.()) === true;
  } catch {
    return false;
  }
}

const BROWSER_TIPS: Record<"firefox" | "chromium", Tip[]> = {
  chromium: [
    {
      textKey: "tipChromiumMemorySaver",
      internalUrl: "chrome://settings/performance"
    },
    {
      textKey: "tipChromiumPreload",
      internalUrl: "chrome://settings/performance"
    },
    {
      textKey: "tipChromiumShields",
      internalUrl: "brave://settings/shields",
      braveOnly: true
    }
  ],
  firefox: [
    {
      textKey: "tipFirefoxUnload",
      docUrl: "https://support.mozilla.org/kb/about-config-editor-firefox"
    },
    {
      textKey: "tipFirefoxEtp",
      docUrl:
        "https://support.mozilla.org/kb/enhanced-tracking-protection-firefox-desktop"
    }
  ]
};

function send<R>(msg: BgRequest): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}

function lines(ta: HTMLTextAreaElement): string[] {
  return ta.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

let dirty = false;
function setDirty(v: boolean): void {
  dirty = v;
  unsavedEl.hidden = !v;
}

function showError(message: string | null): void {
  errorBoxEl.hidden = message === null;
  errorTextEl.textContent = message === null ? "" : t("errorPrefix", message);
}

function renderLanguages(current: string): void {
  languageEl.replaceChildren();
  const auto = document.createElement("option");
  auto.value = AUTO_LANGUAGE;
  auto.textContent = t("languageAuto");
  languageEl.append(auto);
  for (const l of LANGUAGES) {
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = l.name;
    languageEl.append(o);
  }
  languageEl.value = current;
}

function renderRulesets(enabled: string[]): void {
  rulesetsEl.replaceChildren();
  for (const rs of AVAILABLE_RULESETS) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = rs.id;
    input.checked = enabled.includes(rs.id);
    input.dataset.ruleset = rs.id;
    label.append(input, ` ${t(rs.labelKey)}`);
    rulesetsEl.append(label);
  }
}

function renderResourceTypes(selected: ResourceType[]): void {
  typesEl.replaceChildren();
  for (const type of BLOCKABLE_RESOURCE_TYPES) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = type;
    input.checked = selected.includes(type);
    input.dataset.resourceType = type;
    label.append(input, ` ${t(`resType_${type}`)}`);
    typesEl.append(label);
  }
}

function renderTips(tips: Tip[]): void {
  tipsEl.replaceChildren();
  for (const tip of tips) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = t(tip.textKey);
    li.append(span, " ");
    if (tip.internalUrl) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tip-action";
      btn.textContent = t("openSettings");
      btn.addEventListener("click", async () => {
        try {
          await chrome.tabs.create({ url: tip.internalUrl! });
        } catch {
          // Navegador bloqueó la URL interna: dejar el texto copiable.
          const code = document.createElement("code");
          code.textContent = tip.internalUrl!;
          btn.replaceWith(code);
        }
      });
      li.append(btn, " ");
    }
    if (tip.docUrl) {
      const a = document.createElement("a");
      a.href = tip.docUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = t("learnMore");
      li.append(a);
    }
    tipsEl.append(li);
  }
}

/** Feedback de validación bajo un textarea de dominios (líneas ignoradas / tope). */
function updateInfo(
  ta: HTMLTextAreaElement,
  info: HTMLElement,
  max?: number
): void {
  const { valid, invalid } = analyzeDomainInput(lines(ta));
  const parts: string[] = [];
  info.classList.remove("has-invalid", "over-limit");
  if (max !== undefined) {
    parts.push(t("domainsUsed", [String(valid.length), String(max)]));
    if (valid.length > max) {
      info.classList.add("over-limit");
      parts.push(t("domainsOverLimit", String(max)));
    }
  } else {
    parts.push(t("domainsCount", String(valid.length)));
  }
  if (invalid.length > 0) {
    info.classList.add("has-invalid");
    const sample = invalid.slice(0, 3).join(", ") + (invalid.length > 3 ? "…" : "");
    parts.push(t("invalidLines", [String(invalid.length), sample]));
  }
  info.textContent = parts.join(" · ");
}

function updateAllInfo(): void {
  updateInfo(blockedEl, blockedInfoEl, MAX_BLOCKED_DOMAINS);
  updateInfo(excludedEl, excludedInfoEl);
  updateInfo(discardExcludedEl, discardInfoEl);
}

let brave = false;

function render(s: StateResponse): void {
  profileEl.value = s.derivedProfile;
  blockingEnabledEl.checked = s.settings.blocking.enabled;
  renderRulesets(s.settings.blocking.enabledRulesets);
  renderResourceTypes(s.settings.blocking.resourceTypes);
  blockedEl.value = s.settings.blocking.blockedDomains.join("\n");
  excludedEl.value = s.settings.blocking.excludedDomains.join("\n");
  discardEnabledEl.checked = s.settings.tabDiscard.enabled;
  minutesEl.value = String(s.settings.tabDiscard.inactiveMinutes);
  discardExcludedEl.value = s.settings.tabDiscard.excludedDomains.join("\n");
  updateAllInfo();
  setDirty(false);

  const missing: string[] = [];
  if (!s.capabilities.dnr) missing.push(t("unavailableDnr"));
  if (!s.capabilities.tabDiscard) missing.push(t("unavailableDiscard"));
  statusEl.textContent =
    missing.length > 0 ? t("unavailablePrefix", missing.join(", ")) : "";
  showError(s.lastError);

  renderTips(
    BROWSER_TIPS[s.capabilities.isFirefox ? "firefox" : "chromium"].filter(
      (tip) => brave || !tip.braveOnly
    )
  );
  renderActivity(s.activityLog);
}

function collectSettings(base: ExtensionSettings): ExtensionSettings {
  const checked = (root: HTMLElement, attr: string) =>
    [...root.querySelectorAll<HTMLInputElement>(`input[data-${attr}]`)]
      .filter((i) => i.checked)
      .map((i) => i.value);
  const s: ExtensionSettings = {
    ...base,
    schemaVersion: 1,
    blocking: {
      enabled: blockingEnabledEl.checked,
      enabledRulesets: checked(rulesetsEl, "ruleset"),
      blockedDomains: lines(blockedEl),
      excludedDomains: lines(excludedEl),
      resourceTypes: checked(typesEl, "resource-type") as ResourceType[]
    },
    tabDiscard: {
      enabled: discardEnabledEl.checked,
      inactiveMinutes: Number(minutesEl.value) || 30,
      excludedDomains: lines(discardExcludedEl)
    }
  };
  return { ...s, profile: deriveProfileId(s) };
}

function showResult(res: ApplyResponse): void {
  if (!res.ok) {
    statusEl.textContent = "";
    showError(res.error ?? "unknown");
    return;
  }
  showError(null);
  const sum = res.summary;
  statusEl.textContent = sum
    ? t("appliedDiff", [String(sum.rulesAdded), String(sum.rulesRemoved)]) +
      (sum.unavailable.length
        ? ` · ${t("unavailablePrefix", sum.unavailable.join(","))}`
        : "")
    : t("appliedPlain");
}

let state: StateResponse | null = null;

async function refresh(): Promise<void> {
  state = await send<StateResponse>({ type: "getState" });
  render(state);
}

async function apply(msg: BgRequest): Promise<void> {
  const res = await send<ApplyResponse>(msg);
  await refresh();
  showResult(res);
}

languageEl.addEventListener("change", async () => {
  await setLanguage(languageEl.value);
  location.reload();
});

profileEl.addEventListener("change", () => {
  void apply({ type: "setProfile", profile: profileEl.value as ProfileId });
});

saveBtn.addEventListener("click", () => {
  if (state) {
    void apply({ type: "saveSettings", settings: collectSettings(state.settings) });
  }
});

revertBtn.addEventListener("click", () => {
  void refresh();
});

clearActivityBtn.addEventListener("click", () => {
  void apply({ type: "clearActivity" });
});

retryBtn.addEventListener("click", () => {
  void apply({ type: "reapply" });
});

exportBtn.addEventListener("click", () => {
  if (state) exportJsonEl.value = JSON.stringify(state.settings, null, 2);
});

downloadBtn.addEventListener("click", () => {
  if (!state) return;
  const blob = new Blob([JSON.stringify(state.settings, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "browser-tune-settings.json";
  a.click();
  URL.revokeObjectURL(url);
});

importFileEl.addEventListener("change", async () => {
  const file = importFileEl.files?.[0];
  if (!file) return;
  importJsonEl.value = await file.text();
  importFileEl.value = "";
  void apply({ type: "importSettings", json: importJsonEl.value });
});

importBtn.addEventListener("click", () => {
  void apply({ type: "importSettings", json: importJsonEl.value });
});

for (const ta of [blockedEl, excludedEl, discardExcludedEl]) {
  ta.addEventListener("input", updateAllInfo);
}
for (const el of [
  blockingEnabledEl,
  blockedEl,
  excludedEl,
  discardEnabledEl,
  minutesEl,
  discardExcludedEl,
  rulesetsEl,
  typesEl
]) {
  el.addEventListener("input", () => setDirty(true));
  el.addEventListener("change", () => setDirty(true));
}

window.addEventListener("beforeunload", (e) => {
  if (dirty) e.preventDefault();
});

void (async () => {
  const choice = await initI18n();
  localizePage();
  renderLanguages(choice);
  brave = await isBrave();
  await refresh();
})();
