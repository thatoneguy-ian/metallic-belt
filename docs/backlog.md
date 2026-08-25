# Backlog: Capabilities, Features, and User Stories

This backlog defines the development path for the D&D Beyond Foundry VTT integration. It is structured hierarchically:
* **Business Capabilities (CAP)**: High-level value propositions.
* **Technical Design Features (FEAT)**: System capabilities to enable the business capabilities.
* **User Stories (US)**: Small, testable units of work for development.

---

## Capability 1: Character Embedded UI (CAP-1)
* **Goal**: Provide the player with their D&D Beyond character sheet directly inside the Foundry VTT workspace.

### FEAT-1.1: Custom Embedded Actor Sheet
* **Description**: Create a custom sheet registration in Foundry VTT that displays an iframe pointing to D&D Beyond.

* **User Stories**:
  * **US-1.1.1: Actor Sheet Registration**
    * *Description*: As a GM, I want to register a custom sheet option ("D&D Beyond Embedded") for actors so that players can select it.
    * *Acceptance Criteria*:
      * The sheet appears in the Sheet Selection dropdown of the Actor Configuration.
      * Selecting it opens a clean window subclassed from `ApplicationV2`.
  * **US-1.1.2: DDB URL / ID Configuration**
    * *Description*: As a player, I want to paste my D&D Beyond character URL or ID into a config field on the Actor sheet, so it knows which sheet to embed.
    * *Acceptance Criteria*:
      * A configuration icon or field exists in the sheet.
      * Saving the ID persists it in the Actor's flags (`flags.ddb-bridge.characterId`).
  * **US-1.1.3: IFrame Render**
    * *Description*: As a player, I want the custom sheet to render an iframe targeting the saved D&D Beyond character URL, so I can see my sheet.
    * *Acceptance Criteria*:
      * If the character ID is set, the sheet content is replaced with an iframe loading the D&D Beyond URL.
      * Shows a friendly error/instructions page if no character ID is set.

### FEAT-1.2: IFrame Security Bypass (Extension Component)
* **Description**: Chrome extension to modify headers so `dndbeyond.com` can be loaded inside the Foundry iframe.

* **User Stories**:
  * **US-1.2.1: Chrome Extension Manifest & Setup**
    * *Description*: As a developer, I want a standard manifest v3 configuration for the companion extension, so that I can load it locally.
    * *Acceptance Criteria*:
      * Contains basic extension configuration and icon setup.
  * **US-1.2.2: Response Header Modification Rule**
    * *Description*: As a player, I want the Chrome extension to strip `X-Frame-Options` and modify `Content-Security-Policy: frame-ancestors` on D&D Beyond pages requested within Foundry VTT, so the page loads successfully instead of being blocked by the browser.
    * *Acceptance Criteria*:
      * Rules defined using `declarativeNetRequest` (or background service worker) target requests containing `dndbeyond.com/characters` and strip block headers.
      * Sheet loads in the iframe without "Connection Refused" errors.

---

## Capability 2: Initial Character Sync (CAP-2)
* **Goal**: Automatically build and update a native Foundry VTT Actor with data from D&D Beyond so that native sheets exist in the background.

### FEAT-2.1: DDB Character JSON Parser
* **Description**: Module utility to fetch and map character JSON from D&D Beyond's character service.

* **User Stories**:
  * **US-2.1.1: JSON Fetching Utility**
    * *Description*: As a developer, I want a service function that fetches character JSON from D&D Beyond's service via the character ID.
    * *Acceptance Criteria*:
      * Fetches `https://character-service.dndbeyond.com/character/v2/character/{characterId}`.
      * Successfully parses basic stats, abilities, and skills.
  * **US-2.1.2: Attributes & Stats Mapping**
    * *Description*: As a player, I want my primary stats, skills, HP, and class levels to sync from D&D Beyond to my native Foundry VTT Actor.
    * *Acceptance Criteria*:
      * Maps ability scores, saving throw proficiencies, skill proficiencies, and hit point totals.
      * Correctly updates the Foundry Actor data model.
  * **US-2.1.3: Inventory & Spell Sync**
    * *Description*: As a player, I want my items (weapons, armor, equipment) and spells to sync as native Foundry VTT Items on my Actor, so they are available for rolling.
    * *Acceptance Criteria*:
      * Automatically matches items and spells from the DDB JSON against system databases or imports them.
      * Equips items in Foundry matching their equipped state on D&D Beyond.

### FEAT-2.2: Sync Action Triggers
* **Description**: Triggers for when the character data is synchronized.

