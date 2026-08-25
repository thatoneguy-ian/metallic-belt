---
phase: 05-repair-parse-fix-v14-compatibility-stale-tests
verified: 2026-08-25T07:35:00Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Install the `foundry-module` on a live Foundry VTT 14.367 instance and confirm the module can be enabled (not just that the manifest declares a compatible ceiling)."
    expected: "Foundry's package browser shows the module as installable/compatible, and it enables without an install-gate rejection."
    why_human: "`compatibility.maximum` is a hard-enforced gate inside Foundry core, external to this codebase. The automated checks in this report prove the manifest declaration is correct (minimum=13, verified=14.367, maximum=14) — which is the diagnosed defect — but only a running Foundry instance can confirm end-to-end install/enable. This item was explicitly deferred from a mid-plan human-check gate to end-of-phase verification by the plan author (05-01-PLAN.md Task 2 `<human-check>`), not dropped."
---

# Phase 5: Repair: parse fix, v14 compatibility, stale tests Verification Report

**Phase Goal:** Restore the D&D Beyond ↔ Foundry bridge to a working, installable, testable state after commit `db1ad7d` — `content.js` parses, the module installs and enables on Foundry 14.367, and the full test suite is green.
**Verified:** 2026-08-25T07:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `node --check chrome-extension/content.js` exits 0 (D-01) | ✓ VERIFIED | Ran independently from `alphaTest/`: `node --check chrome-extension/content.js` → exit 0. Confirmed `try` opened at line 570 is now closed by a `}` at line 618, immediately before `} finally {`. File grew from 641 → 642 lines (`wc -l` = 642). Line 574 retains its original two-space indent — no re-indentation, matching the "one brace, nothing else" constraint (D-01). |
| 2 | `npm test` reports `Test Files 3 passed (3)` / `Tests 55 passed (55)`, 0 failed — up from baseline 30 passed/25 failed | ✓ VERIFIED | Ran independently: `npm test` → `Test Files 3 passed (3)`, `Tests 55 passed (55)`. Also ran `tests/content.test.js` alone (20/20 pass, no test file edited) and `tests/router.test.js` alone (21/21 pass) to isolate each repair's effect. Third file `tests/importer.test.js` (14 tests) also green, unaffected by this phase. |
| 3 | `foundry-module/module.json` declares `compatibility.maximum` as the generation string `"14"` so Foundry's hard-enforced install gate admits 14.367 and later 14.x patches (D-02) | ✓ VERIFIED (manifest declaration only — see human verification item below) | Ran independently: `compatibility` = `{"minimum":"13","verified":"14.367","maximum":"14"}`, exactly matching D-02. Manifest still has 12 top-level keys (byte-identical elsewhere). `dnd5e` relationship floor raised to `"5.3.0"` with no `maximum` added, matching the Claude's-Discretion clause. The manifest-level fix is confirmed; live Foundry install/enable is not (external system, routed to human verification). |
| 4 | `foundry-module/scripts/main.js` still contains `actor.update(updates, { ddbBridgeSync: true })` exactly once — the echo-suppression loop guard survived the test repair (D-03) | ✓ VERIFIED | Ran independently: producer grep (`actor.update(updates, { ddbBridgeSync: true })`) → count 1. Consumer grep (`options.ddbBridgeSync`) → count 1. `git diff --name-only 713f674 -- ...` confirms `foundry-module/scripts/main.js` was NOT touched this phase. `tests/router.test.js` now asserts the two-argument form at 5 call sites (lines 235, 264, 286, 305, 324), verified by direct read of the file — not just the SUMMARY's claim. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `alphaTest/chrome-extension/content.js` | One line inserted (641→642), closes `try` in `handleIncomingState()` | ✓ VERIFIED | Confirmed via direct read (lines 566-622): `try` at 570, matching `}` at 618, `finally` intact. `node --check` exit 0. |
| `alphaTest/foundry-module/module.json` | 4 values changed, 12 top-level keys unchanged | ✓ VERIFIED | Full JSON dump confirms exactly the documented values; `id`, `title`, `description`, `version`, `authors`, `manifest`, `download`, `esmodules`, `styles`, `flags` all present and unchanged from plan's stated baseline. |
| `alphaTest/tests/router.test.js` | 5 assertions rewritten to two-argument form | ✓ VERIFIED | `grep -n "ddbBridgeSync"` shows exactly 5 occurrences at the documented line numbers (235, 264, 286, 305, 324), each `{ ddbBridgeSync: true }` as the second argument. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `content.js` `try` (line 570) | `finally` (line 618) | Balanced brace closing the loop-guard release path | ✓ WIRED | Read directly; `try { ... } finally { setTimeout(() => { isSyncingFromFoundry = false; }, 100); }` is structurally sound and `node --check` confirms the parser agrees. |
| `main.js` line 74 consumer (`if (options.ddbBridgeSync) return;`) | `main.js` line 458 producer (`actor.update(updates, { ddbBridgeSync: true })`) | Two-way-sync echo-suppression pair | ✓ WIRED | Both grep counts = 1; file untouched this phase (diff confirms); `router.test.js` now asserts this exact call shape at all 5 STATE_SYNC sites. |
| `module.json` `compatibility.maximum` | Foundry core's install gate | Manifest declaration Foundry reads at install/enable time | ⚠️ Declaration verified, external enforcement not observed | The value is correct per D-02's stated target and CONCERNS.md's dated upstream table, but this is an external system's behavior — see human verification item. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BRIDGE-01 | 05-01 | Two-way messaging channel between D&D Beyond and Foundry via extension background worker | ✓ SATISFIED | `content.js` now parses (prerequisite for any messaging to function at all); `router.test.js` (message routing) 21/21 green. |
| CHAR-01 | 05-01 | Initial character import into Foundry actor | ✓ SATISFIED | `tests/importer.test.js` (14 tests) green, unaffected by this phase's edits, confirming no regression was introduced to the import path while other defects were repaired. |
| SYNC-01 | 05-01 | Dice rolls from D&D Beyond appear in Foundry chat log | ✓ SATISFIED | `router.test.js` roll-routing assertions (attack/damage/save/check/skill) all pass, unmodified by this phase's Task 3 edits (only the 5 STATE_SYNC assertions were touched). |
| SYNC-02 | 05-01 | HP changes on D&D Beyond update Foundry actor | ✓ SATISFIED | `content.test.js` (20/20) and `router.test.js` HP-update assertions pass; `content.js` HP-handling code (lines 574-581) is now reachable since the parse error is fixed. |
| SYNC-03 | 05-01 | HP changes on Foundry update D&D Beyond sheet, avoiding infinite loops | ✓ SATISFIED | The `ddbBridgeSync` echo-suppression producer/consumer pair is confirmed intact and is now correctly asserted (not just implemented) by the 5 rewritten `router.test.js` expectations. `handleIncomingState()`'s `finally`-based lock release (the D&D Beyond-side half of the loop guard) is confirmed structurally sound. |

