/**
 * background.js - Companion Chrome Extension service worker.
 * Synchronizes the CobaltSession login cookie into the headers of subframe requests
 * to bypass browser third-party cookie blocking on unsecure parent origins.
 */

async function updateCookieRules() {
  try {
    const cookie = await chrome.cookies.get({
      url: "https://www.dndbeyond.com",
      name: "CobaltSession"
    });

    if (!cookie || !cookie.value) {
      console.log("[DDB-Bridge] No CobaltSession cookie found in browser. Clearing request injection rule.");
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [2]
      });
      return;
    }

    console.log("[DDB-Bridge] Syncing CobaltSession cookie value to subframe network requests.");

    // Rule 2: Set the Cookie header for all requests to dndbeyond.com in subframes
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [2],
      addRules: [
        {
          id: 2,
          priority: 2,
          action: {
            type: "modifyHeaders",
            requestHeaders: [
              {
                header: "Cookie",
                operation: "set",
                value: `CobaltSession=${cookie.value}`
              }
            ]
          },
          condition: {
            urlFilter: "*://*.dndbeyond.com/*",
            resourceTypes: ["sub_frame", "xmlhttprequest", "ping"]
          }
        }
      ]
    });
  } catch (err) {
    console.error("[DDB-Bridge] Error updating cookie injection rules:", err);
  }
}

// Update rules on startup and install
chrome.runtime.onInstalled.addListener(updateCookieRules);
chrome.runtime.onStartup.addListener(updateCookieRules);

// Listen to cookie changes (e.g. logging in / out)
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (
    changeInfo.cookie.domain.includes("dndbeyond.com") &&
    changeInfo.cookie.name === "CobaltSession"
  ) {
    console.log("[DDB-Bridge] D&D Beyond session cookie updated.");
    updateCookieRules();
  }
});


