import { loadSettings, saveSettings } from "../platform/storage";
import { applySettings } from "./apply-profile";

// onInstalled/onStartup: migrar/persistir settings y re-aplicar el estado
// deseado. Todo se reconstruye desde storage — nada depende de memoria del SW.
async function restoreAndApply(): Promise<void> {
  const settings = await loadSettings();
  await applySettings(settings);
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const settings = await loadSettings();
    if (details.reason === "install" || details.reason === "update") {
      await saveSettings(settings);
    }
    await applySettings(settings);
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void restoreAndApply();
});
