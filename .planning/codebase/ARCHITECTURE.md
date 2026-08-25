<!-- refreshed: 2026-08-25 -->
# Architecture

**Analysis Date:** 2026-08-25

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    D&D Beyond Website (HTTPS)                         │
│                  ┌─────────────────────────────────┐                  │
│                  │  Character Sheet Page           │                  │
│                  │  (`https://dndbeyond.com/...`)  │                  │
│                  └──────────────┬──────────────────┘                  │
│                                 │                                     │
│  ┌──────────────────────────────┼──────────────────────────────────┐ │
│  │ Chrome MV3 Extension          │                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │ background.js (Service Worker)                          │   │ │
│  │  │ - Syncs CobaltSession cookie to subframe headers       │   │ │
│  │  │ - Listens for cookie changes                           │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │ shim.js (MAIN World - runs before page scripts)         │   │ │
│  │  │ - Polyfills crypto.randomUUID, crypto.subtle.digest     │   │ │
│  │  │ - Injected early to support D&D Beyond scripts          │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  │                                                                  │ │
│  │  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  │ content.js (ISOLATED World - runs after page scripts)   │   │ │
│  │  │ - Observes roll button clicks (ROLL_ACTION → parent)    │   │ │
│  │  │ - Observes roll-mode context menu (Adv/Dis/Flat)      │   │ │
│  │  │ - Scrapes DOM: AC, Speed, Initiative, HP, Spell Slots │   │ │
│  │  │ - Listens for STATE_UPDATE from Foundry iframe          │   │ │
│  │  │ - Gate: isSyncingFromFoundry flag (prevents loop)       │   │ │
│  │  └─────────────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                          postMessage("*" origin)
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Foundry VTT Instance (Browser)                       │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ main.js - Message Router & Roll Handler                        │   │
│  │ - Hooks.once("init") → registers DDBEmbeddedSheet             │   │
│  │ - Hooks.once("ready") → window.addEventListener("message")    │   │
│  │ - Router: handleIncomingBridgeMessage (entry point)            │   │
│  │   - Routes: DDB_JSON_RESPONSE → handleDDBJsonResponse          │   │
│  │   - Routes: ROLL_ACTION → handleRollAction                     │   │
│  │   - Routes: STATE_SYNC → handleStateSync                       │   │
│  │ - Hooks.on("updateActor") → posts STATE_UPDATE back to iframe  │   │
│  │   - Gate: check options.ddbBridgeSync (prevents loop)          │   │
│  │ - Hooks.on("renderChatMessageHTML") → auto-click Attack button │   │
│  │ - autoResolveAttackRoll(rollMode) → pre-fires renderDialog hook│   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                    │                                   │
│  ┌────────────────────────────────┼──────────────────────────────┐   │
│  │ DDBEmbeddedSheet (ActorSheet)   │                              │   │
│  │ - Renders template             │                              │   │
│  │ - Shows iframe or config panel  ▼                              │   │
│  │  ┌─────────────────────────────────────────────────────────┐  │   │
│  │  │ embedded-sheet.html Template                            │  │   │
│  │  │ - If characterId set:                                   │  │   │
│  │  │   <iframe src="https://dndbeyond.com/characters/{ID}">  │  │   │
│  │  │   - Sync Stats & Config buttons                         │  │   │
│  │  │ - If characterId not set: Setup panel (input + Link btn)│  │   │
│  │  └─────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ Actor (native Foundry document)                                │   │
│  │ - Stores flag "ddb-bridge.characterId" (DDB ID link)          │   │
│  │ - Receives updates from handleStateSync()                      │   │
│  │ - Trigger updateActor hook → posts STATE_UPDATE to iframe      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| background.js | Cookie injection gateway; maintains CobaltSession auth | `chrome-extension/background.js` |
| shim.js | Crypto polyfills (randomUUID, SHA-256); runs before D&D Beyond scripts | `chrome-extension/shim.js` |
| content.js | Roll observation, state scraping, two-way sync bridge (ISOLATED world) | `chrome-extension/content.js` |
| main.js | Message router, actor update handler, Foundry hooks | `foundry-module/scripts/main.js` |
| DDBEmbeddedSheet | Custom ActorSheet; renders iframe or setup panel | `foundry-module/scripts/embedded-sheet.js` |
| importer.js | D&D Beyond JSON → Foundry actor/item schema translation | `foundry-module/scripts/importer.js` |
| embedded-sheet.html | Template; displays iframe or config UI | `foundry-module/templates/embedded-sheet.html` |