No orphaned requirements — all 5 IDs in `REQUIREMENTS.md`'s v1 section (`BRIDGE-01`, `CHAR-01`, `SYNC-01`, `SYNC-02`, `SYNC-03`) are declared in `05-01-PLAN.md` frontmatter and accounted for above. `SYNC-04`/`SYNC-05` are v2-deferred and out of this phase's scope.

### D-04 Scope-Fence / Prohibition Verification

All four `05-CONTEXT.md` D-04 deferrals and the plan's `must_haves.prohibitions` were independently re-checked (not trusted from SUMMARY):

| Prohibition | Verification run | Result |
|-------------|------------------|--------|
| `postMessage` `'*'` targetOrigin unchanged | `grep -vE '^\s*//' content.js \| grep -cF '}, "*");'` | 3 (matches baseline — untouched) |
| `event.origin` validation not added | Direct read of `content.js`; no origin check present; diff confined to the single brace insertion | Confirmed unmodified |
| `rules.json` header-stripping unchanged | `grep -cE '"(x-frame-options\|content-security-policy)"' rules.json` | 2 (unmodified); file absent from phase diff |
| No `catch` added, no re-indentation | Direct read of lines 566-622; `sed -n '574p'` | Two-space indent preserved; no `catch` clause present |
| `inspect-chrome*.js` / `dom-result.json` not removed | `git ls-files inspect-chrome.js dom-result.json` | Both still tracked |
| No AppV1 migration in `embedded-sheet.js` | `git diff --name-only 713f674 -- foundry-module/scripts/embedded-sheet.js` | Empty (file untouched) |
| Phase diff confined to exactly 3 files | `git diff --name-only 713f674 -- chrome-extension/ foundry-module/ tests/` | `chrome-extension/content.js`, `foundry-module/module.json`, `tests/router.test.js` only |

