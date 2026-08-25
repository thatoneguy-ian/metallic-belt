# Pitfalls Research

## Common Mistakes
1. **D&D Beyond React State Desync:** Forcing a DOM change (like changing an HP text node) won't update the underlying React state on D&D Beyond. 
   *Prevention:* You must simulate actual user clicks (e.g., clicking the HP box, typing, and hitting enter) or intercept network requests.
2. **Infinite Update Loops:** Foundry updates Beyond -> Beyond DOM changes -> triggers observer -> updates Foundry -> etc.
   *Prevention:* Include an `origin: "vtt"` flag in update payloads. Ignore updates that originated from the target system.
3. **Foundry Version Breakage:** Relying on private Foundry APIs that change between v11, v12, and v13.
   *Prevention:* Strictly use public API methods like `Actor.update()` and `ChatMessage.create()`.
4. **Manifest V3 Service Worker Sleeping:** The background script will sleep after 30 seconds of inactivity, potentially dropping cross-tab messages.
   *Prevention:* Ensure the background script is awakened properly or use a persistent connection technique (like long-lived ports `chrome.runtime.connect`).
