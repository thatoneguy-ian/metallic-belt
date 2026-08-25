# Roadmap

## Phase 1: Foundation & Initial Import

**Goal:** Establish the basic bridge architecture and enable character import.
**Requirements:** BRIDGE-01, CHAR-01

- [ ] Setup Chrome Extension messaging ports with the background worker.
- [ ] Connect Foundry VTT module to the extension's background worker.
- [ ] Implement character JSON extraction from D&D Beyond.
- [ ] Map extracted data to Foundry VTT 5e Actor format.
- [ ] Trigger actor creation/update in Foundry.

## Phase 2: One-Way Roll Sync (Beyond -> Foundry)

**Goal:** Send dice rolls from D&D Beyond to the Foundry VTT chat log.
**Requirements:** SYNC-01

- [ ] Implement `MutationObserver` on D&D Beyond to detect roll overlays/results.
- [ ] Parse roll formula and result from the DOM.
- [ ] Transmit roll data payload to Foundry.
- [ ] Create `ChatMessage` in Foundry using the payload data.

## Phase 3: One-Way HP Sync (Beyond -> Foundry)

**Goal:** When HP changes on D&D Beyond, update the Foundry Actor's health.
**Requirements:** SYNC-02

- [ ] Detect HP change events on the D&D Beyond sheet (network interception or mutation observer).
- [ ] Map D&D Beyond HP format to Foundry `system.attributes.hp.value`.
- [ ] Transmit HP update payload to Foundry.
- [ ] Call `Actor.update()` in Foundry.

## Phase 4: Two-Way HP Sync (Foundry -> Beyond)

**Goal:** When HP changes in Foundry, update the D&D Beyond sheet, avoiding infinite loops.
**Requirements:** SYNC-03

- [ ] Hook `updateActor` in Foundry to detect HP changes.
- [ ] Check origin flag to prevent echoing an update back to D&D Beyond.
- [ ] Transmit HP update payload from Foundry to Chrome background to D&D Beyond tab.
- [ ] Execute script in D&D Beyond context to simulate clicks/update React state for HP.
- [ ] Add visual feedback (toast/notification) of sync success.

### Phase 5: Repair: parse fix, v14 compatibility, stale tests

**Goal:** Restore the bridge to a working, installable, testable state after commit `db1ad7d` — `content.js` parses, the module installs and enables on Foundry 14.367, and the full test suite is green.
**Requirements**: BRIDGE-01, CHAR-01, SYNC-01, SYNC-02, SYNC-03 (restored to working, not newly introduced)
**Depends on:** Phase 4
**Plans:** 1/1 plans executed

Plans:

- [x] 05-01-PLAN.md — Close the unbalanced `try` brace in `content.js` (D-01), widen `module.json` compatibility to the Foundry 14 generation ceiling (D-02), and update the five stale `router.test.js` assertions to the two-argument form (D-03)
