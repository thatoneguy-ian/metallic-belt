# Coding Conventions

**Analysis Date:** 2026-08-25

## Naming Patterns

**Files:**
- Lowercase with hyphens for Chrome extension files: `content.js`, `background.js`, `manifest.json`
- Lowercase with hyphens for Foundry module files: `embedded-sheet.js`, `importer.js`, `main.js`
- Test files: lowercase with `.test.js` suffix (e.g., `router.test.js`, `content.test.js`)

**Functions:**
- camelCase for all function names
- Exported functions: `parseDDBCharacter()`, `normalizeItemName()`, `syncActorFromDDB()`
- Internal helper functions: `handleIncomingBridgeMessage()`, `getAbilityKey()`, `findRollTarget()`, `extractActionData()`
- Async functions marked with `async` keyword; return Promises via `.then()` or `await`

**Variables:**
- camelCase for local and module-level variables: `lastRollName`, `lastRollTime`, `pendingCardClick`, `characterId`
- State variables prefixed with underscore: `_rollMode` (for private state)
- Event listeners stored as named functions when exported to global scope: `getRollMode`, `setRollMode`

**Types/Classes:**
- PascalCase for class names: `DDBEmbeddedSheet`, `ActorSheet`, `MessageEvent`
- Constants/Enums: UPPERCASE strings used inline (e.g., `"advantage"`, `"disadvantage"`, `"flat"`)

**Prefixes:**
- Log messages prefix with `[DDB-Bridge]` to identify source: `console.log("[DDB-Bridge] ...")`
- Flagging system uses namespaced keys: `"ddb-bridge"` namespace, flags like `"characterId"`

## Code Style

**Formatting:**
- No formatter config detected (`.prettierrc` not found)
- **Indentation:** 2 spaces for function body, 4 spaces for nested blocks
- **Line length:** Functions range 20-480 lines; most under 100 lines except message handlers
- **Semicolons:** Required at end of statements
- **Quotes:** Double quotes for strings throughout

**Linting:**
- No ESLint config detected (`.eslintrc*` not found)
- Code follows implicit conventions (no style enforcement visible)

## Import Organization

**Order:**
1. Default imports: `import { DDBEmbeddedSheet } from "./embedded-sheet.js"`
2. Named imports: `import { parseDDBCharacter } from "./importer.js"`
3. Local path imports use relative `.js` extensions (ES module style)

**Path Aliases:**
- No path aliases configured; all imports use relative paths
- Test imports: `import { beforeEach, describe, expect, it, vi } from "vitest"`

**Module System:**
- ES6 modules (`.js` files with `type: "module"` in `package.json`)
- Explicit `.js` extensions in all import statements
- No default exports; all exports are named exports

## Error Handling

**Patterns:**

**Try-catch blocks:**
```javascript
// Example from main.js, lines 183-300
try {
  // ... parsing and update logic
  await actor.update(actorData);
} catch (err) {
  console.error(`[DDB-Bridge] Error updating actor from DDB JSON:`, err);
  ui.notifications.error("Failed to parse and update character data.");
}
```

**Error propagation:**
- Errors logged with `console.error()`
- User-facing errors shown via `ui.notifications.error()` (Foundry UI)
- Functions return `null` on missing data: `if (!labelEl) return null;`
- Guard clauses for early returns: `if (!actor) { console.warn(...); return; }`

**Null coalescing:**
- Used extensively for fallbacks: `avatarBase64 || actorUrl || null`
- Optional chaining not used; manual null checks instead: `if (message && message.source === "ddb-bridge-foundry")`

**Validation:**
- Input validation via type checks: `if (typeof data.hp === "number")`
- Existence checks: `if (!characterId) throw new Error("No D&D Beyond Character ID linked.")`

## Logging

**Framework:** `console` (browser console)

**Patterns:**
- Info logging: `console.log("[DDB-Bridge] Message here")`
- Warning logging: `console.warn("[DDB-Bridge] Warning: ...")`
- Error logging: `console.error("[DDB-Bridge] Error context:", error)`
- Always include `[DDB-Bridge]` prefix for module identification

