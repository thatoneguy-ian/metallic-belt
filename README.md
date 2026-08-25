# D&D Beyond Foundry Bridge

A Chrome Companion Extension and Foundry VTT module that bridges character sheets, enabling
two-way synchronization between D&D Beyond and Foundry VTT.

Players use their purchased D&D Beyond content to manage characters while playing in Foundry VTT,
with changes in either platform automatically reflecting in the other.

> **Status:** proof of concept. Fast, minimal repairs over polish — see `.planning/codebase/CONCERNS.md`
> for known open items (security hardening around the embedded-iframe messaging is intentionally
> deferred, not overlooked).

## How it works

- **`chrome-extension/`** — runs on the D&D Beyond character sheet, embeds it in Foundry VTT via
  an iframe, and relays roll/state events between the two.
- **`scripts/`, `styles/`, `templates/`** — the Foundry VTT module (`module.json` at repo root):
  hosts the embedded D&D Beyond sheet inside Foundry and handles the Foundry-side half of the sync.
- **`tests/`** — Vitest unit tests for the router and content-script helpers.
- **`docs/`** — architecture, product vision, and backlog notes.
- **`.planning/`** — GSD project planning history (requirements, roadmap, phase plans/verification).
- **`agent.md`**, **`foundry-CodeRules.md`** — coding ground rules carried forward from this
  project's original prototype.

## Installing in Foundry VTT

Foundry VTT → Install Module → paste this manifest URL:

```
https://raw.githubusercontent.com/thatoneguy-ian/metallic-belt/main/module.json
```

Requires the `dnd5e` system, `>=5.3.0`, and Foundry `13`–`14`.

## Development

```bash
npm install
npm test
```
