import "./popup.css";
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
  statusEl.textContent = `Active rules: ${s.managedRuleCount}`;

  const missing: string[] = [];
  if (!s.capabilities.dnr) missing.push("domain blocking unavailable");
  if (!s.capabilities.tabDiscard) missing.push("tab discard unavailable");
  warningsEl.textContent = missing.join(" · ");
}

function renderApplyResult(res: ApplyResponse): void {
  if (!res.ok) {
    statusEl.textContent = `Error: ${res.error ?? "unknown"}`;
    return;
  }
  const sum = res.summary;
  statusEl.textContent = sum
    ? `Applied: +${sum.rulesAdded} −${sum.rulesRemoved} rules`
    : "Applied";
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

void refresh();
