# BRIEF (CC) — fox contract: TWO distinct openings (listening WINDOW + balcony DOOR), unambiguous

## 1. ROUTING + TARGET BRANCH
- **Executor:** Claude Code (CC). **Target:** `feat/chunked-generation` (`sh-wt-style01`). Branch pre-check first (HEAD `c2dec36f`); single session.
- **Gate:** authoring/DATA + spec only (fox contract + location bible). No engine/board-code change. Cowork verifies; the proof is the re-mint QA + eyeball.
- **Origin — reversing Brief 1 on render evidence (Guy approved):** the fox board mint kept producing a window/door **HYBRID** opening (board-QA correctly failed `opening-kind-not-in-contract`; Guy confirmed "a combination, not good"). Root cause: the story moves the child from INSIDE (window, room — p1-3) to OUTSIDE (מרפסת, railing — p4+); that transition is **physically a door**. "Window only, no door" (Brief 1) fights physics, so gpt-image renders a hybrid. This also affects the pages, not just the board.

## 2. SCOPE
Re-author the fox set to **TWO clearly-distinct, unambiguous openings** that are NEVER conflated or hybridized:
- a **small listening WINDOW** — the p1 spot: an ordinary casement window at the crouching child's chest height, in the room wall, overlooking the balcony (the ticking is heard through/under it).
- a **glazed BALCONY DOOR** — the way OUT (p2+): a full-height glazed balcony/French door the child opens and steps through onto the balcony. Clearly a DOOR, distinct in size/shape/purpose from the window.

Both look onto / access the SAME balcony (railing, bucket-under-drip corner, chair, slipper). The window is for listening; the door is the exit. This was CC's original intent (window + balcony_door) — restored, but with the **key fix**: the two openings are explicitly DIFFERENT elements (small window ≠ full door), so neither renders as the other and neither hybridizes. Consistency across pages is the whole point (Guy: "just make it consistent").

## 3. FILES / AREAS
- Fox `story-bank/v3-approved/fox_uri_adventure.visual-contract-template.json`:
  - Keep the `window` SpatialNode (listening spot, small casement, chest-height sill).
  - **Re-add a distinct `balcony_door` SpatialNode** (the access zone) — glazed, full-height, "the way out onto the balcony", explicitly NOT the same as the listening window.
  - **REMOVE the Brief-1 `mustNotShow` entries that forbid a door / vitrine** (we now WANT a clear door).
  - `WALL OPENINGS` must authorize BOTH: `window, balcony_door`.
  - Add mustNotShow/steering that forbids **conflating** them: no window-door hybrid, the window is small and the door is full-height, they are two separate openings.
  - Update the Tier-A `stableGeometry` projection and Tier-B `mustShow`/`mustNotShow` accordingly.
- Fox `...location-bible.json`: window + a distinct balcony door (not "window/door" ambiguity, not door-less — two clear openings).
- The fox spec (`fox-uri-adventure-structured-contract.spec.ts`): assert BOTH a `window` node AND a distinct `balcony_door` node exist, and that the door-forbidding mustNotShow is gone.

## 4. ACCEPTANCE CRITERIA
- Fox contract has TWO distinct openings: `window` (listening, small) + `balcony_door` (access, glazed, full-height), clearly differentiated in description + kind; `WALL OPENINGS` authorizes both.
- No `mustNotShow` forbids a door anymore; instead steering forbids a window/door HYBRID (they must be visibly separate openings).
- Validates under Stage-3 + Stage-4; Tier-A/B hold; fox NOT recompiled; bunny canary green; `npm run check` green (tsc via node).
- `setDefinitionHash` will CHANGE (the set topology gained the door) → a fresh board key; that's expected.

## 5. TESTS
- Fox spec: `window` node present AND `balcony_door` node present AND they are distinct; door-forbid mustNotShow removed; WALL OPENINGS includes both.

## 6. WHAT NOT TO TOUCH
- Engine/compiler/validator, the `lib/set-identity-board/` code, Stage-1 safety, money, reader. Only the fox contract DATA + location bible + the fox spec.

## 7. GIT HYGIENE
Explicit pathspecs; NEVER `git add -A`. Commit on `feat/chunked-generation`; Guy pushes.

## 8. FINAL VERIFICATION
- `npm run check` green. Report the fox contract diff (window kept + balcony_door restored distinct + door-forbid removed + WALL OPENINGS both), confirm not recompiled. Then STOP — Guy re-mints; the board's WALL OPENINGS now include `balcony_door` so a clearly-rendered door passes QA, and window≠door distinctness should stop the hybrid.