## Pattern Overview

**Overall:** Embedded iframe bridge with postMessage-based two-way sync

**Key Characteristics:**
- Chrome extension injects content scripts into D&D Beyond character sheets loaded as iframes within Foundry
- MAIN world (shim.js) provides crypto polyfills; ISOLATED world (content.js) observes user actions
- All cross-window communication via postMessage with liberal "*" origin (no origin validation at present)
- Bidirectional state sync with loop guards to prevent infinite updates
- Foundry sheet delegates rendering to embedded iframe; Foundry UI controls (buttons) manage the connection lifecycle

## Layers

**Content Script Layer (Chrome Extension):**
- Purpose: Intercept D&D Beyond user interactions and report them to Foundry
- Location: `chrome-extension/content.js`
- Contains: Event listeners (click, change), DOM scrapers, postMessage senders
- Depends on: D&D Beyond page DOM, browser postMessage API, CobaltSession cookie (injected by background.js)
- Used by: Foundry main.js (receives messages from content.js)

**Message Router Layer (Foundry):**
- Purpose: Route incoming postMessages to appropriate handlers; coordinate state updates
- Location: `foundry-module/scripts/main.js`
- Contains: handleIncomingBridgeMessage router, typed handlers (DDB_JSON_RESPONSE, ROLL_ACTION, STATE_SYNC)
- Depends on: Foundry Hooks API, Actor update mechanism, chat card rendering hooks
- Used by: Sheet layer (DDBEmbeddedSheet), external Foundry module ecosystem

**Sheet & UI Layer (Foundry):**
- Purpose: Display the D&D Beyond iframe and provide sync controls
- Location: `foundry-module/scripts/embedded-sheet.js`, `foundry-module/templates/embedded-sheet.html`
- Contains: ActorSheet subclass, template (config panel or iframe), button handlers
- Depends on: Foundry ActorSheet base class, Actor flags, postMessage to iframe
- Used by: Game UI (actor sheet registry); triggered when player opens actor sheet

**Data Import Layer:**
- Purpose: Translate D&D Beyond character JSON into Foundry actor and item updates
- Location: `foundry-module/scripts/importer.js`
- Contains: parseDDBCharacter function, schema mappers
- Depends on: D&D Beyond character-service API response format, Foundry dnd5e system schema
- Used by: handleDDBJsonResponse in main.js

## Data Flow

### Primary Request Path: Roll Action (DDB → Foundry)

1. User clicks a roll button in D&D Beyond iframe (`content.js:67-89`)
   - Event bubbles; `findRollTarget(event.target)` walks DOM
   - Extracts action data: name, type (attack/spell/save/check/skill)
2. content.js posts ROLL_ACTION message to parent window (`content.js:82-87`)
   - Message: `{ source: "ddb-bridge-extension", characterId, type: "ROLL_ACTION", data: { name, type, rollMode } }`
3. Foundry main.js receives message at window addEventListener ("message") (`main.js:20-22`)
   - Message routes to handleIncomingBridgeMessage (`main.js:148`)
4. handleIncomingBridgeMessage looks up actor by characterId flag (`main.js:156`)
5. Routes to handleRollAction (`main.js:166-167`)
   - If rollMode is "advantage" or "disadvantage", pre-registers autoResolveAttackRoll hook
   - Sets pendingCardClick state for chat card auto-click
   - Calls item.use() to create chat card
6. Chat card renders; renderChatMessageHTML hook fires (`main.js:25`)
   - Finds button matching action (attack/damage)
   - Auto-clicks button
7. Attack Roll dialog appears
   - Pre-registered renderDialog hook fires (`autoResolveAttackRoll`, line 392)
   - Finds and clicks ADVANTAGE/NORMAL/DISADVANTAGE button
8. Roll completes; result posted to chat

### Secondary Flow: State Sync (DDB ↔ Foundry)

**DDB → Foundry (HP/Spell Slots changed in D&D Beyond):**
1. User changes HP input or toggles spell slot in D&D Beyond UI
2. content.js change/click event listeners fire (`content.js:498, 512`)
3. Posts STATE_SYNC message (`content.js:528-535`)
4. main.js routes to handleStateSync (`main.js:169-170`)
5. handleStateSync updates actor fields with `actor.update()` and `{ ddbBridgeSync: true }` flag (`main.js:457-459`)