All prohibitions hold. Per the phase's scope note and D-04, the continued presence of the deferred security items (postMessage `'*'`, missing `event.origin` check, `rules.json` header stripping) is intentional and correctly NOT treated as a gap here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 3 modified files returned no matches | — | No debt markers introduced. |
| `chrome-extension/content.js` | 574-617 | Indentation still reflects pre-fix (unbalanced) brace nesting — flagged as WR-01 in `05-REVIEW.md` | ⚠️ Warning (quality, not correctness) | Explicitly and correctly deferred per D-01's own text ("re-indentation is cosmetic and optional... must not be treated as the fix"). Not a gap. |
| `foundry-module/module.json` | 5 | `version` field (`"1.0.0"`) not bumped alongside the compatibility change — flagged as IN-01 in `05-REVIEW.md` | ℹ️ Info | Not a must-have in this phase's plan; relevant only if/when the manifest is published for update-check purposes. Not a gap for this phase's goal (install/enable on a fresh 14.367 target, which this phase's checks do cover). |

Neither item blocks the phase goal; both were already surfaced by the phase's own code review (`05-REVIEW.md`, 0 critical findings) and are consistent with D-04's "repair only, no gold-plating" scope.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| content.js parses | `node --check chrome-extension/content.js` | exit 0 | ✓ PASS |
| Full suite green | `npm test` | `Test Files 3 passed (3)`, `Tests 55 passed (55)` | ✓ PASS |
| content.test.js isolated (no test file edited) | `npx vitest run tests/content.test.js --reporter=basic` | `Tests 20 passed (20)` | ✓ PASS |
| router.test.js isolated | `npx vitest run tests/router.test.js --reporter=basic` | `Tests 21 passed (21)` | ✓ PASS |
| module.json compatibility values | `node -e` JSON assertion (min=13, verified=14.367, max=14) | OK | ✓ PASS |
| Loop-guard producer/consumer intact | `grep` counts on `main.js` | 1 and 1 | ✓ PASS |
| Live Foundry 14.367 install/enable | — | not run (requires a running Foundry instance, unavailable in this environment) | ? SKIP — routed to human verification |

### Human Verification Required

### 1. Live Foundry 14.367 install/enable

**Test:** Install the `foundry-module` package on a running Foundry VTT 14.367 instance and attempt to enable it.
**Expected:** Foundry's package browser/install flow accepts the module (no compatibility-gate rejection) and it enables successfully.
**Why human:** `compatibility.maximum` is enforced by Foundry core, an external system this verification environment cannot run. The manifest declaration itself has been independently confirmed correct (`{"minimum":"13","verified":"14.367","maximum":"14"}`), which resolves the diagnosed defect (a build-specific ceiling of `"14.363"` that excluded current stable). This is the same item the plan's own Task 2 flagged as an advisory, deferred `<human-check>` — surfaced here per end-of-phase human-verification harvesting rather than dropped.

### Gaps Summary

No gaps found. All four plan-declared must-have truths were independently re-verified against the live codebase (not taken from SUMMARY.md), all three modified artifacts are substantive and correctly scoped, both key links (the brace/finally pair and the ddbBridgeSync producer/consumer pair) are wired and confirmed by direct file reads, and all six D-04 scope-fence prohibitions hold. The only open item is the live-Foundry install/enable confirmation, which is an external-system behavior outside what this environment can execute and was explicitly designed by the plan author to be deferred to end-of-phase human review rather than block the phase. This routes the phase to `human_needed`, not `gaps_found`.

---

_Verified: 2026-08-25T07:35:00Z_
_Verifier: Claude (gsd-verifier)_
