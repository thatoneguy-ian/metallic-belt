# Testing Patterns

**Analysis Date:** 2026-08-25

## Test Framework

**Runner:**
- Vitest 1.6.0
- Environment: jsdom (browser DOM simulation)
- Config: No `vitest.config.*` file; defaults used

**Assertion Library:**
- Vitest built-in `expect()` API

**Run Commands:**
```bash
npm test                 # Run all tests (vitest run)
npm run test:watch      # Watch mode (vitest)
npx vitest run --reporter=basic  # Basic output (used for current analysis)
```

## Test File Organization

**Location:**
- Tests co-located in `tests/` directory (separate from source)
- Source files in `foundry-module/scripts/` and `chrome-extension/`
- Test fixtures in `tests/fixtures/` (e.g., `character-sample.json`)

**Naming:**
- Pattern: `{module}.test.js`
- Examples: `router.test.js`, `content.test.js`, `importer.test.js`

**Structure:**
```
alphaTest/
├── foundry-module/scripts/
│   ├── main.js (core Foundry module, ~480 lines)
│   ├── importer.js (character JSON parser, ~400 lines)
│   └── embedded-sheet.js (actor sheet UI)
├── chrome-extension/
│   ├── content.js (D&D Beyond iframe bridge, ~640 lines)
│   ├── background.js
│   └── manifest.json
└── tests/
    ├── router.test.js (Foundry message handler tests)
    ├── content.test.js (Content script helper tests)
    ├── importer.test.js (Character parsing tests)
    └── fixtures/
        └── character-sample.json
```

## Test Structure

**Suite Organization:**

From `tests/router.test.js`:
```javascript
// @vitest-environment jsdom        // Use browser DOM environment
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Foundry globals BEFORE importing main.js
globalThis.Hooks = { once: vi.fn(...), on: vi.fn(...) };
globalThis.game = { userId: "user1", actors: { find: vi.fn(...) } };
globalThis.ui = { notifications: { error: vi.fn(...), ... } };
// ... more mocks ...

// Import module under test (side effect: registers hooks)
await import("../foundry-module/scripts/main.js");

describe("Foundry Module Message Router", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should route ROLL_ACTION for attack to item.use()", async () => {
    const event = new MessageEvent("message", { data: { ... } });
    window.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockActor.items[0].use).toHaveBeenCalled();
  });
});
```

**Patterns:**
- JSDoc environment marker: `// @vitest-environment jsdom` at top of file
- Global mock setup before imports (ensures mocks are in place when module loads)
- `beforeEach()` clears mocks: `vi.clearAllMocks()`
- Async/await for handlers: `await new Promise(resolve => setTimeout(resolve, 50))`
- MessageEvent dispatch for testing postMessage flow
- Mock verification: `expect(fn).toHaveBeenCalledWith(...)`

## Mocking

**Framework:** Vitest's `vi` object

**Patterns:**

**Mocking Foundry globals (router.test.js):**
```javascript
globalThis.Hooks = {
  once: vi.fn((hook, cb) => {
    if (hook === "ready" || hook === "init") cb();  // Auto-trigger init hooks
  }),
  on: vi.fn((hook, cb) => {
    globalThis.registeredHooks[hook] = cb;  // Save for manual triggering
  })
};

globalThis.game = {
  userId: "user1",
  actors: {
    find: vi.fn((fn) => {
      if (fn(mockActor)) return mockActor;
      return null;
    })
  }
};
```

**Mocking actors:**
```javascript
const mockActor = {
  id: "actor123",
  name: "Grog the Mighty",
  system: { abilities: { dex: { value: 14 } } },
  getFlag: vi.fn((namespace, key) => {
    if (namespace === "ddb-bridge" && key === "characterId") return "12345";
    return null;
  }),
  update: vi.fn().mockResolvedValue({}),
  rollAbilitySave: vi.fn().mockResolvedValue({}),
  getActiveTokens: vi.fn().mockReturnValue([]),
  items: [
    { name: "Longsword", type: "weapon", _id: "item1", use: vi.fn().mockResolvedValue({}) }
  ]
};
```

**Tracking hook registrations:**
```javascript
globalThis.registeredHooks = {};
// In test, retrieve registered hook:
const renderChatCallback = globalThis.registeredHooks.renderChatMessageHTML;
// Call it manually:
await renderChatCallback(mockMessage, mockHtml);
```