**Foundry → DDB (state changed natively in Foundry):**
1. Foundry user edits actor HP or spell slots via Foundry sheet
2. Triggers updateActor hook (`main.js:70-119`)
3. Hook checks `options.ddbBridgeSync` — if set, skips (prevents loop)
4. Otherwise, constructs STATE_UPDATE payload
5. Finds the DDBEmbeddedSheet window and posts STATE_UPDATE to iframe's contentWindow (`main.js:115`)
6. content.js receives STATE_UPDATE message (`content.js:95-105`)
7. handleIncomingState updates D&D Beyond UI (HP input, spell slot checkboxes) (`content.js:568-621`)
8. Sets `isSyncingFromFoundry` flag to prevent change event re-triggering (`content.js:569, 619`)

**State Management:**
- DDB side: `isSyncingFromFoundry` boolean flag (lines 492, 569, 619) gates change event handlers
- Foundry side: `options.ddbBridgeSync: true` flag (line 458) gates updateActor hook processing
- These flags prevent feedback loops when one system updates the other

## Key Abstractions

**PostMessage Protocol:**
- Purpose: Safe cross-origin communication between extension and Foundry window
- Examples: `chrome-extension/content.js:82-87`, `foundry-module/scripts/main.js:82-87`, `main.js:115`
- Pattern: Object with `{ source, characterId, type, data }` structure; leverages source field for routing

**DOM Scraper Utilities:**
- Purpose: Extract structured data (AC, Speed, HP, Initiative, Spell Slots) from D&D Beyond HTML
- Examples: `scrapeAC()`, `scrapeSpeed()`, `scrapeHP()`, `calculateSpellSlots()` (content.js lines 224-563)
- Pattern: Combine CSS selectors and text label matching; fallback to sibling/parent text extraction

**Actor Sync Gate:**
- Purpose: Prevent infinite loops when both Foundry and D&D Beyond try to sync the same state
- Examples: `ddbBridgeSync` option flag (main.js line 458), `isSyncingFromFoundry` (content.js line 492)
- Pattern: When one side initiates an update, it marks it as internal; the other side ignores internal updates

**Action Extractor:**
- Purpose: Determine what action was clicked (attack/spell/save/check/skill) and extract its name
- Examples: `extractActionData()`, `findRollTarget()` (content.js lines 306-391)
- Pattern: Walk DOM upward from click target; match against known D&D Beyond class patterns; text fallback

## Entry Points

**Chrome Extension - Content Script Initialization:**
- Location: `chrome-extension/content.js:54-57`
- Triggers: Content script injected when D&D Beyond character URL matches manifest pattern
- Responsibilities:
  1. Validates iframe context (window.self !== window.top)
  2. Extracts Character ID from URL pathname
  3. Calls initializeBridge()
- Guard: Only runs if characterId present; only in iframe (not top-level page)

**Foundry Module - Initialization:**
- Location: `foundry-module/scripts/main.js:5-22`
- Triggers: Hooks.once("init") when Foundry initializes; Hooks.once("ready") when game ready
- Responsibilities:
  1. Registers DDBEmbeddedSheet as available ActorSheet
  2. Attaches global window.addEventListener("message") listener
- Guard: init hook ensures sheet class registered before players open sheets

**Message Router:**
- Location: `foundry-module/scripts/main.js:148-173`
- Function: `handleIncomingBridgeMessage(event)`
- Routes incoming postMessages to appropriate handler:
  - `DDB_JSON_RESPONSE` → handleDDBJsonResponse (full character import)
  - `ROLL_ACTION` → handleRollAction (dice roll from D&D Beyond)
  - `STATE_SYNC` → handleStateSync (HP/spell slot changes from D&D Beyond)
- Guard: Checks `msg.source === "ddb-bridge-extension"` before processing

**Sheet Button Handlers:**
- Location: `foundry-module/scripts/embedded-sheet.js:30-41`
- Buttons:
  - "Link Character" (`_onLinkCharacter`, line 46): Extracts Character ID, sets flag, triggers initial sync
  - "Sync Stats" (`_onSyncStats`, line 69): Calls syncActorFromDDB, posts REQUEST_DDB_JSON
  - "Config" (`_onConfigureLink`, line 91): Clears characterId flag, shows setup panel

