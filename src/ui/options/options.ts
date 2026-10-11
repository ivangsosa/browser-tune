import "./options.css";
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
    label.append(input, ` ${rs.label}`);
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
  if (!s.capabilities.dnr) missing.push("domain blocking unavailable");
  if (!s.capabilities.tabDiscard) missing.push("tab discard unavailable");
  statusEl.textContent =
    missing.length > 0 ? `Unavailable: ${missing.join(", ")}` : "";
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

function showResult(res: ApplyResponse): void {
  if (!res.ok) {
    statusEl.textContent = `Error: ${res.error ?? "unknown"}`;
    return;
  }
  const sum = res.summary;
  statusEl.textContent = sum
    ? `Applied: +${sum.rulesAdded} −${sum.rulesRemoved} rules` +
      (sum.unavailable.length ? ` · unavailable: ${sum.unavailable.join(",")}` : "")
    : "Applied";
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

void refresh();