* **User Stories**:
  * **US-2.2.1: Auto-Sync on Sheet Open**
    * *Description*: As a player, I want the native sync to run automatically when I open my character sheet, so I am always playing with updated stats.
    * *Acceptance Criteria*:
      * Opening the custom actor sheet triggers a background sync request.
      * Shows a brief spinner/loading state in the sheet header during sync.
  * **US-2.2.2: Manual Sync Button**
    * *Description*: As a player, I want a manual "Sync" button in the sheet window title bar so I can force a data update.
    * *Acceptance Criteria*:
      * A sync button is displayed next to sheet headers.
      * Clicking it triggers the JSON parser and updates the Actor.

---

## Capability 3: Action & Roll Mapping (CAP-3)
* **Goal**: Map rolls clicked on the embedded D&D Beyond sheet to native Foundry rolls, preserving combat automation.

### FEAT-3.1: DDB Click Interceptor (Extension Content Script)
* **Description**: Inject script into D&D Beyond to intercept action clicks and post messages to Foundry.

* **User Stories**:
  * **US-3.1.1: Content Script Injection**
    * *Description*: As a developer, I want the extension to inject a content script into the D&D Beyond iframe when loaded in Foundry.
    * *Acceptance Criteria*:
      * Content script initializes only when the window has a parent (`window.self !== window.top`).
  * **US-3.1.2: Attack & Spell Clicks Interception**
    * *Description*: As a player, I want clicking an attack or spell roll on the D&D Beyond sheet to send an action message to Foundry.
    * *Acceptance Criteria*:
      * Intercepts clicks on attack/spell buttons.
      * Prevents DDB's default dice rolling if desired, or allows it but catches the event.
      * Calls `window.parent.postMessage` with the action details.

### FEAT-3.2: Foundry Action Router
* **Description**: Receive postMessage roll events in Foundry VTT and route them to native Actor rolls.

* **User Stories**:
  * **US-3.2.1: Window Message Listener**
    * *Description*: As a developer, I want the Foundry module to listen for postMessage events from the D&D Beyond iframe.
    * *Acceptance Criteria*:
      * Implements a listener verifying message origin and structure.
  * **US-3.2.2: Roll Execution Mapping**
    * *Description*: As a GM, I want incoming postMessage events for attacks, spells, saves, and ability checks to roll natively in Foundry, so that `midi-qol` can automate them.
    * *Acceptance Criteria*:
      * Receives action type and name (e.g., "Longsword").
      * Locates the matching Item on the native Actor.
      * Triggers the roll natively (e.g., `item.roll()` or `item.use()`).

---

## Capability 4: Bidirectional State Sync (CAP-4)
* **Goal**: Keep character stats (HP, spell slots, inventory charges) perfectly synchronized between the D&D Beyond sheet and Foundry during play.

### FEAT-4.1: Foundry-to-DDB State Sync
* **Description**: Propagate Foundry-side actor updates (e.g., damage taken, spell slots spent) back to D&D Beyond.

* **User Stories**:
  * **US-4.1.1: Foundry Actor Hook for State Changes**
    * *Description*: As a developer, I want to hook into updates on the native Actor (HP, spell slots) and send updates to the iframe.
    * *Acceptance Criteria*:
      * Hooks into `updateActor`.
      * Sends `postMessage` with updated state variables if the change originated in Foundry.
  * **US-4.1.2: Extension DOM Updater for DDB**
    * *Description*: As a player, I want changes sent from Foundry VTT (like damage taken) to update my D&D Beyond sheet in real time.
    * *Acceptance Criteria*:
      * Content script listens for state update messages from Foundry.
      * Modifies the input elements on the D&D Beyond sheet (like HP inputs, spell slots) and triggers input/change events to ensure D&D Beyond's internal scripts save the updates.

### FEAT-4.2: DDB-to-Foundry State Sync
* **Description**: Intercept edits made directly on the D&D Beyond iframe UI and update the native Foundry Actor in real time.

* **User Stories**:
  * **US-4.2.1: DOM Change Observers on DDB**
    * *Description*: As a developer, I want the content script to observe changes to HP inputs, spell slot checkboxes, and resource tracking elements on the D&D Beyond page.
    * *Acceptance Criteria*:
      * MutationObservers or event listeners watch changes on the DDB sheet.
      * Sends state change updates to Foundry VTT.
  * **US-4.2.2: Live Actor Update**
    * *Description*: As a player, I want changes I make directly on the D&D Beyond sheet (like ticking off a spell slot) to immediately update my native Foundry Actor sheet.
    * *Acceptance Criteria*:
      * Foundry module receives the state change message.
      * Updates the native Actor using `actor.update()`.
