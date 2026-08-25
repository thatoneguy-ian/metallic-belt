---
phase: 05-repair-parse-fix-v14-compatibility-stale-tests
plan: 01
subsystem: testing
tags: [javascript, foundry-vtt, vitest, chrome-extension, dnd5e]

# Dependency graph
requires:
  - phase: 04-two-way-sync
    provides: "The ddbBridgeSync echo-suppression pattern in main.js, and the handleIncomingState() function in content.js that this plan repairs the parse error in."
provides:
  - "A parsing content.js (Chrome extension content script loads in a browser again)."
  - "A foundry-module/module.json that Foundry core's install gate accepts on 14.367 and all later 14.x patches."
  - "A router.test.js suite whose assertions match the actual two-argument Actor#update(data, options) call shape, closing the false-negative gap that let the loop-guard regress undetected."
affects: [foundry-module, chrome-extension, testing]

# Actuals (#2632)
actuals:
  tokens: 1077
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "compatibility.maximum in Foundry module manifests should use the bare generation string (e.g. \"14\") rather than a specific build number, so patch releases don't re-break installation."

key-files:
  created: []
  modified:
    - alphaTest/chrome-extension/content.js
    - alphaTest/foundry-module/module.json
    - alphaTest/tests/router.test.js

key-decisions:
  - "Inserted exactly one closing brace to close the unbalanced try in handleIncomingState() (D-01); no re-indentation, no catch clause added."
  - "Widened module.json compatibility.maximum from a specific build (14.363) to the bare generation string (14), per D-02, so future 14.x patches don't re-break install."
  - "Raised the dnd5e relationship floor from 3.0.0 to 5.3.0 (Claude's-Discretion clause in 05-CONTEXT.md) since Foundry v14 requires dnd5e 5.3.x and 3.0.0 has no v14-capable guarantee."
  - "Rewrote 5 stale router.test.js assertions to the two-argument actor.update(updates, { ddbBridgeSync: true }) form (D-03); main.js was correct, the tests were stale."
  - "All D-04 deferred security items (postMessage targetOrigin '*', missing event.origin validation, rules.json header stripping) left untouched, confirmed by scope-fence checks."

patterns-established:
  - "Foundry module manifest compatibility.maximum should track the generation number, not a specific build, to avoid re-breaking install on every patch release."

requirements-completed:
  - BRIDGE-01
  - CHAR-01
  - SYNC-01
  - SYNC-02
  - SYNC-03

coverage:
  - id: D1
    description: "content.js parses under node --check and all 20 content.test.js tests pass without any test file being edited"
    requirement: "BRIDGE-01"
    verification:
      - kind: unit
        ref: "node --check chrome-extension/content.js"
        status: pass
      - kind: unit
        ref: "tests/content.test.js (20 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "foundry-module/module.json compatibility widened so the module installs and enables on Foundry 14.367 and later 14.x patches"
    requirement: "BRIDGE-01"
    verification:
      - kind: unit
        ref: "node -e compatibility JSON assertion (minimum=13, verified=14.367, maximum=14)"
        status: pass
    human_judgment: true
    rationale: "Automated checks prove the manifest declaration is correct, but only a live Foundry 14.367 instance can confirm end-to-end install/enable — flagged as advisory-only human-check in the plan, not a phase gate."
  - id: D3
    description: "5 stale router.test.js STATE_SYNC assertions rewritten to the two-argument actor.update(updates, { ddbBridgeSync: true }) form; loop-guard producer/consumer pair in main.js verified intact"
    requirement: "SYNC-01"
    verification:
      - kind: unit
        ref: "tests/router.test.js (21 tests)"
        status: pass
      - kind: unit
        ref: "npm test (55 tests, 3 files)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-25
status: complete
---

# Phase 5 Plan 1: Repair parse fix, v14 compatibility, stale tests Summary

**Closed the unbalanced try/finally in content.js, widened module.json's compatibility ceiling to the Foundry 14 generation string, and rewrote 5 stale router.test.js assertions to the two-argument actor.update() form — restoring the suite from 30 passed/25 failed to 55 passed/0 failed.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-25T07:19:46-05:00 (baseline test run)
- **Completed:** 2026-08-25T07:21:31-05:00 (final commit)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `chrome-extension/content.js` now parses (`node --check` exit 0, was exit 1 with `SyntaxError: Unexpected token 'finally'`) after inserting exactly one closing brace to close the `try` opened at line 570 of `handleIncomingState()`.
- `foundry-module/module.json` now declares `compatibility: {"minimum":"13","verified":"14.367","maximum":"14"}` (was `{"minimum":"12","verified":"14.359","maximum":"14.363"}`), so Foundry core's hard-enforced install gate admits current stable 14.367 and every later 14.x patch. The `dnd5e` relationship floor was also raised from `3.0.0` to `5.3.0`.
- 5 stale `router.test.js` assertions (HP, spell slots, AC, speed, initiative) rewritten from the one-argument to the two-argument `actor.update(updates, { ddbBridgeSync: true })` form, matching the code's actual (and correct) call shape.
- Full test suite: `Test Files 3 passed (3)`, `Tests 55 passed (55)`, 0 failed — up from the verified baseline of `Test Files 2 failed | 1 passed (3)`, `Tests 25 failed | 30 passed (55)`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Close the unbalanced try block in handleIncomingState()** - `a6be1f3` (fix)
2. **Task 2: Widen module.json compatibility so the module installs on Foundry 14.367** - `a4f1475` (fix)
3. **Task 3: Update the five stale router assertions to the two-argument form** - `581c6b3` (test)

