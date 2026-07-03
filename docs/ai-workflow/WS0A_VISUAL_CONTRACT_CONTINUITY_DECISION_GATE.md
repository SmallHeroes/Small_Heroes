# WS0a Visual Contract Continuity Decision Gate

## 1. Proposed change
Tighten the vNext visual-contract structural validator so cross-page zone movement is fail-closed: undeclared steady/before-transition teleports fail, transitions must depart from established zones, and a valid threshold page rendered at the destination can be followed by its matching `after_transition`.

Also refresh the `legitOutdoor` golden snapshot after changing its fixture from an undeclared steady zone jump to an explicit transition.

## 2. Why now?
Codex stop-time review found two WS0a followup issues before session close:
- the changed `legitOutdoor` fixture left its golden snapshot stale
- the new continuity check rejected a valid threshold-at-destination sequence

This blocks accepting the deterministic WS0a slice cleanly.

## 3. Scope
General system change, enforcement OFF. This is a structural validation/test fix for the vNext visual-contract foundation only.

## 4. Risk of hardcoding
Low. The fix is zone/transition-state-machine based and does not mention any story, child, companion, product slot, or page-specific production data. The `legitOutdoor` fixture remains a generic playground example.

## 5. Files likely affected
- `lib/visual-contract-compiler/validateVNextVisualContract.ts`
- `lib/__tests__/visual-contract-vnext-ws0.spec.ts`
- `lib/__tests__/visual-contract-compiler.spec.ts`
- `lib/__tests__/__snapshots__/visual-contract-vnext-ws0.spec.ts.snap`

## 6. Expected behavior after change
- A steady page cannot silently move from zone A to zone B.
- A `before_transition` page remains in the origin zone.
- A `threshold` or `after_transition` must depart from an established origin zone.
- A `threshold` page may be rendered at either origin or destination.
- A matching `after_transition` after a threshold-at-destination remains valid.
- The golden snapshot matches the current `legitOutdoor` fixture.

## 7. Validation plan
Smallest safe validation:
- `npx vitest run lib/__tests__/visual-contract-vnext-ws0.spec.ts lib/__tests__/visual-contract-compiler.spec.ts`

Session gate:
- `npm run check`

No render, no page generation, no full book.

## 8. Cost impact
No image/audio/API cost. Deterministic local TypeScript/Vitest only.

## 9. Rollback plan
Revert the four WS0a followup files listed above. Because enforcement remains OFF and no delivery/readiness/atomic code is touched, rollback is isolated to validator/test/snapshot behavior.

## 10. What ChatGPT should review
- Whether the continuity rule remains general and fail-closed without rejecting legitimate threshold-at-destination staging.
- Whether the positive and negative tests cover the intended boundary.
- Whether snapshot refresh is limited to the changed fixture.

## 11. Do not do
- Do not enable WS1/WS2 enforcement.
- Do not touch atomic receipt, delivery, readiness, prompt threading, adapters, or WS0b frozen-contract wiring.
- Do not run a render or spend image generation budget.
- Do not stage unrelated marketing/checkpoint files.