**What to Mock:**
- Foundry APIs: `Hooks`, `game`, `ui`, `Actors`, `ActorSheet`
- Chrome/browser globals: `window.location`, `window.postMessage`, `document.body`
- External dependencies: Network calls via `fetch` (mocked in content.js tests)
- User interactions: Click events via `document.createElement()` and real DOM

**What NOT to Mock:**
- DOM APIs (`document.querySelector`, `document.addEventListener`) - Use jsdom
- Event objects (`MessageEvent`, `Event`) - Native browser APIs work in jsdom
- Array/Object methods - Use real implementations
- Module imports - Let Vitest handle (though content.js has issues preventing import)

## Fixtures and Factories

**Test Data:**

Location: `tests/fixtures/character-sample.json`

Format: D&D Beyond character API response
```json
{
  "success": true,
  "data": {
    "id": 12345,
    "name": "Grog the Mighty",
    "baseHitPoints": 35,
    "removedHitPoints": 10,
    "temporaryHitPoints": 5,
    "stats": [
      { "id": 1, "value": 18 },  // STR
      { "id": 2, "value": 14 },  // DEX
      // ... more stats
    ],
    "classes": [],
    "modifiers": {},
    "decorations": {
      "avatarUrl": "https://media.dndbeyond.com/character-avatars/12345.jpeg"
    }
  }
}
```

**Usage in tests:**
```javascript
import characterSample from "./fixtures/character-sample.json";

it("should parse character name, level, and class details", async () => {
  const result = await parseDDBCharacter(characterSample);
  expect(result.actorData.name).toBe("Grog the Mighty");
});
```

**Mock Actor Factory:**
- Defined inline in test setup (not extracted to factory)
- Recreated per test via `vi.clearAllMocks()` in `beforeEach()`
- Mock properties reset by reassigning: `delete mockActor.rollSavingThrow;`

## Coverage

**Requirements:** No coverage enforcement detected (no `vitest.config.ts` with coverage settings)

**View Coverage:**
- No coverage command configured in `package.json`
- Could run: `npx vitest run --coverage` if provider installed

## Test Types

**Unit Tests:**
- **Scope:** Individual functions and message handlers
- **Approach:** Mock all external dependencies (Foundry, DOM)
- **Examples:** 
  - `tests/router.test.js`: Test message routing for each action type (attack, save, check, skill, state sync)
  - `tests/content.test.js`: Test DOM query helpers (`findRollTarget`, `extractActionData`)
  - `tests/importer.test.js`: Test character JSON parsing and ability score calculation

**Integration Tests:**
- **Scope:** Multi-step flows through real DOM
- **Approach:** Use jsdom to test actual DOM interactions
- **Examples:** 
  - `tests/content.test.js` "renderChatMessage auto-click behavior" - simulates item use → chat card render → button click
  - Character import flow in `tests/importer.test.js`

**E2E Tests:**
- **Framework:** Not used
- **Rationale:** Chrome extension and Foundry VTT require actual browser runtime; jsdom insufficient for end-to-end validation

## Current Test Status

### Summary
- **Total:** 55 tests across 3 files
- **Passing:** 30 tests (54%)
- **Failing:** 25 tests (46%)

### Per-File Breakdown

**tests/importer.test.js - ✓ PASSING**
- Status: 14/14 tests pass
- Time: 7ms
- Scope: Character JSON parsing, ability scores, HP, items
- Mocking: Light (uses real importer.js logic, stable fixture data)

**tests/content.test.js - ✗ FAILING (20/20 tests fail)**
- Status: IMPORT ERROR - cannot load module
- Error: "Failed to parse source for import analysis because the content contains invalid JS syntax"
- Root Cause: **SYNTAX ERROR in `chrome-extension/content.js`**
- Location: Lines 568-620 in `handleIncomingState()` function
- Problem: **Unbalanced braces** — the `try {` opened at line 570 is never closed
  - Line 570: `try {` opens
  - Line 583: `if (diff.spellSlots) {` opens
  - Line 617: the `}` in `} finally {` closes line 583's `if`, leaving `try` still open → `SyntaxError: Unexpected token 'finally'`
  - The block is exactly one `}` short
- Fix Required: Insert a closing `}` for the `try` block immediately before `finally` on line 617. Verified with `node --check`: that single brace makes the file parse. (Lines 574-616 are also under-indented, but that is cosmetic — JS is not whitespace-sensitive and re-indenting alone does **not** fix the parse error.)
- Status: **IMPLEMENTATION IS BROKEN**, not tests
- Severity: High - entire content.js helper suite untestable until fixed

