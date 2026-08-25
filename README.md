# D&D Beyond Foundry Bridge

A Chrome Companion Extension and Foundry VTT module that bridges character sheets, enabling
two-way synchronization between D&D Beyond and Foundry VTT.

Players use their purchased D&D Beyond content to manage characters while playing in Foundry VTT,
with changes in either platform automatically reflecting in the other.

> **Status:** proof of concept. Fast, minimal repairs over polish — see
> [`.planning/codebase/CONCERNS.md`](.planning/codebase/CONCERNS.md) for known open items
> (security hardening around the embedded-iframe messaging is intentionally deferred, not
> overlooked).

## How it works

- **`chrome-extension/`** — runs on the D&D Beyond character sheet, embeds it in Foundry VTT via
  an iframe, and relays roll/state events between the two.
- **`scripts/`, `styles/`, `templates/`** — the Foundry VTT module (`module.json` at repo root):
  hosts the embedded D&D Beyond sheet inside Foundry and handles the Foundry-side half of the sync.
- **`tests/`** — Vitest unit tests for the router and content-script helpers.
- **`docs/`** — architecture, product vision, and backlog notes.
- **`.planning/`** — GSD project planning history (requirements, roadmap, phase plans/verification).

## Prerequisites

- **Foundry VTT** 13 or 14, with the **`dnd5e`** system, version **5.3.0 or later**.
- **Google Chrome**, or another Chromium-based browser (Edge, Brave, etc.) that supports Manifest V3
  extensions loaded unpacked.
- A **D&D Beyond account**, logged in to [dndbeyond.com](https://www.dndbeyond.com) in that same
  browser, with at least one character you own (or have edit/view access to).
- Your Foundry world open and running — locally (e.g. `http://localhost:30000`) or hosted.

## Installation

### 1. Install the Foundry VTT module

In Foundry's **Setup** screen, go to **Add-on Modules → Install Module**, paste this manifest URL,
and click **Install**:

```
https://raw.githubusercontent.com/thatoneguy-ian/metallic-belt/main/module.json
```

Then launch your world and enable **D&D Beyond Foundry Bridge** under **Game Settings → Manage
Modules**.

### 2. Install the Chrome extension

The extension isn't published to the Chrome Web Store — install it unpacked:

1. Download this repository (**Code → Download ZIP** on GitHub, or `git clone`) and unzip it
   somewhere permanent — Chrome loads the extension directly from this folder, so don't delete it
   afterward.
2. In Chrome, go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the repo's `chrome-extension/` folder.
5. Confirm **"D&D Beyond Foundry VTT Companion"** appears in your extensions list and is enabled.

The extension only activates on `dndbeyond.com/characters/*` pages (including when that page is
loaded inside Foundry's embedded iframe) — it doesn't need any other site permissions.

## Linking a character

1. In your D&D Beyond account, note the character you want to sync and its URL, e.g.
   `https://www.dndbeyond.com/characters/12345678`.
2. In Foundry, create a new **Actor** of type **Character** (or use an existing one).
3. Open the Actor's sheet, then open its **sheet configuration** (the small icon in the sheet's
   header — exact location varies slightly by Foundry version) and change the sheet type to
   **"D&D Beyond Embedded Sheet."**
4. The sheet now shows a **D&D Beyond Bridge** setup panel. Paste the character's D&D Beyond URL
   (or just the numeric ID) and click **Link Character**.
5. The embedded D&D Beyond sheet loads inside the actor sheet, and an initial sync populates the
   Foundry actor's stats, spells, and items from D&D Beyond automatically.

**If the embedded sheet looks locked or logged out:** open
[dndbeyond.com](https://www.dndbeyond.com) in a normal browser tab, log in there, then refresh the
Foundry sheet. The extension copies your D&D Beyond login session into the embedded iframe
automatically once you're logged in in that browser.

## Using the sync

- **Foundry → D&D Beyond:** Changing HP or spell slot usage on the Foundry actor sheet pushes that
  change to the embedded D&D Beyond sheet automatically.
- **D&D Beyond → Foundry:** Damage/healing, spell slot usage, and AC/speed/initiative changes made
  on the embedded D&D Beyond sheet push to the Foundry actor automatically.
- **Rolls:** Attacks, saves, checks, and skill rolls made on the embedded D&D Beyond sheet trigger
  the matching Foundry roll and post it to the Foundry chat log.
- **Manual re-sync:** Click **Sync Stats** in the sheet header at any time to force a full refresh
  of stats and items from D&D Beyond (useful after leveling up or re-equipping gear on D&D Beyond).
- **Re-linking a different character:** Click **Config** in the sheet header to unlink the current
  character and return to the setup panel.

## Known limitations

- Security hardening for the embedded-iframe messaging (origin validation, framing-header policy)
  is intentionally deferred for this proof-of-concept stage — see
  [`.planning/codebase/CONCERNS.md`](.planning/codebase/CONCERNS.md) for the full list before
  using this with characters or a Foundry instance you don't control.
- Only D&D Beyond `character`-type actors are supported; conditions and exhaustion levels are not
  yet synced (tracked in [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md) as v2 work).

## Development

```bash
npm install
npm test
```
