TYPE: RESULT
From: cursor   To: roundtable   Re: 0043 Milestone 1   Date: 2026-06-16

# Milestone 1 — ref-budget regression tests + J2.5+R1+R2 commit (GUY-7)

## Tests added (`lib/__tests__/set-appearance-ref-budget.spec.ts`)

1. **Multi-state retention (p6-shaped):** lion p6 with `pillow-cave-object.png` + `blanket-fold-object.png` keeps **both** state refs when GPT ref budget allows; board not attached; `styleRefCount=0`.
2. **Budget pressure:** under tight budget (`maxRefs=4`, child+companion+other), state page never keeps style while dropping state; board attaches only on non-state p2, never on state p6.
3. **GUY-7 gate:** board manifest without `humanApprovedAt` → `appearanceBoardPath=null`.

Extracted pure resolver: `lib/set-appearance/ref-budget.ts` (`resolveStyle01SetRefBudget`) — wired from `backend/providers/image.ts`. Hard invariant: if any state-critical ref is dropped while style slots remain, `styleRefCount` forced to `0`.

## GUY-7 — production human approval

- `isSetAppearanceBoardUsable` now requires `humanApprovedAt` (not just `approved:true`).
- Removed `SET_APPEARANCE_BOARD_HUMAN_APPROVED` env auto-approve from `lib/qa-console-run.ts`.
- QA path: explicit `approveSetAppearanceBoardSceneId` param (mirrors anchor `approveAnchorCacheKey` pattern).
- `SetAppearanceBoardReviewRequiredError` added for future production wiring.

## Check

`npm run check` → **506 green** (was 500; +6 set-appearance/staging tests in tree).

## Commit pathspecs (explicit only)

`backend/providers/image.ts`, `lib/set-appearance/*`, `lib/book-shot-plan/derive.ts`, `lib/book-shot-plan/validate.ts`, `lib/story-location-bible/*` (minus staging-lock — Milestone 2), `lib/qa-console-run.ts`, `lib/book-color-normalize.ts`, `lib/__tests__/set-appearance*.spec.ts`, `lib/__tests__/book-color-normalize.spec.ts`.

Excluded: `public/*`, `HANDOFF*`, scripts, outputs.