**tests/router.test.js - ✗ FAILING (16/21 passing, 5 failing)**
- Status: 16/21 tests pass, 5 fail
- Failing tests: All STATE_SYNC tests (HP, spell slots, AC, speed, initiative)
- Root Cause: **TEST MISMATCH - tests are stale**
- Issue: Tests expect `actor.update(updateObject)` with single argument
- Implementation: Calls `actor.update(updateObject, { ddbBridgeSync: true })` with TWO arguments
- Location: Main.js line 458 and line 246, plus similar patterns in other update calls
- Example failure:
  ```
  Expected: toHaveBeenCalledWith({ "system.attributes.hp.value": 45 })
  Received: toHaveBeenCalledWith({ "system.attributes.hp.value": 45 }, { "ddbBridgeSync": true })
  ```
- Why changed: Second argument `{ ddbBridgeSync: true }` is a loop-guard flag (phase4 feature)
  - Code checks: `if (options.ddbBridgeSync) return;` (main.js:74)
  - Prevents infinite sync loops when Foundry updates trigger a return sync to D&D Beyond
- Status: **TESTS ARE STALE** - implementation is correct per recent phase4 updates
- Severity: Medium - core functionality works, tests just need updating

### Failure Clusters

**Cluster A: content.test.js (20 failures) - Type: Import/Syntax**
- Symptom: All tests fail at import time
- Tests affected: All 20 tests in the file
- Root: Syntax error blocks module loading
- Tests are well-written but untestable until content.js is fixed
- Fix: Correct indentation in `handleIncomingState()` function

**Cluster B: router.test.js (6 failures) - Type: Test/Implementation Mismatch**
- Symptom: Assertion errors on `actor.update()` call arguments
- Tests affected: 
  - "should route STATE_SYNC to actor.update() for HP"
  - "should route STATE_SYNC to actor.update() for spell slots"
  - "should route STATE_SYNC to actor.update() for AC"
  - "should route STATE_SYNC to actor.update() for speed"
  - "should route STATE_SYNC to actor.update() for initiative"
  - One additional related test
- Root: Implementation passes additional `{ ddbBridgeSync: true }` options argument (phase4 loop-guard feature)
- Tests: Expect single-argument calls (pre-phase4)
- Fix: Update test assertions to include second argument in expected calls
- Related code: `main.js:458`, `main.js:246`, and similar update patterns

## Mocking & Setup Details

### Foundry/Chrome Globals Mocking

**jsdom environment setup:**
- `// @vitest-environment jsdom` enables DOM APIs
- `document.body`, `document.createElement()`, `window.addEventListener()` all available
- `MessageEvent` constructor works natively

**Foundry mock registration (before imports):**
```javascript
globalThis.Hooks = { once: vi.fn(...), on: vi.fn(...) };
globalThis.Actors = { registerSheet: vi.fn() };
globalThis.ui = { notifications: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }, windows: {} };
globalThis.game = { userId: "user1", actors: { find: vi.fn(...) } };
```

**Global state tracking:**
```javascript
globalThis.registeredHooks = {};  // Capture registered hook callbacks
Hooks.on = vi.fn((hook, cb) => {
  globalThis.registeredHooks[hook] = cb;  // Save for manual invocation
});
```

**Content.js globals (when/if it can load):**
- Exposes test helpers on `globalThis`:
  - `globalThis.findRollTarget`
  - `globalThis.extractActionData`
  - `globalThis.getRollMode()`, `setRollMode()`
  - `globalThis.checkRollDebounce()`, `resetRollDebounce()`
  - See content.js lines 623-640

### Async Testing Patterns

**MessageEvent dispatch + delay:**
```javascript
const event = new MessageEvent("message", { data: { ... } });
window.dispatchEvent(event);
await new Promise(resolve => setTimeout(resolve, 50));  // Wait for async handler
expect(mockActor.update).toHaveBeenCalled();
```

**Mocking async methods:**
```javascript
mockActor.update = vi.fn().mockResolvedValue({});  // Resolves to empty object
// Usage: await actor.update(...) works correctly in tested code
```

**Direct hook invocation:**
```javascript
const renderChatCallback = globalThis.registeredHooks.renderChatMessageHTML;
await renderChatCallback(mockMessage, mockHtml);  // Call hook manually
```

---

*Testing analysis: 2026-08-25*
