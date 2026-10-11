import "./popup.css";
import { initI18n, localizePage, t } from "../i18n";
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
const siteEl = $<HTMLElement>("site");
const siteHostEl = $<HTMLElement>("site-host");
const excludeBlockingBtn = $<HTMLButtonElement>("exclude-blocking");
const excludeDiscardBtn = $<HTMLButtonElement>("exclude-discard");
const pauseControlsEl = $<HTMLElement>("pause-controls");
const pausesBoxEl = $<HTMLElement>("pauses-box");
const pausesListEl = $<HTMLUListElement>("pauses-list");
const pauseMinutesEl = $<HTMLSelectElement>("pause-minutes");
const pauseBtn = $<HTMLButtonElement>("pause");
const discardedCountEl = $<HTMLParagraphElement>("discarded-count");
const discardNowBtn = $<HTMLButtonElement>("discard-now");
const errorBoxEl = $<HTMLElement>("error-box");
const errorTextEl = $<HTMLElement>("error-text");
const retryBtn = $<HTMLButtonElement>("retry");

function send<R>(msg: BgRequest): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}

let state: StateResponse | null = null;
let host: string | null = null;

/** Hostname de la pestaña activa (solo http/https), o null. Lectura únicamente. */
async function currentHost(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url ?? "");
    return /^https?:$/.test(url.protocol) ? url.hostname : null;
  } catch {
    return null;
  }
}

function showError(message: string | null): void {
  errorBoxEl.hidden = message === null;
  errorTextEl.textContent = message === null ? "" : t("errorPrefix", message);
}

function renderSite(s: StateResponse): void {
  siteEl.hidden = host === null;
  if (host === null) return;
  siteHostEl.textContent = host;
  const pausedHere = s.pauses.some(
    (p) => host === p.domain || host?.endsWith(`.${p.domain}`)
  );
  pauseControlsEl.hidden = pausedHere;
  pauseBtn.disabled = !s.capabilities.dnr;
  excludeBlockingBtn.disabled = !s.capabilities.dnr;
  excludeDiscardBtn.disabled = !s.capabilities.tabDiscard;
}

function render(s: StateResponse): void {
  state = s;
  profileEl.value = s.derivedProfile;
  blockingEl.checked = s.settings.blocking.enabled;
  discardEl.checked = s.settings.tabDiscard.enabled;
  statusEl.textContent = t("activeRules", String(s.managedRuleCount));
  discardedCountEl.textContent = t("discardedTabs", String(s.discardedTabs));
  discardNowBtn.disabled = !s.capabilities.tabDiscard;

  const missing: string[] = [];
  if (!s.capabilities.dnr) missing.push(t("unavailableDnr"));
  if (!s.capabilities.tabDiscard) missing.push(t("unavailableDiscard"));
  warningsEl.textContent = missing.join(" · ");

  showError(s.lastError);
  renderSite(s);
  renderPauses(s);
}

function renderPauses(s: StateResponse): void {
  pausesBoxEl.hidden = s.pauses.length === 0;
  pausesListEl.replaceChildren();
  for (const pause of s.pauses) {
    const until = new Date(pause.until).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "host";
    span.textContent = `${pause.domain} — ${t("pausedUntil", until)} `;
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "tip-action";
    resume.textContent = t("resumeBlocking");
    resume.addEventListener("click", () => {
      void run({ type: "resumeSite", domain: pause.domain });
    });
    li.append(span, resume);
    pausesListEl.append(li);
  }
}

function renderApplyResult(res: ApplyResponse): void {
  if (!res.ok) {
    showError(res.error ?? "unknown");
    return;
  }
  showError(null);
  const sum = res.summary;
  statusEl.textContent = sum
    ? t("appliedDiff", [String(sum.rulesAdded), String(sum.rulesRemoved)])
    : t("appliedPlain");
}

async function refresh(): Promise<void> {
  render(await send<StateResponse>({ type: "getState" }));
}

async function run(msg: BgRequest): Promise<ApplyResponse> {
  const res = await send<ApplyResponse>(msg);
  renderApplyResult(res);
  await refresh();
  return res;
}

profileEl.addEventListener("change", () => {
  void run({ type: "setProfile", profile: profileEl.value as ProfileId });
});

function updateSettings(patch: Partial<ExtensionSettings>): void {
  if (!state) return;
  const settings: ExtensionSettings = {
    ...state.settings,
    ...patch,
    profile: "custom"
  };
  void run({ type: "saveSettings", settings });
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

excludeBlockingBtn.addEventListener("click", () => {
  if (host) void run({ type: "excludeSite", scope: "blocking", domain: host });
});

excludeDiscardBtn.addEventListener("click", () => {
  if (host) void run({ type: "excludeSite", scope: "discard", domain: host });
});

pauseBtn.addEventListener("click", () => {
  if (host) {
    void run({
      type: "pauseSite",
      domain: host,
      minutes: Number(pauseMinutesEl.value)
    });
  }
});


discardNowBtn.addEventListener("click", async () => {
  const res = await send<ApplyResponse>({ type: "discardNow" });
  if (!res.ok) showError(res.error ?? "unknown");
  else statusEl.textContent = t("discardedNow", String(res.discarded ?? 0));
  const s = await send<StateResponse>({ type: "getState" });
  const message = statusEl.textContent;
  render(s);
  if (res.ok) statusEl.textContent = message;
});

retryBtn.addEventListener("click", () => {
  void run({ type: "reapply" });
});

optionsBtn.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void (async () => {
  await initI18n();
  localizePage();
  host = await currentHost();
  await refresh();
})();