## Architectural Constraints

- **Threading:** Single-threaded event-driven. Chrome extension runs in service worker thread; Foundry runs in main browser thread. No worker threads used.
- **Global state:** 
  - Chrome extension: `_rollMode` (line 8), `lastRollName/Type/Time` (lines 21-23), `isSyncingFromFoundry` (line 492)
  - Foundry: `pendingCardClick` (line 16)
  - No cross-window global state; all state is local to each half
- **Circular imports:** None detected. Module import order: main.js → embedded-sheet.js, importer.js (line 1-2). No circular dependencies.
- **PostMessage Origin:** Currently uses "*" for all postMessage calls (liberal, no validation). Production should restrict to specific origins.
- **Iframe Isolation:** ISOLATED world content.js cannot access D&D Beyond's main-world window directly; shim.js bridges the gap by providing window.crypto polyfills

## Anti-Patterns

### Over-Permissive Origin in postMessage

**What happens:** All postMessage calls use `"*"` as targetOrigin (`content.js:87`, `main.js:115`, `embedded-sheet.js` lines listing postMessage)

**Why it's wrong:** Any window/frame on the page can intercept these messages, including malicious iframes or browser extensions. Secrets or unvalidated data in messages could be exposed.

**Do this instead:** 
- content.js should post to `window.parent` with origin `"https://localhost:30000"` (Foundry) or the exact Foundry origin
- main.js should validate `event.origin` before processing messages (e.g., `if (event.origin !== foundryOrigin) return`)
- Check `chrome-extension/content.js:82-87` and `foundry-module/scripts/main.js:82-87, 115`

### DOM Selector Fragility

**What happens:** Scrapers use hardcoded class names like `.ct-armor-class-box__value`, `.ct-initiative-box__value` (`content.js:227, 234`). If D&D Beyond refactors these classes, scrapers silently fail.

**Why it's wrong:** No warning when scrape fails; actor data becomes stale without user noticing. Hard to debug across D&D Beyond updates.

**Do this instead:** 
- Log a warning when scrape returns null (`content.js:123-140` does this with console.log, but only if object has keys)
- Add fallback: if primary selector fails, try heuristic (label text match + sibling extraction)
- Current code does fallback via `scrapeStatByLabel()` but only as second attempt

### Debounce via Timestamp Comparison

**What happens:** Roll debounce tracks lastRollName/Type/Time and compares `(now - lastRollTime) < 500ms` (`content.js:35-43`)

**Why it's wrong:** If two identical rolls happen within 500ms (user spam or double-click), second one is silently dropped. No indication to user or log of suppression.

**Do this instead:**
- Replace with `AbortController` and one pending roll promise, or
- Use a Set of pending roll IDs with timeout expiry, or
- Log the debounce event (`console.warn("[DDB-Bridge] Debounced duplicate...")`) so issues are visible

## Error Handling

**Strategy:** Graceful degradation. Extension logs errors but continues; missing rolls are silently dropped; missing actors are warned.

**Patterns:**
- Content.js: Logs to console; continues if scrape fails (nullable return values)
- main.js: Logs error, posts ui.notifications.error to user (e.g., line 298)
- Actor lookup failure: Logs warning, returns early (line 158)
- HTTP fetch failure in fetchCharacterJson: catches, logs, falls back (lines 193-195)
- Dialog hook: Logs if button not found but does not throw (line 418)

## Cross-Cutting Concerns

**Logging:** 
- Chrome extension uses `console.log("[DDB-Bridge] ...")` prefix throughout
- Foundry module uses `console.log("[DDB-Bridge] ...")` and `ui.notifications.info/warn/error()`
- All major branches (roll, sync, import) log entry and result

**Validation:** 
- Character ID extracted from URL pathname with regex (`content.js:51`)
- URL parsed in sheet to extract ID (`embedded-sheet.js:51`)
- DDB JSON validated with `if (!ddbData || !ddbData.success || !ddbData.data)` (main.js:26)
- Message source validated against "ddb-bridge-extension" string (main.js:150)

**Authentication:** 
- CobaltSession cookie synced by background.js; no direct auth in content scripts
- Foundry assumes user is logged into Foundry (standard game.userId check at line 72)
- D&D Beyond auth happens via iframe's own session; extension ensures cookie is available

---

*Architecture analysis: 2026-08-25*
