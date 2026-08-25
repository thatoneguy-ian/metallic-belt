# Codebase Concerns

<!-- refreshed: 2026-08-25 -->

**Analysis Date:** 2026-08-25

## Critical Issues

### Syntax Error: Unbalanced Braces in content.js handleIncomingState()

**Issue:** `alphaTest/chrome-extension/content.js` does not parse. Verified with `node --check chrome-extension/content.js`:

```
chrome-extension/content.js:617
  } finally {
    ^^^^^^^
SyntaxError: Unexpected token 'finally'
```

**What's Wrong:** The `try {` opened at line 570 is **never closed**. Counting braces from 570 to 617, the `}` on line 617 closes the `if (diff.spellSlots) {` block opened at line 583 — leaving `try` still open when `finally` is reached. The block is exactly one `}` short.

**Root Cause:** Commit `db1ad7d "fix: restore embedded iframe architecture"` wrapped the existing body of `handleIncomingState()` in a `try { … } finally { … }` loop-guard (the `finally` releases `isSyncingFromFoundry`), but the wrap was applied incompletely: the closing brace for `try` was never inserted, and the wrapped body at lines 574-616 was never re-indented.

**Note:** The de-indentation of lines 574-616 is a *cosmetic artifact* of that same incomplete edit, **not** the cause. JavaScript is not whitespace-sensitive; re-indenting alone will not make this file parse.

**Impact:**
- `node --check` fails on the file
- All 20 tests in `alphaTest/tests/content.test.js` fail with "Failed to parse source for import analysis"
- The Chrome extension content script will not load in a browser at all

**Fix Approach:** Insert a closing `}` for the `try` block immediately before the `finally` on line 617, then re-indent lines 574-616 by 2 spaces for readability. Verified: inserting that single brace makes `node --check` pass.

---

### Security: postMessage() Using '*' as targetOrigin

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/content.js` uses `window.parent.postMessage()` with `'*'` as the targetOrigin parameter in three places.

**Locations:**
- Line 87: `window.parent.postMessage({ ... }, "*");` (ROLL_ACTION message)
- Line 195: `window.parent.postMessage({ ... }, "*");` (DDB_JSON_RESPONSE message)
- Line 534: `window.parent.postMessage({ ... }, "*");` (STATE_SYNC message)

**Risk:** Using `'*'` sends the message to ANY origin, not just the intended Foundry VTT iframe. An attacker-controlled iframe at the same origin could intercept and exploit:
- Character ID numbers (`characterId` field)
- Roll action data (attack damage, spell slots, etc.)
- Full character JSON (stats, abilities, equipment)
- DDB Beyond state (HP, AC, initiative)

**Current Mitigation:** None. Messages are sent to all origins.

**Recommendations:**
1. Determine the exact origin of the parent window (Foundry VTT iframe)
2. Replace `'*'` with the specific origin, e.g., `window.parent.origin` or `'https://foundry-host:port'`
3. Store the safe origin as a configuration constant or derive it from `window.location.origin`

---

### Security: Missing event.origin Validation on Message Receivers

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/content.js` line 95 listens to messages but does not validate `event.origin`.

**Current Code:**
```javascript
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message && message.source === "ddb-bridge-foundry" && message.characterId === characterId) {
    // ... accepts message without checking event.origin ...
  }
});
```

**Risk:** An attacker can spoof the `source` and `characterId` fields in `event.data` from any origin. Without validating `event.origin`, the content script will accept malicious messages that:
- Trigger character state updates (HP, AC, spells)
- Steal character data from the D&D Beyond page
- Perform unwanted rolls or actions

**Recommendations:**
1. Add `event.origin` validation before processing messages:
   ```javascript
   if (event.origin !== window.parent.origin) return; // Only trust parent origin
   ```
2. Whitelist only Foundry VTT origins if deploying to multiple servers

---

### Security: X-Frame-Options and Content-Security-Policy Headers Removed

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/rules.json` strips two critical security headers from D&D Beyond responses:

**Current Rules (lines 8-9):**
```json
{ "header": "x-frame-options", "operation": "remove" },
{ "header": "content-security-policy", "operation": "remove" }
```

**Scope:** Applies to all requests matching `*://*.dndbeyond.com/characters/*` with resource type `sub_frame`.

**Why It's Dangerous:**
- **X-Frame-Options removed:** Originally set to `DENY` or `SAMEORIGIN` by D&D Beyond, preventing embedding. Removing this allows D&D Beyond to be embedded in ANY origin's iframe.
- **Content-Security-Policy removed:** D&D Beyond's CSP would restrict where scripts can be loaded from, what APIs can be called, etc. Removing it exposes the page to injection attacks if the parent window is compromised.

