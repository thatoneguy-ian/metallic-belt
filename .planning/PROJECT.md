# D&D Beyond Foundry Bridge

A Chrome Companion Extension and Foundry VTT module that bridges character sheets, enabling seamless two-way synchronization between D&D Beyond and Foundry VTT.

## Core Value
Players can use their purchased D&D Beyond content to manage characters while playing in Foundry VTT, with changes in either platform automatically reflecting in the other.

## Requirements

### Validated
- ✓ Split architecture (Chrome Extension + Foundry VTT module) — existing
- ✓ D&D Beyond DOM extraction and interaction scripts (`content.js`, `shim.js`) — existing
- ✓ Foundry VTT integration entry points (`scripts/main.js`) — existing

### Active
- [ ] Establish two-way synchronization of character state (HP, spell slots, conditions, etc.) between D&D Beyond and Foundry VTT.
- [ ] Synchronize dice rolls made in D&D Beyond to the Foundry VTT chat.
- [ ] Support character creation/leveling in D&D Beyond with seamless import/usage in Foundry VTT.

### Out of Scope
- Replacing the Foundry VTT combat tracker entirely — we are only syncing the character sheet state, not re-writing Foundry's core VTT mechanics.
- A fully embedded (iframe) UI experience — the user specifically requested a two-tab companion extension experience.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Two-Way Sync** | Ensures actions in Foundry (e.g., taking damage) update the master D&D Beyond character sheet. | — Pending |
| **Two-Tab Experience** | Provides the best use of screen real estate and avoids iframe cross-origin blocking issues. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-24 after initialization*
