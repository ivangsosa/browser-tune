import "./popup.css";
import { localizePage, t } from "../i18n";
import type {
  ApplyResponse,
  BgRequest,
  StateResponse
} from "../../core/messages";
import type { ExtensionSettings, ProfileId } from "../../core/types";

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const profileEl = $<HTMLSelectElement>("profile");
const blockingEl = $<HTMLInputElement>("blocking");
const discardEl = $<HTMLInputElement>("discard");
const statusEl = $<HTMLParagraphElement>("status");
const warningsEl = $<HTMLParagraphElement>("warnings");
const optionsBtn = $<HTMLButtonElement>("open-options");

function send<R>(msg: BgRequest): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}

let state: StateResponse | null = null;

function render(s: StateResponse): void {
  state = s;
  profileEl.value = s.derivedProfile;
  blockingEl.checked = s.settings.blocking.enabled;
  discardEl.checked = s.settings.tabDiscard.enabled;
  statusEl.textContent = t("activeRules", String(s.managedRuleCount));

  const missing: string[] = [];
  if (!s.capabilities.dnr) missing.push(t("unavailableDnr"));
  if (!s.capabilities.tabDiscard) missing.push(t("unavailableDiscard"));
  warningsEl.textContent = missing.join(" · ");
}

function renderApplyResult(res: ApplyResponse): void {
  if (!res.ok) {
    statusEl.textContent = t("errorPrefix", res.error ?? "unknown");
    return;
  }
  const sum = res.summary;
  statusEl.textContent = sum
    ? t("appliedDiff", [String(sum.rulesAdded), String(sum.rulesRemoved)])
    : t("appliedPlain");
}

async function refresh(): Promise<void> {
  render(await send<StateResponse>({ type: "getState" }));
}

profileEl.addEventListener("change", async () => {
  const res = await send<ApplyResponse>({
    type: "setProfile",
    profile: profileEl.value as ProfileId
  });
  renderApplyResult(res);
  await refresh();
});

function updateSettings(patch: Partial<ExtensionSettings>): void {
  if (!state) return;
  const settings: ExtensionSettings = {
    ...state.settings,
    ...patch,
    profile: "custom"
  };
  void send<ApplyResponse>({ type: "saveSettings", settings }).then(
    (res) => {
      renderApplyResult(res);
      void refresh();
    }
  );
}

blockingEl.addEventListener("change", () => {
  if (!state) return;
  updateSettings({
    blocking: { ...state.settings.blocking, enabled: blockingEl.checked }
  });
});

discardEl.addEventListener("change", () => {
  if (!state) return;
  updateSettings({
    tabDiscard: { ...state.settings.tabDiscard, enabled: discardEl.checked }
  });
});

optionsBtn.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

localizePage();
void refresh();
