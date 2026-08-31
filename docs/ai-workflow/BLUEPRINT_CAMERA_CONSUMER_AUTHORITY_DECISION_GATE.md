# Decision Gate — Blueprint Camera Consumer Authority

Date: 2026-09-01
Branch: `codex/r1d-order-package-authority-binding`
Decision: proceed offline under Guy's standing authorization to restore the clean Wizard path.

## 1. Proposed change

Remove provider-authored `frameId` consumers from the Blueprint draft contract. The provider continues to choose each frame's `camera.affordanceId`; after canonical frame overlay, the compiler materializes the reciprocal `{ kind: 'frame', frameId }` only on the selected `camera_access` affordance.

## 2. Why now?

The consumed live run converged from 67 to 22 distinct diagnostics but retained all nine broad camera failures and eleven unresolved affordance consumers. A production-scale offline reproduction proved that corrupting only hidden frame-consumer IDs creates the exact nine-camera/nine-reference invariant. The provider is currently required to author IDs that the compiler owns and never exposes.

## 3. Scope

General system change to Blueprint draft schema, assembly, repair projection, execution-program cutover, replay compatibility, tests, and technical state. No story-, child-, companion-, or page-specific behavior.

## 4. Risk of hardcoding

Low. Binding derives from the existing provider-owned `frame.camera.affordanceId` and canonical overlaid frame identity for any cover/page count. It does not name Chameleon, Bar, Kim, or any concrete affordance ID.

## 5. Files likely affected

- `lib/visual-package/preRenderBlueprintDraftSchema.ts`
- `lib/visual-package/preRenderBlueprintAuthoring.ts`
- `lib/visual-package/preRenderBlueprintAuthoringContract.ts`
- `lib/visual-package/preRenderBlueprintProviderWire.ts`
- `lib/visual-package/blueprintAuthoringExecutionProgram.ts`
- focused Blueprint authoring/program/replay tests
- `CURRENT.md` and milestone evidence

## 6. Expected behavior after change

The provider owns camera choice and geometry but cannot author or spoof compiler frame identities. Camera reverse consumers are deterministic, canonical, and digest-stable. Non-frame consumers remain provider-owned and fully validated. The two residual non-frame incompatibilities remain genuine repair diagnostics.

## 7. Validation plan

An eight-page hostile harness must reproduce the former cascade and close it with one offline initial call and zero repairs. Tests must also prove shared cameras, spoof removal, non-camera consumer preservation, wrong camera kind/zone/membership rejection, schema compatibility, current-program cutover, frozen-program replay, and byte-identical replay of the consumed terminal/receipt/capture. Then run focused suites, `npx tsc --noEmit`, and the repository check proportionately.

## 8. Cost impact

Implementation and validation cost $0: no provider, image, audio, live authoring, or render. A later fresh live attempt is a separate gated action after independent QA PASS.

## 9. Rollback plan

Revert the focused commit. Frozen legacy execution programs and immutable runtime artifacts remain unchanged and replayable.

## 10. Review assignment

No unresolved product decision: camera choice remains provider-owned and validation strength is unchanged. Claude Code must try to falsify derivation scope, replay preservation, schema/program honesty, spoof resistance, and absence of transition/composition regressions.

## 11. Do not do

Do not weaken validation, derive action/placement/transition/safety consumers, change model/budget/retry/fallback, patch one story, reuse the consumed execution identity, call a provider, or render before PASS.
