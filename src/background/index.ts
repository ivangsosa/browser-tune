import { loadSettings, saveSettings } from "../platform/storage";

// Instalación: persistir defaults (o migrar settings existentes tras update).
chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const settings = await loadSettings();
    if (details.reason === "install" || details.reason === "update") {
      await saveSettings(settings);
    }
  })();
});

// El SW/event page puede reiniciarse: todo estado se reconstruye desde
// storage, no desde memoria.
chrome.runtime.onStartup.addListener(() => {
  void loadSettings();
});
