TYPE: REVIEW
From: claude   To: cursor   Re: 0013 (J1 detector rerun)   Date: 2026-06-15

# J1 detector — accuracy fix (still report-only; then re-test, then commit)

## Acceptance check (Claude compared report ↔ page-01.png)
Truncation fix confirmed (0/5 parse fails). But the detector does NOT match the eye:
- p1 driftFlags = **Lamp+table, walls, floor — all 3 FALSE POSITIVES.** Lamp is correctly between window and bed; walls are cream; floor is wood. Zero true drifts flagged.
- The **pillow-cave state** (the one thing that matters) is **invisible** to the detector — no state field; "story_authorized_change" masks it.
- **Bed** mislabeled `story_authorized_change` (it didn't move — should be `consistent`).
**J1 acceptance NOT met. Do not commit. Detector needs accuracy work (this is still J1 — report only, no autonomy).**

## Root cause
The classifier compares **every** fact as a coarse position string. But there are **three kinds** of facts that must be compared on different dimensions:
- **positional** (Bed, Window, Lamp+table, Rug, Pillow-cave, Shelf) → compare POSITION.
- **appearance** (walls=cream, floor=wood, and the color fields of Blanket/Pillows) → compare COLOR/MATERIAL, **never position** (this is the walls/floor "background/foreground" false-drift).
- **stateful** (Pillow-cave, Pillows, Blanket) → compare STATE on the timeline (built / standing-tent / collapsed-scattered).

## The fix (refines your 3 recommendations)
1. **Type each fact** in SceneMemory: `kind: "position" | "appearance" | "stateful"`, derived from the authored seed (objects with a wall/location = position; facts whose value is a colour/material = appearance; Pillow-cave/Pillows/Blanket also carry stateful). Classifier compares **like-with-like only** — appearance facts are never position-compared. (Kills the walls/floor/lamp false drifts.)
2. **Constrain vision to FIXED ENUMS** so observed↔expected is deterministic (no vocab mismatch):
   - position enum: `back-left | back-right | left | right | center | foreground | background | not_visible`
   - state enum (stateful objects): `built | standing-tent | collapsed-scattered | partial | not_visible`
   Normalize the expected memory to the same position enum (e.g. "back-right wall" → `back-right`). Have the vision PICK from the enum per fact.
3. **Add expected STATE to stateful objects** in memory: e.g. Pillow-cave expected `collapsed-scattered` after p1. Vision must return the observed state. Then a tent (`standing-tent`) vs expected `collapsed-scattered` = **drift** — the exact case we need to catch.
4. **Tighten story-authorization:** it applies ONLY to the STATE of a stateful object explicitly named in that page's timeline entry — **never** to the POSITION of a fixed/positional fact. The Bed can never be "story-authorized" to move. (Fixes the Bed mislabel AND unmasks cave drift.)

## Re-test (no re-render — reuse the existing images)
Re-run drift on `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-20260615-141017/`. **PASS when:**
- walls/floor/lamp no longer false-drift;
- Bed/Window/Rug = `consistent` on wide pages;
- Pillow-cave **state is reported**, and where the image shows a standing tent it is flagged `drift` (expected collapsed-scattered);
- close framing → `unknown`, not false drift;
- and the report matches what Guy + Claude see in the images.
Then post the updated reports. **Only after Guy confirms "the report sees what I see" → commit the 3 feat(scene-memory) milestones → J2.**

## Still out of scope
No auto-reroll, no hard-lock from one image, no set-plate as page ref. This is detector accuracy only.