**Usage:**
- Log at entry points: `console.log("[DDB-Bridge] Initializing D&D Beyond Bridge Module")` (main.js:6)
- Log significant state changes: `console.log("[DDB-Bridge] Roll mode → disadvantage")` (content.js:472)
- Log errors with context: `console.error("[DDB-Bridge] Error updating actor from DDB JSON:", err)` (main.js:297)
- Avoid logging sensitive data (character IDs are logged but considered non-sensitive)

## Comments

**When to Comment:**
- JSDoc blocks for exported functions (see `parseDDBCharacter`, `syncActorFromDDB`)
- Inline comments for complex DOM traversal or workarounds
- Explain WHY, not WHAT (good: "// Guard: ensure document.body exists" vs bad: "// check body")
- Comment state flags: `// State to track pending chat card clicks` (main.js:15)

**JSDoc/TSDoc:**
- Applied to exported/public functions
- Format: `@param`, `@returns`, description lines
- Example from `importer.js`:
  ```javascript
  /**
   * Parses D&D Beyond character JSON data into a Foundry VTT Actor and Items update structure.
   * Target: Foundry VTT v14 and D&D 5e system v3.x.
   * 
   * @param {Object} ddbData The character JSON returned from D&D Beyond API.
   * @returns {Promise<Object>} { actorData: Object, items: Array }
   */
  export async function parseDDBCharacter(ddbData) { ... }
  ```

## Function Design

**Size:** 
- Most functions 20-60 lines
- Message handlers (e.g., `handleIncomingBridgeMessage`) can reach 100+ lines due to switch routing
- Utility functions kept compact: `getAbilityKey()` = 9 lines, `getSkillKey()` = 8 lines

**Parameters:** 
- Functions take 1-3 parameters typically
- Destructuring not heavily used; simple objects passed as-is
- Rest parameters used in some handlers: `(...args)` for compatibility testing

**Return Values:** 
- Promise-returning functions marked `async`
- Null returns for "not found" cases: `return null` (e.g., `scrapeStatByLabel()`)
- Empty objects for no data: `return {}` (rare)
- Multiple return values via object destructuring: `const { actorData, items } = await parseDDBCharacter(ddbJson)`

**Visibility:**
- Exported functions: `export async function syncActorFromDDB(actor)`
- Internal-only functions: `function handleIncomingBridgeMessage(event)` (no export)
- Globally-exported for testing: `globalThis.findRollTarget = findRollTarget;` (content.js:624)

## Module Design

**Exports:**
- Module-level exports only: `export function`, `export class`
- Main entry: `main.js` re-exports `syncActorFromDDB()` for external use
- Importer module exports `parseDDBCharacter()` and `normalizeItemName()`
- Embedded sheet module exports `DDBEmbeddedSheet` class

**Barrel Files:** 
- Not used; imports go directly to specific modules
- Example: `import { parseDDBCharacter } from "./importer.js"` (not via index.js)

**Internal Modules:**
- `main.js` (`foundry-module/scripts/`) - Core Foundry hooks and message router, ~480 lines
- `importer.js` (`foundry-module/scripts/`) - D&D Beyond JSON parsing, ~400 lines
- `embedded-sheet.js` (`foundry-module/scripts/`) - Custom actor sheet UI
- `content.js` (`chrome-extension/`) - D&D Beyond iframe bridge, ~640 lines
- `background.js` (`chrome-extension/`) - Chrome extension background (not analyzed)

**State Management:**
- Module-level variables for state: `let pendingCardClick = null;` (main.js:16)
- Flag system for persistent data: `actor.getFlag("ddb-bridge", "characterId")`
- DOM-driven state changes (observers for HP, spell slots)
- Debounce guards to prevent duplicate processing: `checkRollDebounce()`, `shouldProcessClick()`

---

*Convention analysis: 2026-08-25*
