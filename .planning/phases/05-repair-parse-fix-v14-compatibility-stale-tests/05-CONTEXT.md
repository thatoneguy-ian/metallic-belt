# Phase 5: Repair: parse fix, v14 compatibility, stale tests - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

> **Provenance note:** This context was NOT gathered via a full `/gsd-discuss-phase` run.
> It records the scope decisions the user stated at the `/gsd-plan-phase 5` context gate,
> anchored to the diagnosed defects in `.planning/codebase/CONCERNS.md` (audited 2026-08-25).

<domain>
## Phase Boundary

Restore the D&D Beyond ↔ Foundry bridge to a **working, installable, testable** state after the
failed implementation recorded in commit `db1ad7d`. Three defect classes are in scope: the
`content.js` parse error, the Foundry v14 compatibility ceiling that blocks installation, and the
stale test assertions. This is repair work only — no new capability, no hardening, no refactor.

</domain>

<decisions>
## Implementation Decisions

### Project posture
- **[informational]** This is a **proof of concept, not a production build.** The user's explicit
  instruction: *"Build fast and cheap so that we can adjust quickly and then strengthen once we
  know we can make it work."* Prefer the smallest change that restores function. Do not gold-plate,
  do not refactor adjacent code, do not add abstraction for future flexibility.

### Parse repair
- **D-01:** Fix the unbalanced `try` block in `chrome-extension/content.js` `handleIncomingState()`
  by inserting the single missing closing `}` before the `finally` on line 617. `node --check` must
  pass. Re-indentation of the wrapped body is cosmetic and optional — it is explicitly not required
  for correctness and must not be treated as the fix.

### Foundry v14 compatibility
- **D-02:** Widen `foundry-module/module.json` `compatibility` so the module installs and enables on
  current Foundry stable (14.367). Use the generation number as the ceiling
  (`"maximum": "14"`) rather than a specific build, so patch releases do not re-break it.
  `compatibility.maximum` is hard-enforced by Foundry core; `verified` is advisory.

### Stale tests
- **D-03:** Update the five stale assertions in `tests/router.test.js` to expect
  `actor.update(updates, { ddbBridgeSync: true })` — the two-argument form. The `ddbBridgeSync`
  loop-guard flag in `foundry-module/scripts/main.js` is **correct and must not be removed**; the
  tests are what is wrong. `Actor#update(data, options)` is unchanged in Foundry v14.

### Scope fences — explicitly NOT this phase
- **D-04:** **No security work this phase.** The user stated directly: *"we aren't trying to raise
  any security items right now."* The following CONCERNS.md items are deferred, not forgotten:
  `postMessage` `'*'` targetOrigin, missing `event.origin` validation, and the
  `X-Frame-Options` / `Content-Security-Policy` stripping in `rules.json`. Plans must not
  touch these, and their continued presence must not be treated as a phase failure.

### Claude's Discretion
- Task ordering and wave assignment within the repair.
- Whether the `dnd5e` relationship floor is tightened (CONCERNS.md flags `minimum 3.0.0` as having
  no v14-capable guarantee) — include it only if it is a one-line manifest change; skip it otherwise.
- How test success is demonstrated (full `vitest run` vs. targeted file runs), so long as the
  previously failing counts are shown to be resolved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnosed defects — the primary source for this phase
- `.planning/codebase/CONCERNS.md` — Per-defect root cause, exact file:line, and verified fix
  approach for all three in-scope defect classes. Also carries the dated upstream verification
  table for Foundry 14.367, `dnd5e` 5.3.x, and `Actor#update` signature semantics.

### Codebase orientation
- `.planning/codebase/ARCHITECTURE.md` — Extension ↔ module message flow.
- `.planning/codebase/TESTING.md` — Test layout and runner conventions.

</canonical_refs>

<specifics>
## Specific Ideas

- The parse error is a **one-brace** fix, already verified: inserting the closing `}` makes
  `node --check chrome-extension/content.js` pass. Resist any larger rewrite of
  `handleIncomingState()`.
- The 20 `content.test.js` failures are entirely downstream of the parse error — they are expected
  to resolve without touching the test file.

</specifics>

<code_context>
## Existing Code Insights

### Integration Points
- `chrome-extension/content.js` — `handleIncomingState()` (the parse defect); loop-guard release
  lives in its `finally`.
- `foundry-module/scripts/main.js` — line ~458 `actor.update(updates, { ddbBridgeSync: true })`;
  line ~74 `if (options.ddbBridgeSync) return;` consumes it.
- `foundry-module/module.json` — `compatibility` block.
- `tests/router.test.js` — five assertions at ~lines 238, 256, 277, 296.

### Established Patterns
- The `ddbBridgeSync` options flag is the project's echo-suppression pattern for two-way sync.
  Preserve it.

</code_context>

<deferred>
## Deferred Ideas

- All security hardening from CONCERNS.md (postMessage targetOrigin, `event.origin` validation,
  `rules.json` header-stripping trade-off documentation) — deferred by explicit user decision (D-04).
- Removing the `inspect-chrome*.js` / `dom-result.json` debug files from version control.
- Adding a `catch` block to `handleIncomingState()`'s `try`/`finally`.
- AppV1 deprecation migration in `foundry-module/scripts/embedded-sheet.js` (removal in v16).
- Live confirmation of whether Foundry v14 sends a `frame-src`/`child-src` CSP that would block the
  embedded D&D Beyond iframe from the Foundry side — open question in CONCERNS.md, unverified.

</deferred>

---

*Phase: 05-repair-parse-fix-v14-compatibility-stale-tests*
*Context gathered: 2026-08-25*
