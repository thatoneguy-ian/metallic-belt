---
phase: 05-repair-parse-fix-v14-compatibility-stale-tests
reviewed: 2026-08-25T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - alphaTest/chrome-extension/content.js
  - alphaTest/foundry-module/module.json
  - alphaTest/tests/router.test.js
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-08-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

This is a narrowly-scoped repair phase: a one-brace parse fix in `content.js`, a Foundry/dnd5e
compatibility-block widening in `module.json`, and 5 test-assertion updates in `router.test.js`
to match the `ddbBridgeSync` loop-guard argument already present in `main.js`. Per the phase scope
note, pre-existing conditions (postMessage `'*'` targetOrigin, missing `event.origin` validation,
etc.) were explicitly deferred and are not re-litigated here.

I verified the diff against `75c7877..HEAD` directly (not just the file's current state) to isolate
what this phase actually changed:

- **content.js**: Confirmed via `node --check` and manual brace-depth tracing that the added `}` at
  the former line 617 correctly closes the `try` block opened in `handleIncomingState()`, restoring
  balanced `try { ... } finally { ... }` structure. This is a correct, minimal, necessary fix — no
  behavioral change beyond making the file parse. One quality issue found (see WR-01): the fix
  didn't restore correct indentation for the block it re-closed, leaving misleading indentation that
  was arguably the proximate cause of the original bug and could mislead a future editor into
  reintroducing it.
- **module.json**: `compatibility.maximum` was changed from a pinned build (`"14.363"`) to a bare
  generation number (`"14"`), with `verified` bumped to `"14.367"` (a build number nominally "above"
  the bare-generation maximum). This looks inconsistent at first glance, but it matches Foundry's
  documented/standard convention where a bare generation number for `minimum`/`maximum` means "the
  entire generation, all builds" rather than "build 0 of that generation" — this is the same pattern
  used by many published modules. I did not find this to be a functional bug, though see IN-01.
- **router.test.js**: All 5 changed assertions add the `{ ddbBridgeSync: true }` second argument to
  `actor.update()` expectations. I cross-checked this against `foundry-module/scripts/main.js:458`,
  which does call `actor.update(updates, { ddbBridgeSync: true })`, and against the `updateActor`
  hook at `main.js:74` (`if (options.ddbBridgeSync) return;`) that this flag exists to short-circuit.
  Ran the full suite (`npx vitest run tests/router.test.js`) — 21/21 pass. The test updates correctly
  reflect real, already-implemented behavior; they are not weakened or loosened in a way that would
  mask a regression.

No new bugs, security issues, or logic regressions were introduced by this diff. The two items below
are quality/maintainability observations, not correctness defects.

## Warnings

### WR-01: Indentation left inconsistent with brace nesting after the parse fix

**File:** `alphaTest/chrome-extension/content.js:574-617`
**Issue:** The brace fix at line 618 (`  } finally {`) is structurally correct, but the body it now
closes (the `if (typeof diff.hp === "number") { ... }` and `if (diff.spellSlots) { ... }` blocks,
lines 574-617) is still indented as if it were a sibling of `try {` rather than nested one level
inside it. The indentation doesn't reflect the actual brace depth. This is exactly the kind of
mismatch that produces missing/misplaced-brace bugs like the one this phase just fixed — a future
edit relying on the visual indentation (rather than counting braces) could easily reintroduce the
same class of parse error.
**Fix:** Re-indent lines 574-617 one level deeper to match their actual nesting inside the `try`
block, e.g.:
```js
function handleIncomingState(message) {
  isSyncingFromFoundry = true;
  try {
    const diff = message.data;
    if (!diff) return;

    if (typeof diff.hp === "number") {
      const hpInput = document.querySelector('input[name="currentHp"], .ct-health-summary__hp-number');
      if (hpInput && parseInt(hpInput.value, 10) !== diff.hp) {
        hpInput.value = diff.hp;
        hpInput.dispatchEvent(new Event("input", { bubbles: true }));
        hpInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    if (diff.spellSlots) {
      // ... (same content, one indent level deeper)
    }
  } finally {
    setTimeout(() => { isSyncingFromFoundry = false; }, 100);
  }
}
```

## Info

### IN-01: module.json version field not bumped alongside compatibility change

**File:** `alphaTest/foundry-module/module.json:5,14-27`
**Issue:** `compatibility.verified` was bumped from `"14.359"` to `"14.367"`, `compatibility.maximum`
widened from a pinned `"14.363"` to the bare generation `"14"`, and the `dnd5e` system's minimum
requirement was raised from `"3.0.0"` to `"5.3.0"` — but `"version"` at the top of the manifest
remains `"1.0.0"`, unchanged from before this compatibility repair. Foundry's package browser and
update-check flow key off the manifest `version` string to determine whether a newer release is
available; if this manifest is published without a version bump, installations already on `1.0.0`
may not surface the compatibility fix as an available update.
**Fix:** Bump `"version"` (e.g. to `"1.0.1"` or per project's semver convention) when publishing this
compatibility change, so Foundry's update mechanism picks it up.

---

_Reviewed: 2026-08-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
