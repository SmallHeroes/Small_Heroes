TYPE: BRIEF
From: claude   To: cursor   Re: 0022 (J1 commit)   Date: 2026-06-15

# Part A — finish landing J1 (commit the uncommitted shared-path wiring), then Part B — J2 brief

## Part A — commit the SceneMemory shared-path wiring (do first)
J1 commit `be0fb34e` committed `lib/scene-memory/*` + `image.ts` + rerun script, but **left uncommitted** the files that carry `sceneMemoryPlan` through the shared QA/prod lock context (Claude verified all three reference `sceneMemory`):
- `lib/book-image-lock-context.ts`
- `lib/qa-console-book-lock-context.ts`
- `lib/generation-pipeline/chunk-runner.ts`
This is the J1 shared-path integration (the anti-divergence point). **Commit it** (explicit pathspecs, `npm run check` green) so J1 is fully landed and J2 builds on committed ground. If any of those diffs are NOT scene-memory wiring (e.g. unrelated edits), separate them and only commit the scene-memory parts. Report what each diff contained.

## Part B — J2 brief: SceneMemory-driven GENERATION CONSTRAINT (proactive; no autonomy)
**Goal:** use the SceneMemory the detector now produces to **constrain generation** so the drift J1 catches stops happening in the images — the pillow-cave stays collapsed (no rebuilt tent), the bed/window/rug hold position, the palette holds. **General mechanism, no lion literals.** This is what makes the book read as one consistent room.

**What J2 is / isn't:**
- ✅ Proactive prompt/ref constraint from SceneMemory (stronger, per-page, memory-driven).
- ❌ NOT auto-reroll, NOT a detector-in-the-loop at generation time, NOT confidence auto-hard-lock — those are J3. Pure proactive constraint.

**Mechanism:**
1. **Per-page expected STATE drives a forceful constraint.** From the stateful timeline, when a fact's expected state on this page is `collapsed`/`scattered`, emit a specific, strong instruction — e.g. (built generally from memory, not hardcoded): *"The pillow fort has COLLAPSED into a low scattered pile on the rug — NOT a standing tent, canopy, teepee, or rebuilt fort."* Respect the timeline: if a page legitimately shows it built, don't force collapsed. Drive entirely from the memory's per-page state.
2. **Fixed-position facts as hard constraints** (bed wall, window side, lamp, rug) — strengthen/extend the existing SET TOPOLOGY LOCK (Round 1A) using the memory.
3. **Palette/appearance facts as constraints** (pillow palette, wall/floor colours).
4. Keep `pageAction` + `BookShotPlan` authoritative for camera/pose; the constraint governs SET identity/state only.

**Validation (the closed loop — this is the payoff of building the detector first):**
- Render lion `p1/p2/p4/p6/p8` LOW — a NEW render (generation changed).
- Run the **J1 detector** on the new images → expect drift ≈ 0: pillow-cave `collapsed` on all pages (no canopy), bed/window/rug `consistent`, palette holds.
- Guy eyeballs. **The J1 detector now verifies the J2 fix automatically.**

**Gates:** Style01 only · don't regress Brief H or Round 1A · LOW only · no HIGH, no matrix flip · `npm run check` green · explicit pathspecs (don't touch `public/*`, `HANDOFF*`, untracked scripts) · general — no story literals.

**Deliverable:** Part A commit report, then J2 implementation + the new LOW render + the J1 drift reports on it. Write result as `0024_cursor_J2-result.md` + INDEX line. (If anything in J2 looks like it needs autonomy/reroll — STOP, that's J3, flag it instead.)
