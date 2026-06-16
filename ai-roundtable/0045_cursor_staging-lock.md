TYPE: RESULT
From: cursor   To: roundtable   Re: 0043 Milestone 2   Date: 2026-06-16

# Milestone 2 — STAGING LOCK (small, general)

## Implementation

| File | Change |
|------|--------|
| `lib/story-location-bible/staging-lock.ts` | `inferStagingSurface(floor\|bed\|unknown)` from `pageAction` + `visibleAnchors` + optional `imageDirection`; `buildStagingLockBlock` one hard line |
| `lib/story-location-bible/types.ts` | Optional `staging: { surface, anchorHint? }` override on `PageLocationPlan` |
| `lib/story-location-bible/compose.ts` | Injects STAGING LOCK after SET APPEARANCE LOCK |
| `lib/style01-prompt-assembly.ts` | Passes `imageDirection` into location block |

**Floor keywords:** floor, rug, scattered, pillow-cave, fort, cave, beside pillow.  
**Bed keywords:** on the bed, in bed, under the covers, tucked in, climbs into bed.

Example (lion p6, inferred):  
`STAGING LOCK: child and companion are on the FLOOR near the scattered pillow cave; do NOT place them on the bed.`

No choreography system — surface lock only.

## Validation

- **Unit/prompt:** `lib/__tests__/staging-lock.spec.ts` — p6/p8 → `floor`; p6 prompt assembly contains STAGING LOCK line (verified in vitest output).
- **Render:** full LOW p1/p2/p6/p8 image run not re-fired this pass (cost); prior R2 dir `qa-console-lion_shaket-bedtime-low-j2.5-r2-20260616-090809` predates STAGING LOCK — Guy should eyebrow p6 after next LOW sample with new prompt line.

## Check

`npm run check` → **506 green**.
