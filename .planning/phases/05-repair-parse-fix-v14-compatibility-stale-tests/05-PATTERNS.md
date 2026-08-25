# Phase 5 — Pattern Map (Repair Phase)

**Produced:** 2026-08-25
**Note:** This phase creates **zero new files**. Every target already exists and is modified in
place, so the usual "new file → closest analog" mapping does not apply. What follows is the
**verified current state** of each in-scope file, checked against the real files (not paraphrased
from CONCERNS.md), plus the conventions the repair must respect.

---

## Verified baseline

```
$ npx vitest run --reporter=basic     # from alphaTest/
 Test Files  2 failed | 1 passed (3)
      Tests  25 failed | 30 passed (55)
```

25 failures = 20 (`tests/content.test.js`, all downstream of the parse error)
             + 5 (`tests/router.test.js`, stale assertions).

```
$ node --check chrome-extension/content.js
chrome-extension/content.js:617
  } finally {
    ^^^^^^^
SyntaxError: Unexpected token 'finally'
```

---

## 1. `chrome-extension/content.js` — the parse defect

`handleIncomingState()` spans lines 568-621. Verified brace structure:

| line | code | meaning |
|---|---|---|
| 568 | `function handleIncomingState(message) {` | opens fn |
| 569 | `  isSyncingFromFoundry = true;` | sets loop guard |
| 570 | `  try {` | **opens `try` — never closed** |
| 583 | `  if (diff.spellSlots) {` | opens the last inner block |
| 616 | `    }` | closes the `for (const lvl in ...)` at 584 |
| 617 | `  } finally {` | this `}` closes **583**, leaving `try` open → SyntaxError |
| 619 | `    setTimeout(() => { isSyncingFromFoundry = false; }, 100);` | guard release |
| 620 | `  }` | closes `finally` |
| 621 | `}` | closes fn |

**Fix:** insert exactly one `}` to close the `try` before the `finally` on 617. Verified: that
single brace makes `node --check` pass.

**Cosmetic only:** lines 574-616 sit at the pre-wrap indent level (2 spaces shallow). JavaScript is
not whitespace-sensitive — re-indenting is optional polish and is **not** the fix. Per 05-CONTEXT.md
D-01 it must not be treated as such.

**Watch:** line 572 is `if (!diff) return;` *inside* the `try`. That is fine — `finally` still runs
on an early `return`, so the loop guard is still released. Do not "fix" this.

---

## 2. `foundry-module/module.json` — the install blocker

Current (verified):

```json
"compatibility": { "minimum": "12", "verified": "14.359", "maximum": "14.363" },
"relationships": {
  "systems": [ { "id": "dnd5e", "type": "system", "compatibility": { "minimum": "3.0.0" } } ]
}
```

`compatibility.maximum` is **hard-enforced** by Foundry core — it restricts which versions may
install *and enable* the package. Current stable is 14.367, so the module is unloadable today.
`compatibility.verified` is advisory only and is safe to raise.

Target per 05-CONTEXT.md D-02 — generation ceiling, so patch releases don't re-break it:

```json
"compatibility": { "minimum": "13", "verified": "14.367", "maximum": "14" }
```

The `dnd5e` floor (`minimum: "3.0.0"`) has no guarantee of a v14-capable system (v14 needs 5.3.x).
Per 05-CONTEXT.md Claude's-Discretion: include only if it stays a one-line manifest change.

---

## 3. `foundry-module/scripts/main.js` — the echo-suppression pattern (DO NOT CHANGE)

Two paired sites, verified:

```
 74:  if (options.ddbBridgeSync) return;        // consumer — suppresses the echo
458:    await actor.update(updates, { ddbBridgeSync: true });   // producer — tags the write
```

This is the project's established loop-guard convention for two-way sync. `Actor#update(data,
options)` is **unchanged in Foundry v14**, so the two-argument call is correct. The tests are what
is stale. Per 05-CONTEXT.md D-03 this flag must **not** be removed to make tests pass.

---

## 4. `tests/router.test.js` — the five stale assertions

All five live in `describe("Foundry Module Message Router")` and all assert the **one-argument**
form while the code passes two. Verified assertion lines (CONCERNS.md quoted the enclosing `it()`
lines; these are the actual `expect` lines):

| `it()` | assertion | subject |
|---|---|---|
| 220 | **233** | HP |
| 238 | **256** | spell slots |
| 264 | **277** | AC |
| 283 | **296** | speed |
| 301 | **314** | initiative |

Existing style — every one reads:

```javascript
expect(mockActor.update).toHaveBeenCalledWith({
  "system.attributes.hp.value": 45
});
```

Fix shape (match the file's existing formatting; do not introduce a new assertion style):

```javascript
expect(mockActor.update).toHaveBeenCalledWith(
  { "system.attributes.hp.value": 45 },
  { ddbBridgeSync: true }
);
```

The 20 `content.test.js` failures need **no test edits** — they resolve once content.js parses.

---

## 5. Test invocation convention

- Runner: `vitest` 1.6.0, `jsdom` env. `package.json` `"type": "module"`.
- Full run: `npm test` (= `vitest run`), from `alphaTest/`.
- Scoped run: `npx vitest run tests/router.test.js`
- Parse check: `node --check chrome-extension/content.js`

---

## 6. Do NOT touch (05-CONTEXT.md D-04 scope fence)

The user explicitly deferred all security work this phase. Leave these exactly as they are, and do
not treat their presence as a phase failure:

- `content.js` `window.parent.postMessage(..., "*")` at lines 87, 192, 534 (CONCERNS.md misreports 192 as 195)
- `content.js` missing `event.origin` validation at line ~95
- `chrome-extension/rules.json` `x-frame-options` / `content-security-policy` removal
- Adding a `catch` to `handleIncomingState()`'s `try`/`finally`
- Removing `inspect-chrome*.js` / `dom-result.json` from version control

---

*Verified against working tree at commit 713f674.*
