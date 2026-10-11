chrome.runtime.onInstalled.addListener((details) => {
  console.info("browser-tune instalado:", details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.info("browser-tune: arranque del navegador");
});