**Honest Assessment:** This is a **necessary trade-off for the embedded iframe architecture**. Without stripping these headers, the D&D Beyond sheet cannot be embedded in Foundry VTT. However, it shifts all security responsibility to Foundry VTT's Content Security Policy and the parent iframe's trustworthiness.

**Mitigations Already in Place:**
- Content script runs in `ISOLATED` world (`manifest.json` line 42), isolated from D&D Beyond's page scripts
- Messages are only processed if they come from the expected source

**Recommendations:**
1. Document this trade-off in comments in `rules.json`
2. Ensure Foundry VTT hosting is **HTTPS-only** and behind authentication
3. Add `Referrer-Policy: strict-origin-when-cross-origin` header from Foundry to prevent credential leakage
4. Monitor for any CSP bypasses or injection vulnerabilities in Foundry VTT

---

## High-Impact Issues

### Test Failures: All 20 Tests in content.test.js Failing

**Symptom:** Running `npx vitest run --reporter=basic` from `C:/ai-workspace/alphaTest/` results in:
```
FAIL tests/content.test.js (20 tests | 20 failed)
→ Failed to parse source for import analysis because the content contains invalid JS syntax.
```

**Root Cause:** The syntax error in `C:/ai-workspace/alphaTest/chrome-extension/content.js` (see Critical section above) prevents the test runner from loading the file.

**Affected Tests:** All 20 tests in:
- `describe("Companion Extension Content Script Helpers")`
- Suites: `findRollTarget`, `extractActionData`, `getRollMode / setRollMode`, context menu observer

**Impact:** Cannot validate that content.js helper functions work correctly.

**Fix:** Close the unbalanced `try` block in content.js (see Critical section).

---

### Test Failures: Five Tests in router.test.js Expecting Stale Signature

**Symptom:** Five of 21 tests in `alphaTest/tests/router.test.js` fail (16 pass) because `actor.update()` is called with a second parameter the assertions do not expect:

**Test Failures:**
- Line 238: `should route STATE_SYNC to actor.update() for spell slots`
- Line 256: `should route STATE_SYNC to actor.update() for AC`
- Line 277: `should route STATE_SYNC to actor.update() for speed`
- Line 296: `should route STATE_SYNC to actor.update() for initiative`
- And 1 more in the same suite

**Expected (Test):**
```javascript
actor.update({ "system.spells.spell1.value": 3, ... })
```

**Actual (Code):**
```javascript
actor.update({ "system.spells.spell1.value": 3, ... }, { ddbBridgeSync: true })
```

**Root Cause:** `C:/ai-workspace/alphaTest/foundry-module/scripts/main.js` line 458 passes a second parameter to `actor.update()`:
```javascript
await actor.update(updates, { ddbBridgeSync: true });
```

This flag is intentional—it prevents infinite loops when Foundry syncs state changes back to the D&D Beyond iframe (line 74 checks `if (options.ddbBridgeSync) return;`).

**Why It's Wrong:** The tests were written before this flag was added and only check the first parameter. Tests should validate that the flag is present.

**Fix Approach:** Update the test assertions to expect the options object as the second parameter:
```javascript
expect(mockActor.update).toHaveBeenCalledWith(
  { "system.spells.spell1.value": 3, ... },
  { ddbBridgeSync: true }
);
```

**Note:** The flag is necessary for the current architecture. Do NOT remove it from the code.

---

### Foundry Module Compatibility Window Too Narrow

**Issue:** `C:/ai-workspace/alphaTest/foundry-module/module.json` lines 14-17 declare a very tight compatibility range:

```json
"compatibility": {
  "minimum": "12",
  "verified": "14.359",
  "maximum": "14.363"
}
```

**Details:**
- **Declared ceiling:** 14.363, released 2026-05-22
- **Current Foundry stable:** **14.367**, released 2026-08-18 (14.364, 14.365, 14.366, 14.367 all postdate the ceiling)
- **Verified:** 14.359 — eight releases stale

**Risk — ALREADY REALIZED, not hypothetical:** Foundry **hard-enforces** `compatibility.maximum`; it restricts which versions can install and enable a package. On any current Foundry install (14.364 through 14.367) this module **cannot be installed or enabled at all**. This is a release blocker, not a maintenance item, and it is independent of the code defects above — even a fully repaired module would not load.

**Version-Sensitive Calls Detected in `C:/ai-workspace/alphaTest/foundry-module/scripts/main.js`:**
- Line 5: `Hooks.once("init", ...)` — Foundry hook API (stable but version-dependent)
- Line 8: `Actors.registerSheet()` — Actor sheet registration (API unchanged, but classes might)
- Line 18: `ui.windows` — Global UI state (used to find open sheets)
- Line 110: `instanceof DDBEmbeddedSheet` — Custom class comparison (fragile if class definition changes)
- Line 156: `game.actors.find()` — Global actor database access

