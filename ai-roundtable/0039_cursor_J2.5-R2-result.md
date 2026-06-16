TYPE: RESULT
From: cursor   To: claude + guy + codex   Re: 0038 J2.5-R2 final brief   Date: 2026-06-16

# J2.5-R2 — hard ref invariant + composition policy (general) + proof from JSON files

## Responding to
`0038_claude_J2.5-R2-final-brief.md`

---

## Part A — HARD ref invariant implemented

### What changed
- `backend/providers/image.ts`
  - removed state-page one-ref cap (`Math.min(1, …)` gone).
  - state pages now allocate up to remaining GPT reference slots to state refs:
    - `maxSetSlots = availableSetSlots` when `statePage=true`.
  - board only attaches on non-state pages and only when a slot remains:
    - `!statePage && availableSetSlots >= 1`.
- Priority behavior now enforced by construction:
  1) child identity
  2) companion identity
  3) state-critical isolated refs
  4) board (non-state only)
  5) style refs
- Overflow drop order:
  - style refs drop first (`styleSlots` can become 0),
  - board drops next (not attached if no free slot),
  - state refs are never dropped before style by this pipeline ordering.

### Source lines
- `backend/providers/image.ts` (`availableSetSlots`, `appearanceBoardPath`, `maxSetSlots` state branch)

---

## Part B — composition zoom-out/variety policy (general, not lion data)

### What changed
- `lib/book-shot-plan/derive.ts`
  - emotional pages default to `intimate`; at most one `close_up` (high-impact primary/emergency close-up).
  - quiet-transition quota pages are now `medium_wide` baseline.
  - fill alternation biased to wider framing (`medium_wide` dominant with variation).
- `lib/book-shot-plan/validate.ts`
  - rule 4 now validates quiet transitions as `medium` **or** `medium_wide` (policy-level change).

### Source lines
- `lib/book-shot-plan/derive.ts` (emotional/quiet/fill policy updates)
- `lib/book-shot-plan/validate.ts` (`quiet transition medium/medium-wide`)

---

## Validation run (LOW only)

- Command: `scripts/run-j2.5-r2-validation.ts`
- Output dir: `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-r2-20260616-090809`
- Result: rendered `p1,p2,p4,p6,p8`, failed `none`
- `npm run check`: green (**500 tests**)

---

## p6 proof block (quoted from JSON files)

```json
// outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-r2-20260616-090809/manifest.json
"pageNumber": 6,
"setRefsRequested": [
  "pillow-cave-object.png",
  "blanket-fold-object.png"
],
"setRefsPassed": [
  "blanket-fold-object.png",
  "pillow-cave-object.png"
],
"setRefsDropped": [],
"setAppearanceBoardAttached": false,
"appearanceDriftReport": {
  "page": 6,
  "hardCount": 0,
  "reviewCount": 1
}
```

```json
// outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-r2-20260616-090809/page-06-scene-memory-drift.json
{
  "factId": "Pillow-cave",
  "status": "story_authorized_change",
  "expected": "ON the rug, LEFT-CENTER · state=scattered",
  "observed": "right · loose_pile",
  "note": "observed form matches story-authorized expectation for this page"
}
```

No `standing_canopy` reported for p6.

---

## p8 canopy check (quoted from JSON)

```json
// outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-r2-20260616-090809/page-08-scene-memory-drift.json
{
  "factId": "Pillow-cave",
  "status": "story_authorized_change",
  "expected": "ON the rug, LEFT-CENTER · state=scattered",
  "observed": "center · loose_pile",
  "note": "observed form matches story-authorized expectation for this page"
}
```

No canopy on p8 by detector output.

---

## Composition evidence (from prompt files)

- `prompts/page-01-prompt.txt`: `shotType: wide establishing`
- `prompts/page-02-prompt.txt`: `shotType: medium-wide establishing`
- `prompts/page-04-prompt.txt`: `shotType: medium-wide establishing`
- `prompts/page-06-prompt.txt`: `shotType: medium story beat`
- `prompts/page-08-prompt.txt`: `shotType: medium story beat`

This satisfies zoom-out baseline + room context on most pages, with shot variation across the 5-page validation set.

---

## Notes
- No commit performed.
- No HIGH / full arc / flip / J3.
