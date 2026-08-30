# R1D Blueprint terminal-receipt exhaustiveness and incident evidence — Decision Gate

## 1. Proposed change

Make the Blueprint runner's emittable terminal-failure set the single source used by receipt replay, and persist a bounded immutable incident when an exception occurs after the single-use paid-call claim but before terminal publication.

## 2. Why now?

The current approved Chameleon chain produced claim `466252b4a082ea6b98503bb2bc3e433a36408cfb61d1fd305afcbfa2b9804b64` and then stopped as `execution_state_uncertain` without a receipt or terminal manifest. The runner can honestly emit `repair_route_input_not_admissible`, but the lifecycle replay allowlist omits that code. A valid failed receipt can therefore be rejected before its first durable write, after which the generic catch loses the causal phase and permanently fences the authority.

## 3. Scope

General Blueprint execution and evidence handling only. No story, child, companion, page, prop, style, or Chameleon-specific rule is permitted.

## 4. Risk of hardcoding

The fix must not add a story literal or another independent terminal-code list. The runner-emittable set must be shared with replay validation and covered by a drift regression.

## 5. Files likely affected

- `lib/visual-package/productionAuthoringRunner.ts`
- `lib/visual-package/qaWizardBlueprintAuthoringLifecycle.ts`
- their focused specs
- `scripts/qa-wizard-blueprint-authoring.ts` only if needed to expose a safe incident locator
- `CURRENT.md` and focused implementation evidence

## 6. Expected behavior after change

- Every terminal receipt the runner can produce passes lifecycle replay validation.
- `repair_route_input_not_admissible` persists as `authoring_failed` and replays without another provider call.
- A post-claim exception writes only closed, sanitized, claim-bound incident evidence: phase, receipt availability/status/digest when locally available, and explicit unknown provider outcome.
- Re-entry remains fail-closed and provider-unreachable. Incident bytes are immutable and conflicting evidence is rejected.
- Existing candidate, failed-terminal, claim, terminal lookup, and recovery behavior remains compatible.

## 7. Validation plan

Use injected offline providers and crash seams. Prove the exact missing-code route, direct receipt replay, lifecycle terminal persistence and zero-call replay, incident phase binding before receipt and at receipt publication, immutable conflict rejection, historical terminal recovery, TypeScript, focused suites, and `git diff --check`.

## 8. Cost impact

External cost is `$0`. No credential, network, provider, image, audio, database, or render operation is authorized.

## 9. Rollback plan

Revert the focused code/test/docs commit. Existing artifacts are versioned and remain readable; no historical runtime artifact is mutated by this milestone.

## 10. Review assignment

Guy's standing authorization covers the offline correction needed to reopen the Wizard path. Claude independently diagnosed the missing terminal code and will adversarially re-gate the immutable correction range. Codex remains technical owner and validates every finding. No product or creative review is needed.

## 11. Do not do

Do not delete, edit, supersede, or retry the existing claim. Do not infer provider billing or output from elapsed time. Do not fabricate or reconstruct the lost receipt. Do not introduce automatic redispatch, a replacement paid-attempt lane, a story-specific workaround, a model/prompt/schema/budget change, provider access, or render.