**Recommendations:**
1. Test against Foundry 14.364+ and update `maximum` version
2. Add semantic versioning to the module (e.g., `1.0.0`) if not already in place
3. Monitor Foundry changelogs for breaking API changes in `Hooks`, `Actors`, `ui.windows`
4. Implement feature detection instead of version checks where possible
5. Document which Foundry APIs the module depends on for future maintenance

---

## Medium-Impact Issues

### Debug/Inspection Files Present in Repository

**Issue:** Five development tool files that should not be committed are present in `C:/ai-workspace/alphaTest/`:

**Files:**
- `C:/ai-workspace/alphaTest/inspect-chrome.js` (3.2 KB) — Chrome Remote Debugger Protocol inspector
- `C:/ai-workspace/alphaTest/inspect-chrome-list.js` (1.4 KB) — List format inspector
- `C:/ai-workspace/alphaTest/inspect-chrome-log.js` (4.6 KB) — Logging format inspector
- `C:/ai-workspace/alphaTest/inspect-chrome-raw.js` (4.0 KB) — Raw format inspector
- `C:/ai-workspace/alphaTest/inspect-chrome-session.js` (4.1 KB) — Session tracking inspector
- `C:/ai-workspace/alphaTest/dom-result.json` (287 KB) — Captured DOM inspection output

**What They Do:** These files use the Chrome Remote Interface library to connect to a running Chrome extension and inspect the D&D Beyond character sheet's DOM structure. They're used during development to understand which CSS classes to target.

**Problem:** They should not be in version control because:
1. They depend on a hardcoded Chrome debugger WebSocket URL (line 5 of inspect-chrome.js: `ws://127.0.0.1:9222/...`)
2. They're large (293 KB total, mostly dom-result.json)
3. They may contain sensitive session information or HTML snapshots

**Recommendation:** 
1. Add to `.gitignore`:
   ```
   inspect-chrome*.js
   dom-result.json
   ```
2. Remove from repository history (use `git rm` to stage for removal)
3. Move to a `.debug/` or `.local/` directory if needed for local development

---

### Foundry Module world: "MAIN" Content Script Security Consideration

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/manifest.json` lines 27-33 register shim.js to run in the MAIN world:

```json
{
  "matches": ["https://*.dndbeyond.com/characters/*"],
  "js": ["shim.js"],
  "all_frames": true,
  "run_at": "document_start",
  "world": "MAIN"
}
```

**Current Purpose:** `C:/ai-workspace/alphaTest/chrome-extension/shim.js` injects polyfills for `crypto.randomUUID()` and `crypto.subtle.digest()` when running on HTTP (non-HTTPS) origins.

**Risk Level:** **LOW** — the shim only provides cryptographic polyfills and doesn't expose sensitive data. However, running ANY code in the MAIN world is a potential attack surface.

**Considerations:**
- If the shim is modified to export functions to the page, it could leak data
- The MAIN world has access to the page's global scope, so it could theoretically be exploited if the shim is compromised
- D&D Beyond's page scripts could interfere with the shim

**Mitigations Already in Place:**
- The shim is read-only (no external input)
- It only augments crypto APIs, doesn't modify DOM or event handlers
- It logs when injected for transparency

**Recommendation:** 
1. Document why MAIN world is necessary (crypto polyfills for HTTP fallback)
2. If D&D Beyond ever supports HTTPS-only, migrate to ISOLATED world
3. Consider moving crypto polyfill to content script in ISOLATED world and exposing via postMessage if feasible

---

## Low-Impact Issues

### Potential Dead Message Type Handler

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/content.js` line 101 has a handler for message type `"STATE_UPDATE"`:

```javascript
else if (message.type === "STATE_UPDATE") {
  handleIncomingState(message);
}
```

**Concern:** The message type sent from main.js is also `"STATE_UPDATE"` (line 87), so this handler IS currently used. However, the name `STATE_UPDATE` vs the extension's `STATE_SYNC` could be confusing.

**Current Usage:**
- Sent by: `C:/ai-workspace/alphaTest/foundry-module/scripts/main.js` line 87
- Received by: `C:/ai-workspace/alphaTest/chrome-extension/content.js` line 101

**No Action Required:** The handler is actively used. This is not dead code, just noted for clarity.

---

### Missing Catch Block in handleIncomingState try-finally

**Issue:** `C:/ai-workspace/alphaTest/chrome-extension/content.js` lines 568-620 have a `try-finally` block without a `catch`:

