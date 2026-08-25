# Product Requirements Document (PRD)

## 1. Objectives & Goals
The goal of this project is to integrate the `dndbeyond.com` character sheet directly inside Foundry Virtual Tabletop (VTT). 
* **Target Audience**: Players and Game Masters playing D&D 5e on Foundry VTT who prefer the character building and management experience of D&D Beyond.
* **Core Goal**: Reduce prep and play-time friction, maintain immersion, and enable advanced combat automation modules (like `midi-qol` and `chris-premades`) to function natively.

## 2. User Personas
* **The Player (Alex)**: Alex has all their D&D sourcebooks on D&D Beyond and finds Foundry VTT sheets complex to manage. Alex wants to open their character sheet in Foundry, see their D&D Beyond character sheet exactly as it looks online, click buttons, and have the rolls execute inside Foundry's chat.
* **The Game Master (Sarah)**: Sarah uses `midi-qol` and `chris-premades` to run fast-paced combat. Sarah wants Alex's rolls from D&D Beyond to trigger native Foundry item rolls so that hits, damage, saving throws, and resource consumption are fully automated.

## 3. Key Functional Requirements

### FR-1: Embedded Character Sheet UI
* The Foundry VTT module must register a custom Actor sheet class.
* When selected, this sheet renders an iframe displaying the D&D Beyond character sheet (`https://www.dndbeyond.com/characters/{characterId}`).
* The iframe must load successfully inside Foundry VTT.

### FR-2: Chrome Companion Extension (The Bridge)
* Because browser security (Same-Origin Policy, `X-Frame-Options`, `Content-Security-Policy`) blocks embedding and interacting with D&D Beyond inside an iframe, a Chrome extension is required.
* The extension must:
  * Strip headers preventing framing (`X-Frame-Options`, `frame-ancestors`) for D&D Beyond requests originating from a Foundry VTT instance.
  * Inject a content script into the D&D Beyond frame.
  * Enable secure bidirectional message passing (`window.postMessage`) between the iframe page and the Foundry VTT parent page.

### FR-3: Native Actor Synchronization (Initial & Passive)
* To support automation modules, a native Foundry VTT Actor must exist and mirror the D&D Beyond sheet's stats, items, spells, features, and active effects.
* On sheet open, the module must fetch the D&D Beyond character JSON (`https://character-service.dndbeyond.com/character/v2/character/{characterId}`) and update the native Actor's data structure (attributes, inventory items, spell slots).
* Provide a manual "Sync" button in the Foundry sheet title bar as a fallback.

### FR-4: Action & Roll Mapping
* When a player clicks a roll or action on the embedded D&D Beyond sheet:
  1. The Chrome extension content script intercepts the click/roll event.
  2. The content script sends a message containing the action detail (e.g., action type: "attack", item/spell name: "Longsword", roll parameters) to Foundry VTT.
  3. The Foundry VTT module matches the action to the corresponding native Item on the Foundry Actor.
  4. The module executes a native roll/use command on that Item (e.g., `item.roll()` or `item.use()`), allowing modules like `midi-qol` and `chris-premades` to process the action natively.

### FR-5: Bidirectional State Sync (Real-Time)
* **D&D Beyond to Foundry**: Updates to HP, temporary HP, and spell slots made on the embedded D&D Beyond sheet must be intercepted by the Chrome extension and immediately synced to the native Foundry Actor.
* **Foundry to D&D Beyond**: When Foundry modifies the Actor's state (e.g., GM applies damage to the token, or `midi-qol` automates spell slot consumption):
  1. The Foundry module posts a state change event to the iframe.
  2. The Chrome extension content script receives the message and updates the D&D Beyond DOM (e.g. adjusts HP input, checks/unchecks spell slots) so the sheets remain in lockstep.

## 4. Non-Functional Requirements
* **Latency**: The time between clicking a roll on D&D Beyond and the roll starting in Foundry must be under 150ms.
* **Compatibility**: Target **Foundry VTT v14 (Stable)** and **D&D 5e system v3.x+**.
* **Zero Server Infrastructure**: All communication is local to the player's browser via `window.postMessage`. No third-party relays or databases are required, ensuring privacy and zero operating cost.
