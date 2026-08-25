# External Integrations

**Analysis Date:** 2026-08-25

## APIs & External Services

**D&D Beyond Character API:**
- Service: D&D Beyond character data endpoint
  - SDK/Client: Native Fetch API (no SDK)
  - Endpoint: `https://character-service.dndbeyond.com/character/v5/character/{characterId}`
  - Auth: `CobaltSession` cookie (HTTP-only, injected by background.js via declarativeNetRequest)
  - Purpose: Fetches full character JSON (stats, abilities, items, spells) for import into Foundry VTT
  - Implementation: `foundry-module/scripts/main.js` line 124-143, `chrome-extension/content.js` line 147-196

**D&D Beyond Web Scraping:**
- Purpose: Extract rendered UI values (AC, Speed, Initiative, HP, spell slots) from DOM
- Implementation: `chrome-extension/content.js` lines 119-563
- DOM targets: `.ct-armor-class-box__value`, `.ct-initiative-summary__value`, `.ct-speed-summary__speed`, `input[name="currentHp"]`, `.ct-spells-level-slot`
- Scraping functions:
  - `scrapeAC()` (line 224-229)
  - `scrapeSpeed()` (line 238-243)
  - `scrapeInitiative()` (line 231-236)
  - `scrapeHP()` (line 245-251)
  - `calculateSpellSlots()` (line 540-563)

## Data Storage

**Databases:**
- None configured; Foundry VTT manages all data via built-in document system

**File Storage:**
- Local filesystem only
- D&D Beyond avatar images: Fetched by `content.js` and base64-encoded as data URLs to bypass CORS (`chrome-extension/content.js` lines 165-183)
- Character state: Stored as Foundry Actor flags with key `"ddb-bridge"` (e.g., `getFlag("ddb-bridge", "characterId")`)

**Caching:**
- None; data is fetched and synced on-demand or during initial load

## Authentication & Identity

**Auth Provider:**
- D&D Beyond session cookies (CobaltSession)
- Mechanism: Third-party cookie injection via Chrome declarativeNetRequest
  - Implementation: `chrome-extension/background.js` lines 7-51
  - Rule ID 2 (dynamic): Injects `Cookie: CobaltSession={value}` header into subframe and XHR requests to `dndbeyond.com`
  - Triggered by: `chrome.cookies.onChanged` listener (line 58-66)
  - Required because: Foundry (localhost or different origin) cannot access D&D Beyond cookies due to same-origin policy; extension injects them via network request headers

**Cross-Origin Communication:**
- postMessage bridge between:
  - D&D Beyond iframe (ISOLATED world, `content.js`)
  - Foundry main window (background page, `main.js`)
  - Messages use `source` field for validation: `"ddb-bridge-extension"` (from iframe), `"ddb-bridge-foundry"` (from Foundry)

## Monitoring & Observability

**Error Tracking:**
- None configured; relies on browser console.log/console.error

**Logs:**
- Browser console (Chrome DevTools for extension, Foundry console for module)
- Console prefix: `[DDB-Bridge]` for all log statements
- Key logs:
  - Extension initialization: `foundry-module/scripts/main.js` line 6
  - Ready state: `foundry-module/scripts/main.js` line 21
  - Character sync completion: `foundry-module/scripts/main.js` line 295
  - Roll actions: `foundry-module/scripts/main.js` line 319
  - Network errors: `chrome-extension/background.js` line 49

## CI/CD & Deployment

**Hosting:**
- GitHub (manifest URL in `foundry-module/module.json`):
  - Manifest: `https://github.com/google-deepmind/ddb-bridge/releases/latest/download/module.json`
  - Download: `https://github.com/google-deepmind/ddb-bridge/releases/latest/download/module.zip`
- Chrome Web Store (assumed for extension deployment)

**CI Pipeline:**
- None configured; manual testing only

## Environment Configuration

**Required env vars:**
- None; all configuration is runtime-driven

**Secrets location:**
- D&D Beyond `CobaltSession` cookie: Stored in browser cookie jar, accessed via Chrome Cookies API
- No `.env` file used

## Webhooks & Callbacks

**Incoming:**
- postMessage events from D&D Beyond iframe:
  - `DDB_JSON_RESPONSE` - Character JSON and avatar data (handler: `foundry-module/scripts/main.js` line 164)
  - `ROLL_ACTION` - Roll requests with mode (advantage/flat/disadvantage) (handler: `foundry-module/scripts/main.js` line 167)
  - `STATE_SYNC` - HP/spell slot updates from D&D Beyond UI (handler: `foundry-module/scripts/main.js` line 170)

