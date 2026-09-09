/**
 * NeuroSpeech Companion Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["practiceCount", "streakDays"]);
  if (data.practiceCount === undefined) {
    await chrome.storage.local.set({
      practiceCount: 0,
      streakDays: 1,
      targetAccuracyPct: 95.4,
      serverUrl: "http://127.0.0.1:8000",
      portalUrl: "http://127.0.0.1:5174",
    });
  }
  console.log("NeuroSpeech Extension installed successfully.");
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_EXTENSION_INFO") {
    sendResponse({
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name,
    });
    return false;
  }
  return false;
});
