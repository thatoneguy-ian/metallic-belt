# Project Research Summary

## Key Findings

**Stack:** Chrome Extension API (Manifest V3) as the bridge; ES Modules (`type: "module"`) on the Foundry VTT side. Vanilla JS `MutationObserver` on D&D Beyond. Extension messaging or WebSockets for cross-tab communication.
**Table Stakes:** Bi-directional HP sync, dice roll forwarding from D&D Beyond to Foundry, and initial character import.
**Watch Out For:** React state desync (DOM manipulation isn't enough; you must simulate clicks or intercept networks); infinite update loops when doing two-way sync; Manifest V3 service worker lifecycle (sleeping background scripts).

## Starting Point (Existing Codebase)

The current repository already has the foundational scaffolding:
- **Chrome Extension:** `manifest.json` (V3) is configured. `content.js`, `background.js`, and `shim.js` are present and set up to inject into `https://*.dndbeyond.com/*`.
- **Foundry Module:** `module.json` is set up with ES modules, pointing to `scripts/main.js`.
- **Testing:** `package.json` includes `vitest` and `jsdom` for testing.

These existing pieces form the skeleton. The upcoming phases will focus on fleshing out the communication bridge and implementing the synchronization logic on top of this scaffolding.

## Implications for Roadmap
- **Phase 1:** Solidify the cross-tab communication bridge between the existing extension scaffolding and the Foundry module.
- **Phase 2:** Implement robust handlers on D&D Beyond for one-way sync (Beyond -> Foundry).
- **Phase 3:** Implement the reverse sync (Foundry -> Beyond), actively mitigating the "infinite loop" and "React state desync" pitfalls.

## Sources
- `STACK.md`
- `FEATURES.md`
- `ARCHITECTURE.md`
- `PITFALLS.md`
- Codebase Map (`.planning/codebase/`)
