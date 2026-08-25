# Codebase Structure

**Analysis Date:** 2026-08-25

## Directory Layout

```
alphaTest/
├── chrome-extension/           # Chrome MV3 extension (runs on dndbeyond.com)
│   ├── background.js           # Service worker; manages CobaltSession cookie injection
│   ├── content.js              # ISOLATED world content script; roll/state observers
│   ├── shim.js                 # MAIN world content script; crypto polyfills
│   ├── manifest.json           # Extension manifest (MV3)
│   ├── rules.json              # Declarative Net Request rules (empty or minimal)
│   └── _metadata/              # Chrome-generated metadata (do not edit)
│
├── foundry-module/             # Foundry VTT module (loaded by Foundry)
│   ├── module.json             # Module manifest (entry point for Foundry)
│   ├── scripts/
│   │   ├── main.js             # Main entry point; Hooks, message router, roll handler
│   │   ├── embedded-sheet.js   # DDBEmbeddedSheet class; renders iframe or setup panel
│   │   └── importer.js         # parseDDBCharacter; D&D Beyond JSON → Foundry schema
│   ├── templates/
│   │   └── embedded-sheet.html # Handlebars template for actor sheet UI
│   └── styles/
│       └── style.css           # Styling for embedded sheet
│
├── tests/                      # Test suite
│   ├── content.test.js         # Jest tests for content.js functions
│   ├── importer.test.js        # Tests for parseDDBCharacter
│   ├── router.test.js          # Tests for message router
│   └── fixtures/
│       └── character-sample.json # Mock D&D Beyond character JSON
│
├── docs/                       # Project documentation
│   ├── architecture.md         # Design overview (legacy; see ARCHITECTURE.md)
│   ├── backlog.md              # Known issues and TODOs
│   ├── prd.md                  # Product requirements
│   └── vision_mission.md       # Project vision
│
├── inspect-chrome*.js          # Debugging utilities (not part of build)
├── dom-result.json             # Sample DOM scrape output (not part of build)
├── package.json                # Node.js project metadata
├── package-lock.json           # Dependency lock file
└── .env (if present, see footer) # Environment configuration (not version controlled)
```

## Directory Purposes