**Plan metadata:** (to be committed after this SUMMARY)

## Files Created/Modified
- `alphaTest/chrome-extension/content.js` - Inserted one closing brace before the `finally` on line 617 to close the `try` opened at line 570 in `handleIncomingState()`. 641 -> 642 lines. No re-indentation, no catch clause, no other changes.
- `alphaTest/foundry-module/module.json` - `compatibility.maximum` changed from build-specific `"14.363"` to generation string `"14"`; `compatibility.minimum` `"12"` -> `"13"`; `compatibility.verified` `"14.359"` -> `"14.367"`; `relationships.systems[dnd5e].compatibility.minimum` `"3.0.0"` -> `"5.3.0"`. 12 top-level keys unchanged.
- `alphaTest/tests/router.test.js` - 5 `expect(mockActor.update).toHaveBeenCalledWith(...)` assertions rewritten to the two-argument form matching the file's existing formatting style. `mockTokenUpdate` and roll assertions untouched.

## Decisions Made
- Used the bare generation string `"14"` (not `"14.367"`) for `compatibility.maximum`, per D-02, so future Foundry 14.x patch releases don't re-break the install gate the way the previous build-specific ceiling did.
- Raised the `dnd5e` relationship floor to `5.3.0` under the Claude's-Discretion clause in 05-CONTEXT.md, since it was a one-line manifest change and CONCERNS.md records that Foundry v14 requires dnd5e 5.3.x.
- Did not add a `catch` clause to `handleIncomingState()`'s `try`/`finally` — explicitly deferred per D-01/D-04.
- Left `main.js` completely untouched — the `ddbBridgeSync` loop-guard producer/consumer pair was already correct; only the stale tests needed updating (D-03).

## Deviations from Plan

None - plan executed exactly as written. All three tasks were completed with the exact edits specified (one brace insertion, four manifest string values, five assertion rewrites), and no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None. All verification commands ran as expected with the plan's projected before/after outputs matching the actual outputs exactly.

## Verification Evidence (actual command output)

**Baseline (confirmed before any edit):**
```
$ node --check chrome-extension/content.js
SyntaxError: Unexpected token 'finally' (exit 1)

$ npx vitest run --reporter=basic
 Test Files  2 failed | 1 passed (3)
      Tests  25 failed | 30 passed (55)
```

**Final state (confirmed after all three tasks):**
```
$ node --check chrome-extension/content.js
(exit 0)

$ npm test
 Test Files  3 passed (3)
      Tests  55 passed (55)

$ node -e "...compatibility check..."
OK (minimum=13, verified=14.367, maximum=14)
```

**Regression guards (all pass):**
- `grep -vE '^\s*//' foundry-module/scripts/main.js | grep -cF 'actor.update(updates, { ddbBridgeSync: true })'` -> `1` (loop-guard producer intact)
- `grep -c 'options.ddbBridgeSync' foundry-module/scripts/main.js` -> `1` (loop-guard consumer intact)
- `wc -l < chrome-extension/content.js` -> `642` (one-line insertion, not a rewrite)
- `sed -n '574p' chrome-extension/content.js` -> `  if (typeof diff.hp === "number") {` (two-space indent preserved, no re-indentation)

**D-04 scope-fence checks (all pass — confirm deferred work was NOT done):**
- `grep -vE '^\s*//' chrome-extension/content.js | grep -cF '}, "*");'` -> `3` (all three postMessage `'*'` targetOrigin call sites unmodified)
- `grep -cE '"(x-frame-options|content-security-policy)"' chrome-extension/rules.json` -> `2` (deferred header-stripping rules untouched)
- `git diff --name-only 713f674 -- chrome-extension/ foundry-module/ tests/` -> exactly `chrome-extension/content.js`, `foundry-module/module.json`, `tests/router.test.js` — no more, no fewer
- `git diff --name-only 713f674 -- foundry-module/scripts/embedded-sheet.js` -> empty (no AppV1 migration performed)
- `git ls-files inspect-chrome.js dom-result.json` -> both still tracked (not removed from version control)

## User Setup Required

None - no external service configuration required. The plan's Task 2 `<human-check>` (installing the module on a live Foundry 14.367 instance to confirm end-to-end enable) is explicitly advisory-only and not a phase gate — the automated manifest checks prove the diagnosed install blocker (build-specific `compatibility.maximum`) is resolved.

## Next Phase Readiness
- The bridge's content script parses, the module manifest declares a Foundry-v14-compatible ceiling, and the full 55-test suite is green.
- All three D-01/D-02/D-03 defects diagnosed in CONCERNS.md are resolved; T-05-01 through T-05-04 (postMessage targetOrigin, event.origin validation, rules.json header stripping, MAIN-world shim) remain open by explicit D-04 deferral and are tracked in `.planning/codebase/CONCERNS.md` for a future hardening phase.
- No blockers for closing out Phase 5.

## Self-Check: PASSED

All 3 modified files exist on disk and all 3 task commits (`a6be1f3`, `a4f1475`, `581c6b3`) are present in git history.

---
*Phase: 05-repair-parse-fix-v14-compatibility-stale-tests*
*Completed: 2026-08-25*
