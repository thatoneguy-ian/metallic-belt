# Requirements

## v1 Requirements

### Core Bridge

- [x] **BRIDGE-01**: Establish a reliable two-way messaging channel between the D&D Beyond tab and the Foundry VTT tab via the Chrome Extension background worker.

### Character Management

- [x] **CHAR-01**: User can perform an initial import of their D&D Beyond character (stats, basic inventory, spells) into a Foundry VTT actor.

### One-Way Sync (Beyond -> Foundry)

- [x] **SYNC-01**: Dice rolls initiated on the D&D Beyond character sheet appear seamlessly in the Foundry VTT chat log.
- [x] **SYNC-02**: Changes to HP (damage/healing) on D&D Beyond update the corresponding Foundry VTT actor's health.

### Two-Way Sync (Foundry -> Beyond)

- [x] **SYNC-03**: Changes to HP (damage/healing) on the Foundry VTT actor update the D&D Beyond character sheet UI and underlying state.

## v2 Requirements (Deferred)

- [ ] **SYNC-04**: Sync conditions and exhaustion levels bi-directionally.
- [ ] **SYNC-05**: Sync spell slot and limited use feature usage bi-directionally.

## Out of Scope

- Full map/VTT rendering inside D&D Beyond — The goal is a two-tab experience, not an embedded VTT.
- Replacing the Foundry VTT combat tracker — Foundry's core mechanics will remain in Foundry.

## Traceability

*(To be filled by roadmap)*
