---
status: testing
phase: 05-repair-parse-fix-v14-compatibility-stale-tests
source: [05-VERIFICATION.md]
started: 2026-08-25T07:35:00Z
updated: 2026-08-25T07:35:00Z
---

## Current Test

number: 1
name: Live Foundry 14.367 install/enable
expected: |
  Install the `foundry-module` package on a running Foundry VTT 14.367 instance and attempt to
  enable it. Foundry's package browser/install flow accepts the module (no compatibility-gate
  rejection) and it enables successfully.
awaiting: user response

## Tests

### 1. Live Foundry 14.367 install/enable
expected: |
  Install the `foundry-module` package on a running Foundry VTT 14.367 instance and attempt to
  enable it. Foundry's package browser/install flow accepts the module (no compatibility-gate
  rejection) and it enables successfully.

  Why human: `compatibility.maximum` is enforced by Foundry core, an external system the
  verification environment cannot run. The manifest declaration itself has been independently
  confirmed correct (`{"minimum":"13","verified":"14.367","maximum":"14"}`), which resolves the
  diagnosed defect (a build-specific ceiling of `"14.363"` that excluded current stable). This
  was flagged as an advisory, deferred `<human-check>` in 05-01-PLAN.md Task 2, surfaced here
  per end-of-phase human-verification harvesting rather than dropped.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
