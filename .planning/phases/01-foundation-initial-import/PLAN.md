# Phase 1: Foundation & Initial Import

We will establish a two-tab communication bridge between the D&D Beyond tab and the Foundry VTT tab, replacing the old iframe-based approach.

## Proposed Changes

### Chrome Extension

#### [MODIFY] manifest.json
- Add `"<all_urls>"` to `host_permissions` so we can inject into any tab running Foundry VTT.
- Add `foundry-content.js` to `content_scripts` with `matches: ["<all_urls>"]`.

#### [NEW] foundry-content.js
- Injected into all pages.
- Listens for `window.postMessage` from the Foundry module (`source: "ddb-bridge-foundry"`).
- Relays these messages to the background script using `chrome.runtime.sendMessage`.
- Listens for messages from the background script using `chrome.runtime.onMessage.addListener` and relays them to the Foundry module via `window.postMessage`.

#### [MODIFY] background.js
- Add a `chrome.runtime.onMessage` listener to act as a message router.
- When receiving a message from D&D Beyond (`source: "ddb-bridge-extension"`), forward it to the Foundry tab(s).
- When receiving a message from Foundry (`source: "ddb-bridge-foundry"`), forward it to the D&D Beyond tab(s).
- To track which tab is which, we will broadcast messages to all active tabs that match the intended recipient.

#### [MODIFY] content.js
- Change `window.parent.postMessage` to `chrome.runtime.sendMessage`.
- Change `window.addEventListener("message", ...)` to `chrome.runtime.onMessage.addListener(...)`.
- Keep all parsing and scraping logic intact.

### Foundry Module

#### [MODIFY] scripts/main.js
- Remove the dependency on `DDBEmbeddedSheet` and iframe elements.
- When sending a message (e.g., `REQUEST_DDB_JSON`), send it to `window.postMessage` instead of `iframe.contentWindow`.
- Keep the `window.addEventListener("message")` for receiving incoming messages, as `foundry-content.js` will relay them via `window.postMessage`.

## Verification Plan
1. Ensure the Foundry module is active.
2. Call `syncActorFromDDB(actor)` in the Foundry console to verify that the message reaches D&D Beyond and the JSON response comes back successfully to update the actor.
