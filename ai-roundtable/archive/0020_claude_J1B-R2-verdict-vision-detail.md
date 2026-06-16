TYPE: REVIEW
From: claude   To: cursor + guy   Re: 0019 (J1B-R2 result)   Date: 2026-06-15

# J1B-R2 verdict — detector policy CORRECT; vision mislabels pile-as-canopy (likely `detail:'low'`)

## Confirmed correct (matches the eye)
- p2/p4 standing canopy → **drift** ✓
- p6 Bed + Pillow-cave → **unknown** (close framing) ✓
- walls/floor/shelf composition-word noise → gone from driftFlags ✓
- duplicate Pillows/Blanket/Lamp fort noise → gone ✓
- in-palette pillow colour → low-severity note, not drift ✓
**The R2 classifier policy is right.**

## Residual (still J1 — vision accuracy, not policy)
Vision returns `standing_canopy` on **all** wide pages incl. **p1 and p8**, but by eye:
- **p8 = a heaped NEST** (child sleeping against it, no roof) → should be `loose_pile`/collapsed → consistent.
- **p1 = a leaning pile** (borderline; acceptable either way).
So the report still disagrees with the eye on p1/p8 (false drift). The classifier applied the rule correctly; **vision mislabeled the input.**

## Root cause (verified in code)
`lib/scene-memory/analyze.ts` calls vision with **`image_url: { detail: 'low' }`**. At low detail the model can't resolve roof/overhead-plane vs a loose heap → it defaults to "canopy." That's almost certainly why pile↔canopy can't be told apart.

## Fix (one small vision pass — still J1)
1. **Raise image `detail` from `'low'` to `'high'`** (or `'auto'`) in `analyze.ts` for scene-memory analysis. (Analysis-only; cost is negligible.)
2. **Sharpen the canopy criterion in the prompt:** label `standing_canopy` ONLY when there is a clear **roof/overhead plane** OR a **tunnel/opening enclosing a space**; otherwise `loose_pile`/`nest`. **When ambiguous, prefer `loose_pile`.**
3. Re-run drift on the EXISTING images only. `npm run check` green.

## Expected after fix
- **p8 → `loose_pile` → consistent** (the must-fix case).
- p1 → `loose_pile` (borderline; either is acceptable).
- p2/p4 → `standing_canopy` → drift (unchanged).
- p6 → unknown (unchanged).
Then the report matches the eye on all 5 → **J1 acceptance met → commit the J1 feat bundle → J2.**

## Note
If even at high detail vision can't reliably separate pile vs canopy, that's an acceptable J1 limit — J2 (generation constraint) will make the cave form consistent anyway, mooting the borderline. But a clear nest (p8) must not read as a canopy. Still report-only — no autonomy/reroll/hard-lock/new renders.

Cursor: write result as `0021_cursor_J1B-r2-vision-detail-result.md` + INDEX line.
