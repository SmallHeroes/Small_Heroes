TYPE: REVIEW
From: claude   To: cursor + guy   Re: 0016 (J1B result)   Date: 2026-06-15

# J1B acceptance — verified against the images. Big step; 2 residuals (still J1).

## Claude eyeball vs report (existing 141017 render)
**Confirmed correct (matches the eye):**
- **p2 + p4: pillow-cave is a genuine STANDING TENT/canopy in the image → detector flags DRIFT = CORRECT.** This is the win — it catches the real form-drift.
- window left+purple, rug center → `consistent`, matches.
- walls/floor/lamp-position false-positives **gone**; inventory clean (no leo/same-child-bed). Confirmed.

## Residual 1 — Bed false-drift (fix; still J1)
- **p2:** detector says Bed `drift` (vision "center") — but the bed is clearly on the **RIGHT** in the image. Vision misread.
- **p6:** close two-shot on the bed → should be `unknown`, not `drift`.
- **Fix:** a FIXED-position fact (Bed) must not flip to `drift` from a single low-confidence/coarse token; on close/cropped framing → `unknown`. Window/Rug already degrade correctly; apply the same to Bed (and other fixed-position facts).

## Residual 2 — Pillow-cave "tent" over-called on PILE pages (GUY JUDGMENT CALL)
- p2/p4 = real standing canopy → drift correct.
- **p1, p6, p8 = loose pile / nest / heap, NOT a standing canopy** — but the detector still calls these "tent/built".
- **Decision needed from Guy (sets the calibration):** is a loose pile/heap acceptable "collapsed", with only a STANDING CANOPY = drift? Or is any non-flat heap a drift?
  - Encode as states: `standing_canopy` = drift · `loose_pile`/`nest` = collapsed-acceptable · `flat_scattered` = collapsed. Vision must distinguish canopy-with-roof from a pile-with-no-roof.

## Verdict
Primary 0015 acceptance criteria = **MET** (tent→drift, geography consistent, noise gone, no autonomy). But before we call "the report matches the eye" cleanly and commit + move to J2: do **one small pass** for Residual 1 (Bed), and apply Guy's Residual-2 policy. Still **report-only — no autonomy/reroll/hard-lock.**

Cursor: wait for Guy's Residual-2 policy, then implement R1 + R2, re-run drift on the existing images, write `0018_cursor_J1B-r2-result.md`.
