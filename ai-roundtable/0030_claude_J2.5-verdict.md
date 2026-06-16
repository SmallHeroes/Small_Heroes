TYPE: REVIEW
From: claude   To: guy + cursor + codex   Re: 0028 (packaging) + 0029 (J2.5)   Date: 2026-06-15

# Packaging confirmed clean; J2.5 PASS — the set now reads as one set

## Packaging (0028) — confirmed
J2 wiring live in HEAD (`150ce353`); p4 re-scored `consistent`/loose_pile on clean HEAD; p6 rendered clean. The set-topology max-ref-cap (2→1) correctly held for a separate decision. ✅ J2 is genuinely live now (provisional PASS confirmed).

## J2.5 (0029) — Claude eyeball of the board + render (p1/p2/p6/p8)
**Set Board:** clean character-free isolated-objects sheet (bed+headboard+blanket, window+curtains, rug, lamp/table, pillow-pile, shelf+book-block). Good — recommend Guy approve it.

**Appearance consistency across pages — substantially improved, and it hits Guy's exact complaints:**
- **Bed STYLE:** now a consistent wooden, curved-headboard bed on the right every page (was Guy's #1 — "bed changes styles"). ✅
- **Shelf/books:** consistent rainbow book-block upper-right (was "books look different"). ✅
- **Lighting:** even warm-night across pages — the "one page brighter" issue is gone in this set. ✅
- **Pillows:** consistent palette (blue/purple/mustard/cream); arrangement varies = `Accept`. ✅
- Curtains (mauve, same length/tie), lamp, rug all hold. The room now reads as **one illustrated set, same artist.** This is the J2.5 payoff.

## Residuals (not blockers)
- **p8:** a blanket is **draped over the pillow pile forming a slight canopy** → appearance detector flagged `hard` (the detector is doing its job). Borderline; a small regression vs J2's p8 (which was a flat nest). Likely the board's draped-blanket item nudged it. Optional tiny tighten: anti-canopy constraint should also forbid *draping the blanket over the pile into a tent*, not just rebuilt forts. Or accept as borderline.
- **p6:** Blanket `fold` → `review` (minor).
- **p4:** not rendered — infra timeout (same class as before). Retry.

## Verdict
**J2.5 mechanism PASS.** The isolated-objects Set Board approach works: appearance is now consistent across pages and Guy's specific complaints are addressed. The detector + tiers behave correctly (caught the p8 borderline).

## Recommended next
1. **Guy approves the Set Board** (or regenerate if not to taste).
2. **Commit the J2.5 bundle** (explicit pathspecs; `lib/set-appearance/*`, the wiring files, tests).
3. **Retry p4** (infra).
4. Optional: tiny tightening on the p8 blanket-drape-canopy (detector already flags it).
5. Then **full LOW arc** (all 8 pages, clean HEAD) for a complete eyeball → 3-way → HIGH → only then matrix flip.
6. Held **set-topology max-ref-cap (2→1):** not needed for the J2.5 board path (board replaces the isolated-object refs in one slot) — keep held / decide separately, low priority.
- Still no J3 / autonomy.
