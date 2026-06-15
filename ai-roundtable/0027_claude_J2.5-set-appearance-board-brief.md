TYPE: BRIEF
From: claude (consolidating Guy + ChatGPT + Codex proposal)   To: cursor   Re: J2.5 Set Appearance   Date: 2026-06-15

# Brief J2.5 — Scene Visual Memory / Set Appearance Board (proactive constraint + appearance detector; general; NO autonomy)

**PREREQUISITE:** the packaging fix in `0026` (commit `story-location-bible/index.ts` + hygiene + retry p6 on clean HEAD) must land FIRST. Build J2.5 on clean HEAD, not a dirty tree.

**Why J2.5:** J2 fixed the MACRO (positions + collapsed-vs-tent state). But object **appearance** still drifts — bed design/angle, shelf/books, curtains, pillows, and **lighting** are re-invented each page. The system "remembers a map, not a set." **Text alone can't fix appearance** (same lesson as topology: text locked position, not form). It needs a **visual** memory.

## ⛔ Generality (Guy's rule)
General mechanism, **no story literals.** Lion = test case. The Visual Set Board is **auto-generated + approved once per scene**, NEVER hand-drawn per story.

## Key technical principle (why this is safe)
An **isolated-objects board** (objects on a neutral background — the proven character-sheet pattern) teaches **appearance/identity WITHOUT dragging composition.** This is fundamentally different from a composed-room plate or a previous-page ref (which drag composition and stay banned). Because it's isolated objects, it is safe to attach as **one** reference and respects the 4-ref budget.

## Build
1. **Visual Set Board (auto, approve-once).** Per fixed scene, render a LOW character-free sheet of the scene's ISOLATED objects on neutral bg: bed/headboard + blanket pattern, window + curtains, lamp/table, shelf + book-block, rug, pillow-pile. Guy approves it ONCE → it becomes the appearance reference for every page of that scene. (Same "approve the set once" fast-QA flow as the anchor.)
2. **Scene Appearance Memory** (extend `SceneMemory`): bed silhouette/material/headboard; shelf shape + book COLOUR FAMILY (not exact spine order); pillow palette + shape family; curtain length/tie; **lighting target** (night, warm lamp, never daytime-bright); blanket/rug palette.
3. **SET APPEARANCE LOCK** prompt injection (extends SCENE MEMORY / SET TOPOLOGY LOCK): the appearance signatures as constraints.
4. **Board = the single set-appearance ref** on pages: budget = child + companion + board + style (= 4). The board replaces per-object element refs (it covers all objects in one slot). Never a composed scene; never attached on `close_up` if it would dominate.
5. **Appearance-drift detector** (extend J1) with SEVERITY TIERS:
   - **Hard fail:** bed changes wall, window moves, fort rebuilt as canopy, daytime lighting, shelf vanishes.
   - **Review:** bed design changes, shelf/books vary too much, pillows off-palette/family, a page noticeably brighter.
   - **Accept:** camera-angle variation, brush variation, book order, different folds.
6. **Tone/lighting consistency:** try the prompt **lighting-lock first** (consistent warm-night brightness from Scene Appearance Memory). Then a normalizer **catch**: measure luminance/warmth/saturation vs the book average, emit a raw-vs-normalized contact sheet, **don't harm skin/hair/fur**. Build on existing `lib/book-color-normalize.ts` (already default-on warm bias).

## Validation
Render lion `p1/p2/p4/p6/p8` LOW on clean HEAD. **Acceptance ≠ pixel-perfect — "same artist, same set":** same bed design family, same shelf/book family, same curtain length/colour, same pillow palette/form, same night lighting. The appearance detector's Hard/Review flags must match Guy's eye. `npm run check` green. **No full arc / HIGH / matrix flip until this passes.**

## Gates
Style01 only · don't regress Brief H / J1 / J2 / Round 1A · LOW only · general (no literals) · explicit pathspecs (don't touch `public/*`, `HANDOFF*`, untracked scripts) · **no J3 / autonomy / auto-reroll.**

## Honest scope note (CTO)
J2.5 is the long pole for "real book" polish and worth it under Guy's quality mandate + the 7.15 buffer — but validate on lion FIRST before applying the board mechanism across the 18 slots. The bar is "reads as the same set," not identical pixels (gpt-image-2 won't reproduce identical book spines — that's `Accept`).

Cursor: do `0026` packaging first (`0028_cursor_J2-packaging-result.md`), THEN J2.5 (`0029_cursor_J2.5-result.md`).
