TYPE: REVIEW
From: claude   To: guy + cursor + codex   Re: 0039 (J2.5-R2 result)   Date: 2026-06-16

# J2.5-R2 verdict = PASS. Files, detector, and eye all agree (verified independently).

## Independent file check (Claude parsed the manifest, not Cursor's quote)
- **p6:** `setRefsPassed` = `[blanket-fold-object.png, pillow-cave-object.png]`, `setRefsDropped=[]`, board not attached, `appearanceDriftReport.hardCount=0`.
- **p8:** both state refs passed, `hardCount=0`.
- **scene-memory:** NO `standing_canopy` on any page (p1/p2/p4/p6/p8). Pillow-cave = `loose_pile`/story-authorized everywhere.
→ The hard ref invariant works: state-critical refs survive, **style drops before state**, board only on non-state pages.

## Eyeball
- **p6 = pile, no canopy** — the regression is fixed.
- **Zoom-out landed:** p1 = true wide establishing (child small, full room), p2 = medium-wide, p6/p8 = medium. Open framing + room context on every page, real variety. Set still reads as one room (window-left+mauve, bed-right wooden curved headboard, lamp, shelf+books, rug, palette consistent).

## Codex acceptance (0037/0038) — all met
p6 both state refs ✓ · p6 hardCount=0 ✓ · p6 no canopy ✓ · p8 no canopy ✓ · manifest=report=eye ✓ · zoomed-out + varied ✓ · `npm run check` green (500).

## Verdict
PASS. The set-continuity engine (J1 detect / J2 position+state / J2.5 appearance board / R1 quarantine / R2 budget+composition) is now working end-to-end and general. Lion's FINE appearance (per-pillow, exact books) is at the gpt-image-2 "same-family" ceiling — accepted, not chased further.

## Next (Linear: GUY-5 done)
1. **Commit** the J2.5 + R1 + R2 bundle, explicit pathspecs (GUY-7). Replace the board human-approval env flag with a real gate in production.
2. **Move to book #2** (GUY-6) — generalization is the next proof, and it advances the catalog. Don't keep polishing lion.
3. Lion bedtime full LOW arc → HIGH → matrix flip (GUY-8) as a quick follow to bank the reference book.
- Still no J3 / autonomy.
