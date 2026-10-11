import "./options.css";
import { localizePage, t } from "../i18n";
import { AVAILABLE_RULESETS } from "../../data/default-profiles";
import type {
  ApplyResponse,
  BgRequest,
  StateResponse
} from "../../core/messages";
import type { ExtensionSettings, ProfileId } from "../../core/types";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const profileEl = $<HTMLSelectElement>("profile");
const blockingEnabledEl = $<HTMLInputElement>("blocking-enabled");
const rulesetsEl = $<HTMLElement>("rulesets");
const blockedEl = $<HTMLTextAreaElement>("blocked-domains");
const excludedEl = $<HTMLTextAreaElement>("excluded-domains");
const discardEnabledEl = $<HTMLInputElement>("discard-enabled");
const minutesEl = $<HTMLInputElement>("inactive-minutes");
const discardExcludedEl = $<HTMLTextAreaElement>("discard-excluded");
const exportBtn = $<HTMLButtonElement>("export");
const exportJsonEl = $<HTMLTextAreaElement>("export-json");
const importBtn = $<HTMLButtonElement>("import");
const importJsonEl = $<HTMLTextAreaElement>("import-json");
const saveBtn = $<HTMLButtonElement>("save");
const statusEl = $<HTMLParagraphElement>("status");
const tipsEl = $<HTMLUListElement>("browser-tips");

// Ajustes nativos que la extensión no puede tocar — solo se sugieren.
// internalUrl: se intenta abrir via tabs.create (si el navegador lo bloquea,
// el botón se reemplaza por texto copiable). docUrl: documentación oficial.
interface Tip {
  textKey: string;
  internalUrl?: string;
  docUrl?: string;
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
    { textKey: "tipChromiumShields", internalUrl: "brave://settings/shields" }
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

function render(s: StateResponse): void {
  profileEl.value = s.derivedProfile;
  blockingEnabledEl.checked = s.settings.blocking.enabled;
  renderRulesets(s.settings.blocking.enabledRulesets);
  blockedEl.value = s.settings.blocking.blockedDomains.join("\n");
  excludedEl.value = s.settings.blocking.excludedDomains.join("\n");
  discardEnabledEl.checked = s.settings.tabDiscard.enabled;
  minutesEl.value = String(s.settings.tabDiscard.inactiveMinutes);
  discardExcludedEl.value = s.settings.tabDiscard.excludedDomains.join("\n");

  const missing: string[] = [];
  if (!s.capabilities.dnr) missing.push(t("unavailableDnr"));
  if (!s.capabilities.tabDiscard) missing.push(t("unavailableDiscard"));
  statusEl.textContent =
    missing.length > 0 ? t("unavailablePrefix", missing.join(", ")) : "";

  renderTips(BROWSER_TIPS[s.capabilities.isFirefox ? "firefox" : "chromium"]);
}

function collectSettings(base: ExtensionSettings): ExtensionSettings {
  const enabledRulesets = [
    ...rulesetsEl.querySelectorAll<HTMLInputElement>("input[data-ruleset]")
  ]
    .filter((i) => i.checked)
    .map((i) => i.dataset.ruleset!);
  return {
    ...base,
    schemaVersion: 1,
    profile: "custom",
    blocking: {
      enabled: blockingEnabledEl.checked,
      enabledRulesets,
      blockedDomains: lines(blockedEl),
      excludedDomains: lines(excludedEl)
    },
    tabDiscard: {
      enabled: discardEnabledEl.checked,
      inactiveMinutes: Number(minutesEl.value) || 30,
      excludedDomains: lines(discardExcludedEl)
    }
  };
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

function showResult(res: ApplyResponse): void {
  if (!res.ok) {
    statusEl.textContent = t("errorPrefix", res.error ?? "unknown");
    return;
  }
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

profileEl.addEventListener("change", async () => {
  const res = await send<ApplyResponse>({
    type: "setProfile",
    profile: profileEl.value as ProfileId
  });
  showResult(res);
  await refresh();
});

saveBtn.addEventListener("click", async () => {
  if (!state) return;
  showResult(
    await send<ApplyResponse>({
      type: "saveSettings",
      settings: collectSettings(state.settings)
    })
  );
  await refresh();
});

exportBtn.addEventListener("click", () => {
  if (!state) return;
  exportJsonEl.value = JSON.stringify(state.settings, null, 2);
});

importBtn.addEventListener("click", async () => {
  const res = await send<ApplyResponse>({
    type: "importSettings",
    json: importJsonEl.value
  });
  showResult(res);
  await refresh();
});

localizePage();
void refresh();
