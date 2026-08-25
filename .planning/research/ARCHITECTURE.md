# Architecture Research

## Component Boundaries
1. **D&D Beyond Content Script:** Injected into D&D Beyond tabs. Uses `MutationObserver` to watch UI changes. Injects custom buttons (e.g. "Roll in Foundry").
2. **Chrome Background Service Worker:** The central router. Passes messages between the D&D Beyond tab and the Foundry tab.
3. **Foundry VTT Content Script/Module:** Receives messages from the background script. Calls Foundry's `Hooks` and `Actor.update()` API.

## Data Flow
- **D&D Beyond → Foundry:** Content script detects click -> sends message to Background worker -> sends message to Foundry tab -> Foundry module creates ChatMessage/Actor update.
- **Foundry → D&D Beyond:** Foundry module detects Actor update via `Hooks.on("updateActor")` -> sends message to Background worker -> sends message to D&D Beyond tab -> Content script clicks DOM buttons or intercepts React state to update UI.

## Suggested Build Order
1. Foundational messaging bridge (Background script connecting two tabs).
2. Foundry VTT module setup (Hooks API).
3. D&D Beyond DOM parser and observer.
4. One-way sync (Beyond -> Foundry).
5. Two-way sync (Foundry -> Beyond).
