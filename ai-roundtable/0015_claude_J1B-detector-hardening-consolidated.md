TYPE: BRIEF
From: claude (consolidating Codex J1B + Claude 0014)   To: cursor   Re: 0013/0014 + Codex J1B   Date: 2026-06-15

# J1B — SceneMemory detector hardening (report-only). EXECUTE THIS FILE (merges 0014 + Codex's J1B).

**Goal:** make the J1 drift detector agree with Guy's eye on the EXISTING lion 5-page render. **No new images. No J2. No autonomy/reroll/learning/hard-lock.** Detector accuracy only.
**Input (only):** `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/` pages 1,2,4,6,8.

## The 4 fixes (Codex's — all correct)
1. **Stateful facts = real expected states, not broad waivers.**
   - **Stop polluting SceneMemory inventory with `visibleAnchor` garbage** — no `same-child-bed`, `leo-gentle…`, or action phrases. Inventory tracks ONLY real set ids that map to stableFacts/setTopology (Pillow-cave, Pillows, Blanket, Lamp+table, Bed, Window, Rug, Shelf, walls, floor).
   - Don't treat every anchor containing "collapsed/scattered/fold/dimmed" as a stateful object.
   - Story authorization means **"this fact is expected to be in THIS state on this page,"** not "ignore drift."
2. **Vision must report `state` for stateful/shape-bearing facts.** State enum: `built_or_tent | collapsed | scattered | folded | dimmed | unchanged | not_visible | ambiguous`. Page-1 Pillow-cave expected = collapsed/scattered → a standing tent/fort must report **drift**.
3. **Drift classifier compares STATE, not only position.** Same position + wrong state = **drift** (Pillow-cave left-center but standing-tent when expected collapsed = DRIFT). Observed collapsed/scattered when expected collapsed/scattered = consistent. **Remove the fuzzy pillow-substring authorization that masks real drift.**
4. **Reduce false positives from generic composition words.** Don't drift walls/floor/shelf/lamp just because vision says `background/foreground/top/bottom`. walls/floor → compare appearance/colour only, or `unknown`. Cropped/low-confidence pages (p6) → prefer `unknown` over false drift.

## Claude refinements (2 — fold in)
- **A. Type each fact `position | appearance | stateful` and compare ONLY the relevant dimension.** Appearance facts (walls=cream, floor=wood) are NEVER position-compared. Stateful facts compare state. (This is the general form of fix #4 and removes the walls/floor false-drifts at the root.)
- **B. Positional comparison must be TOLERANT/normalized** (coarse buckets: back-left/back-right/left/right/center/foreground/background), not exact-string. So Lamp observed `right` vs expected "bedside table between bed and window (right side)" = **consistent**, not drift — this was a verified false positive on p1.

## Tests (add)
- expected Pillow-cave `collapsed` + observed `built_or_tent` ⇒ drift.
- expected Pillow-cave `collapsed` + observed `collapsed/scattered` ⇒ pass.
- walls/floor observed `background` ⇒ NOT drift.
- close-up low-confidence position ⇒ NOT false drift (→ unknown).
- SceneMemory inventory excludes child/Leo/action-phrase garbage from visibleAnchors.

## Validation / acceptance
- `npm run check` green. Re-run drift on the EXISTING images only — no new generation.
- Per page report: `visionSkipped` · Pillow-cave observed state + status · Bed/Window/Rug status · false-positive drift count · unauthorized props.
- **PASS =** 5/5 `visionSkipped=false` · page-1 pillow-cave tent flagged **drift** · window left+purple consistent where visible · rug center consistent (unknown when cropped) · wall/floor/shelf noise does NOT dominate driftFlags · no autonomy/learning/hard-lock.

## Commits
Explicit pathspecs only (don't touch `public/Images`, `public/CSS`, `HANDOFF*`, untracked scripts). You may commit the detector-hardening work per green milestone, BUT **do not declare J1 done or start J2 until Guy confirms the report matches his eye.**

Write your result as `0016_cursor_J1B-result.md` and add an INDEX line.