**Outgoing:**
- postMessage events to D&D Beyond iframe:
  - `REQUEST_DDB_JSON` - Request character JSON refresh (sender: `foundry-module/scripts/main.js` line 138-142)
  - `STATE_UPDATE` - Notify D&D Beyond of HP/spell changes made in Foundry (sender: `foundry-module/scripts/main.js` line 115)
  - `ROLL_ACTION` - Forward player rolls from D&D Beyond to Foundry (sender: `chrome-extension/content.js` line 82-87)

## HTTP Headers & Network Rules

**Chrome Declarative Net Request Rules:**

**Permanent Rule (rules.json, ID 1):**
- Purpose: Remove CORS blocking headers from D&D Beyond subframe responses
- Action: Remove response headers:
  - `x-frame-options`
  - `content-security-policy`
- Condition: Subframe requests to `*://*.dndbeyond.com/characters/*`
- Impact: Allows embedded D&D Beyond character sheet to load inside Foundry iframe

**Dynamic Rule (background.js, ID 2):**
- Purpose: Inject authentication cookie into subframe requests
- Action: Set request header `Cookie: CobaltSession={value}`
- Condition: Subframe, XHR, and ping requests to `*://*.dndbeyond.com/*`
- Lifecycle: Created/updated on extension install, startup, and cookie changes
- Fallback: Rule is removed if no valid CobaltSession cookie exists

## Chrome Extension Permissions & Content Scripts

**Manifest Permissions:**
```json
"permissions": ["declarativeNetRequest", "cookies"],
"host_permissions": ["https://*.dndbeyond.com/*"]
```

**Content Scripts:**
1. **shim.js** (MAIN world, runs at document_start):
   - Injects crypto polyfills for unsecure HTTP origins:
     - `window.crypto.subtle.digest()` (SHA-256 implementation)
     - `window.crypto.randomUUID()` (UUID generator)
   - Required for D&D Beyond page functionality on non-HTTPS origins

2. **content.js** (ISOLATED world, runs at document_start):
   - Bridges D&D Beyond roll actions and state changes to Foundry
   - Captures roll mode (advantage/disadvantage/flat) from right-click context menu
   - Monitors HP and spell slot changes
   - Fetches character JSON and avatar images
   - All frames: `all_frames: true` (processes nested iframes)

**Service Worker (background.js):**
- Manages CobaltSession cookie injection for authenticated subframe requests
- Listens to cookie changes and updates network rules dynamically

## Foundry VTT Integration

**Module Compatibility:**
```json
"compatibility": {
  "minimum": "12",
  "verified": "14.359",
  "maximum": "14.363"
}
```

**System Dependencies:**
```json
"relationships.systems": [
  {
    "id": "dnd5e",
    "type": "system",
    "compatibility": {"minimum": "3.0.0"}
  }
]
```

**Module Hooks:**
- `Hooks.once("init")` - Register custom actor sheet `DDBEmbeddedSheet` (line 5-13)
- `Hooks.once("ready")` - Set up postMessage listener for iframe bridge (line 19-22)
- `Hooks.on("renderChatMessageHTML")` - Auto-click attack/damage buttons (line 25-67)
- `Hooks.on("updateActor")` - Sync HP/spell slot changes back to D&D Beyond iframe (line 70-119)
- `Hooks.once("renderDialog")` - Auto-click advantage/disadvantage buttons in roll dialogs (line 392-422)

**Actor Sheet Features:**
- Custom sheet class: `DDBEmbeddedSheet` (`foundry-module/scripts/embedded-sheet.js`)
- Target: Character actors, dnd5e system
- Template: `modules/ddb-bridge/templates/embedded-sheet.html`
- Dimensions: 1050×850 px, resizable
- Methods:
  - `_onLinkCharacter()` - Extract and save D&D Beyond character ID
  - `_onSyncStats()` - Fetch character JSON and update actor/items/tokens
  - `_onConfigureLink()` - Reset character link

**Character Importer:**
- Module: `foundry-module/scripts/importer.js`
- Function: `parseDDBCharacter(ddbData)` - Converts D&D Beyond JSON to Foundry actor/item structure
- Fallback integration: Delegates to `ddb-importer` module if installed and active (line 193-223)
- Data mapped:
  - Abilities (STR/DEX/CON/INT/WIS/CHA)
  - Hit points (max/current/temporary)
  - Armor class (flat or calculated)
  - Movement speed
  - Initiative bonus
  - Spell slots (levels 1-9)
  - Items (weapons, equipment, spells) with damage/attack data

---

*Integration audit: 2026-08-25*