**chrome-extension/**
- Purpose: MV3 extension that runs on dndbeyond.com; bridges D&D Beyond actions to Foundry
- Contains: Content scripts (MAIN/ISOLATED worlds), service worker, manifest
- Key files: `content.js` (primary roll/state observer), `background.js` (auth cookie injection)

**foundry-module/**
- Purpose: Foundry module loaded by the game; registers custom sheet and handles incoming messages
- Contains: Hooks, sheet class, importer, template, styles
- Key files: `main.js` (entry point; message router), `embedded-sheet.js` (UI), `importer.js` (schema mapper)

**tests/**
- Purpose: Jest test suite; unit tests for content script and importer functions
- Contains: Test files with fixtures
- Key files: `content.test.js`, `importer.test.js`, `router.test.js` (message routing tests)

**docs/**
- Purpose: Project documentation (legacy or supplemental)
- Contains: Architecture notes, backlog, PRD, vision statements

## Key File Locations

**Entry Points:**
- Chrome extension: `chrome-extension/manifest.json` (declares content scripts and service worker)
- Foundry module: `foundry-module/module.json` (declares esmodules entry point)
- Foundry main: `foundry-module/scripts/main.js` (Hooks.once("init") and Hooks.once("ready"))
- Content script init: `chrome-extension/content.js:54-57` (runs if iframe + characterId present)

**Configuration:**
- Extension manifest: `chrome-extension/manifest.json` (permissions, host_permissions, content_scripts)
- Module manifest: `foundry-module/module.json` (compatibility versions, styles, esmodules)
- Template config: `foundry-module/templates/embedded-sheet.html` (sheet dimensions, allowed attributes)

**Core Logic:**
- Roll handling: `chrome-extension/content.js:59-114` (initializeBridge, click listeners, postMessage)
- State sync DDB→Foundry: `foundry-module/scripts/main.js:428-460` (handleStateSync)
- State sync Foundry→DDB: `foundry-module/scripts/main.js:70-119` (updateActor hook, STATE_UPDATE post)
- Roll routing: `foundry-module/scripts/main.js:308-370` (handleRollAction, type dispatch)
- Chat card auto-click: `foundry-module/scripts/main.js:25-67` (renderChatMessageHTML hook)

**Testing:**
- Content script tests: `tests/content.test.js`
- Importer tests: `tests/importer.test.js`
- Fixtures: `tests/fixtures/character-sample.json` (mock D&D Beyond character response)

## Naming Conventions

**Files:**
- Content script: `content.js` (Chromium standard)
- Service worker: `background.js` (Chromium standard)
- Polyfill shim: `shim.js` (convention for polyfill/fallback code)
- Sheet class: `embedded-sheet.js` (mirrors class name DDBEmbeddedSheet)
- Data importer: `importer.js` (convention for schema translation)
- Entry point: `main.js` (Foundry/Node.js convention)
- Template: `embedded-sheet.html` (Handlebars; matches sheet class name)
- Tests: `*.test.js` (Jest convention)

**Directories:**
- `chrome-extension/` (framework name + purpose)
- `foundry-module/` (framework name + purpose)
- `scripts/` (JS files)
- `templates/` (HTML/Handlebars templates)
- `styles/` (CSS files)
- `tests/` (test files)
- `docs/` (documentation)

**JavaScript Functions/Classes:**
- Message handlers: `handle${Action}` (e.g., handleRollAction, handleStateSync)
- Scrapers: `scrape${Thing}` (e.g., scrapeAC, scrapeHP)
- Utilities: `${verb}${Noun}` (e.g., extractActionData, findRollTarget)
- Observers: `setup${Observer}` (e.g., setupStateObservers, setupContextMenuObserver)
- Hooks: `auto${Action}` (e.g., autoResolveAttackRoll)

**Message Types:**
- Chrome → Foundry: `ROLL_ACTION`, `STATE_SYNC`, `DDB_JSON_RESPONSE`
- Foundry → Chrome: `STATE_UPDATE`, `REQUEST_DDB_JSON`

## Where to Add New Code

**New Feature (e.g., Add support for bonus actions):**
- Primary code: `chrome-extension/content.js` (observe click, extract bonus action name)
- Route in Foundry: `foundry-module/scripts/main.js` (add handler for new message type)
- Actor update: Extend handleRollAction/handleStateSync cases
- Tests: Add test case to `tests/content.test.js` and `tests/router.test.js`

**New Component/Module (e.g., Add a damage calculator):**
- Implementation: `foundry-module/scripts/calculator.js`
- Export functions: `export function calculateDamage(rollData) { ... }`
- Import in main.js: `import { calculateDamage } from "./calculator.js"`
- Tests: `tests/calculator.test.js`

**New Scraper (e.g., Add proficiency bonus scrape):**
- Add function to `chrome-extension/content.js`: `function scrapeProficiencyBonus() { ... }`
- Call in sendInitialScrapedStats (line 119-140)
- Add to postMessage payload (line 136-139)
- Update main.js handleDDBJsonResponse to receive and apply

**Utilities (shared helpers):**
- DOM helpers: `chrome-extension/content.js` (already exported to globalThis for testing)
- Schema helpers: `foundry-module/scripts/importer.js` (e.g., new normalizers)
- Message helpers: Inline in `main.js` (getAbilityKey, getSkillKey, line 462-479) or extract to `utils.js`

**Styling:**
- Sheet UI: `foundry-module/styles/style.css`
- HTML structure: `foundry-module/templates/embedded-sheet.html`

**Tests:**
- Unit tests for functions: `tests/${module}.test.js`
- Integration tests for message flow: `tests/router.test.js`
- Fixtures: `tests/fixtures/${sample}.json`

## Special Directories

**chrome-extension/_metadata/:**
- Purpose: Chrome-generated metadata directory
- Generated: Yes (auto-created by Chrome when extension is loaded)
- Committed: No (in .gitignore or excluded from build)
- Do not edit manually

**tests/fixtures/:**
- Purpose: Mock data for testing (D&D Beyond character JSON samples)
- Generated: No (hand-curated test data)
- Committed: Yes (part of test suite)

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (from package-lock.json)
- Committed: No (in .gitignore)
- Install with: `npm install`

**docs/ (legacy):**
- Purpose: Supplemental project documentation
- Generated: No (hand-written)
- Committed: Yes
- Note: See `.planning/codebase/` for authoritative architecture/structure docs

## Module Dependencies

**Foundry module (main.js):**
- Imports:
  - `./embedded-sheet.js` (DDBEmbeddedSheet class)
  - `./importer.js` (parseDDBCharacter function)
- Globals used:
  - `Hooks` (Foundry global)
  - `game` (Foundry global)
  - `ui` (Foundry global)
  - `Actors` (Foundry global)
  - `foundry.utils` (Foundry utility namespace)

**Embedded sheet (embedded-sheet.js):**
- Extends: `ActorSheet` (Foundry class)
- Imports from main.js (dynamic): `syncActorFromDDB` function (line 62, 71)

**Importer (importer.js):**
- No external imports (standalone)
- Exports: `parseDDBCharacter`, `normalizeItemName`

**Content script (content.js):**
- No imports (runs in browser context)
- Exports to globalThis (for testing): Multiple functions (lines 623-640)

## File Sizes (Reference)

- `chrome-extension/content.js` — ~640 lines (primary bridge logic)
- `foundry-module/scripts/main.js` — ~480 lines (hooks, routing, handlers)
- `foundry-module/scripts/importer.js` — ~250+ lines (schema translation)
- `chrome-extension/background.js` — ~70 lines (cookie sync)
- `chrome-extension/shim.js` — ~100 lines (crypto polyfill)
- `foundry-module/scripts/embedded-sheet.js` — ~100 lines (UI class)
- `foundry-module/templates/embedded-sheet.html` — ~34 lines (template)

---

*Structure analysis: 2026-08-25*
