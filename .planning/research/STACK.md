# Stack Research

## Standard 2025 Stack for VTT Bridges
- **Extension Framework:** Chrome Extension API (Manifest V3) — Required for modern browsers.
- **VTT Side:** ES Modules (`type: "module"`) injected via Foundry VTT's `Hooks` API.
- **Communication:** WebSockets (via an intermediate relay server) or peer-to-peer WebRTC if avoiding central servers, though many use simple HTTP polling/webhooks if Foundry is exposed, or extension messaging if both are open in the same browser.
- **Testing:** Vitest and JSdom for mocking extension APIs and DOM traversal.
- **DOM Parsing:** Vanilla JS `MutationObserver` to watch for HP/roll changes in D&D Beyond.

## Rationale
- MV3 is strictly enforced now.
- `MutationObserver` is the most robust way to detect React-driven DOM changes on D&D Beyond without reverse-engineering their private GraphQL endpoints, though intercepting API calls via `declarativeNetRequest` is a powerful alternative for extracting raw JSON.
