TYPE: BRIEF
From: claude   To: cursor   Re: 0040 + Guy blocking note   Date: 2026-06-16

# Commit the verified bundle, then a general STAGING LOCK (no story literals). Then book #2.

## Step 1 — commit J2.5 + R1 + R2 (the verified win)
`npm run check` green (500), J2.5-R2 verified PASS (0040). Commit, explicit pathspecs only:
`backend/providers/image.ts`, `lib/set-appearance/*`, `lib/book-shot-plan/derive.ts` + `validate.ts`, `lib/story-location-bible/*`, `lib/qa-console-run.ts`, `lib/book-color-normalize.ts`, the tests. Do NOT touch `public/*`, `HANDOFF*`, untracked scripts. Also replace the board `SET_APPEARANCE_BOARD_HUMAN_APPROVED` env flag with a real human-approval gate in the production board path (Linear GUY-7).

## Step 2 — general STAGING LOCK (fixes the bed/floor blocking incoherence)
**Problem (Guy, Claude-verified against the story):** the lion story stages its whole back half ON THE FLOOR by the scattered pillow-cave (p6/p7/p8 prose: "the pillows lay on the floor", "Leo curled up by the blanket", lamp dims). The story's p8 floor-nest ending is CORRECT. But the model rendered **p6 on the BED** (it read "blanket" as the bed's blanket) → an incoherent rug→bed→rug arc. The surface isn't locked per page.

**Fix — general, no story literals:**
1. Derive a per-page **staging surface** from the EXISTING page data (`pageAction` / `visibleAnchors` / imageDirection) via keyword inference:
   - floor/rug/cave/scattered/pillow-cave/fort → `floor` (near the named anchor)
   - bed/under the covers/climbs into bed/tucked in → `bed`
   - (fallback `unknown` → no staging line)
2. Render an explicit **`STAGING LOCK`** line in the prompt, e.g.: *"STAGING: the child and companion are on the FLOOR near the scattered pillow-cave; do NOT place them on the bed."* (values filled from the inference). `pageAction` stays authoritative; this just elevates the surface to a hard lock.
3. Add an OPTIONAL explicit `staging` field on the page plan that overrides the inference when set (for pages the heuristic misreads). General schema, no lion data required.

**Validate (lion LOW p1/p2/p6/p8):** p6 should now render the child + Leo **on the floor near the scattered cave** (not on the bed); the arc reads coherent (floor by the cave throughout, bed as backdrop). p8 stays the floor-nest ending. `npm run check` green.

**Caveat:** keyword inference is a heuristic — if it misreads, lean on the explicit `staging` override. Keep it small; don't build a full staging/blocking system.

## Out of scope
No HIGH, no full arc, no matrix flip, no J3. After this lands clean → **book #2** (Linear GUY-6), the generalization proof.

Write result as `0042_cursor_commit-and-staging-lock.md` + INDEX line.