```javascript
function handleIncomingState(message) {
  isSyncingFromFoundry = true;
  try {
    // ... handle incoming state ...
  } finally {
    setTimeout(() => { isSyncingFromFoundry = false; }, 100);
  }
}
```

**Concern:** If an error is thrown inside the try block, it will propagate after the finally block executes. The caller (`C:/ai-workspace/alphaTest/chrome-extension/content.js` line 102) has no error handling.

**Current Behavior:** Errors bubble up silently to the console but don't cause the extension to stop processing messages.

**Risk:** Malformed STATE_UPDATE messages could crash the handler, leaving `isSyncingFromFoundry = true` state corrupted if the finally block hasn't yet executed.

**Recommendation:** 
1. Add a `catch` block to log errors and reset state:
   ```javascript
   catch (err) {
     console.error("[DDB-Bridge] Error handling incoming state:", err);
   }
   ```
2. Or use `.finally()` on the async operation if using Promises

---

## Upstream Verification — Foundry VTT (checked 2026-08-25)

Verified against Foundry's published release list and developer documentation, since the codebase mapping alone cannot confirm platform requirements.

| Fact | Value | Consequence for this module |
|---|---|---|
| Current Foundry stable | **14.367** (2026-08-18) | Module's `maximum: "14.363"` is 4 releases behind |
| v14 generation went stable | 14.359 (2026-04-01) | The declared `verified` is the v14 launch build |
| `compatibility.maximum` semantics | **Hard enforced** by core — restricts which versions can install *and enable* a package | Module is unloadable on current Foundry |
| `compatibility.verified` semantics | Advisory only — does **not** block usage | Safe to raise; only `maximum` is blocking |
| dnd5e system for v14 | **5.3.x** required; 5.2.5 is **not** v14-compatible | `module.json` declares only `dnd5e minimum 3.0.0` — no upper guard, and no floor that guarantees a v14-capable system |
| AppV1 (`Application`, `FormApplication`, `Dialog`, `DocumentSheet`) | Deprecated since v13, scheduled for **removal in v16** | Still functional in v14 — a debt item for `foundry-module/scripts/embedded-sheet.js`, not a current blocker |
| `Actor#update(data, options)` signature | **Unchanged** in v14 | Confirms the `{ ddbBridgeSync: true }` loop-guard is a valid pattern — the *tests* are stale, not the code |
| `renderTemplate()` / `loadTemplates()` | Unchanged in v14 | `foundry-module/templates/embedded-sheet.html` loading path is safe |
| v14.367 release contents | Patch release; no module-facing API, CSP, or manifest changes | No additional migration work implied by the newest patch |

**Recommended `module.json` compatibility block:**

```json
"compatibility": { "minimum": "13", "verified": "14.367", "maximum": "14" }
```

Using the generation number `"14"` as `maximum` (rather than a specific build) is the conventional way to avoid re-breaking on every patch release. Raising `minimum` to `13` is worth considering separately: the module currently claims support back to v12, which is almost certainly untested and spans two AppV1 deprecation cycles.

**Not verified — needs a live check:** whether Foundry v14 serves a `Content-Security-Policy` with a `frame-src`/`child-src` directive that would block the D&D Beyond iframe from the Foundry side. The extension's `rules.json` only strips headers on the *D&D Beyond response*; it cannot relax a CSP that Foundry itself sends. This should be confirmed against a running 14.367 instance before the iframe architecture is declared sound.

---

## Summary by Severity

**Critical (Blocks any working install):**
1. Unbalanced `try` brace in `content.js` — file does not parse; content script cannot load at all
2. `module.json` `maximum: "14.363"` below current stable 14.367 — Foundry refuses to install/enable the module
3. `postMessage` with `'*'` targetOrigin — security vulnerability
4. Missing `event.origin` validation on message receivers — security vulnerability
5. Security headers stripped via `rules.json` — necessary for the iframe design, but shifts all trust to the Foundry origin

**High (Should Fix Soon):**
1. `content.test.js` — 20 failures, all downstream of the parse error (item 1)
2. `router.test.js` — 5 failures from stale assertions; the `{ ddbBridgeSync: true }` loop-guard is correct and must not be removed
3. `dnd5e` relationship declares only `minimum 3.0.0` — no floor guaranteeing a v14-capable system (5.3.x), no upper guard

**Medium (Fix Before Next Maintenance Release):**
1. Debug files in repository — code quality and size
2. MAIN world content script — potential attack surface (low risk currently)

**Low (Nice to Have):**
1. Error handling in handleIncomingState — robustness improvement

---

*Concerns audit: 2026-08-25*
