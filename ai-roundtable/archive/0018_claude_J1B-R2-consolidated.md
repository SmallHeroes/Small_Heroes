TYPE: BRIEF
From: claude (consolidating Guy policy + Codex precisions + Guy's visual notes)   To: cursor   Re: 0016/0017 + Codex draft   Date: 2026-06-15

# J1B-R2 — pile/canopy policy + general detector precision (report-only · no new renders · no J2)

## ⛔ GENERALITY (Guy's reminder — non-negotiable)
General mechanism, **no lion literals.** The canopy criteria, fixed-position logic, and appearance handling must apply to ANY fixed-location story (bedroom/clinic/classroom/…). Lion = test case only.

## Policy (Guy approved)
Loose **pile / nest / heap** of pillows = acceptable **collapsed/scattered** state. Only a **standing canopy / roofed tent / tunnel-like rebuilt fort** = **drift**. Do NOT over-call every non-flat heap as a tent — that would falsely fail the story-correct state (the fort collapsed and stays scattered).

### Canopy criteria (visual, not just an enum label)
- `standing_canopy` ⇒ **DRIFT**: visible roof/overhead plane, OR an entrance/tunnel, OR a pillow/blanket held up as a fort structure enclosing a space.
- `loose_pile` / `nest` ⇒ collapsed-acceptable: pillows stacked or leaning, soft mess, **no stable roof and no clear opening**. (`unknown` if cropped.)

## Fixes
1. **Bed position.**
   - **Verify the latest JSON first** — p2 may already be `consistent` after 0016; in the current 141017 render the bed is in fact consistently on the right (p1/2/4/8). Do not assume a false-drift that's already gone.
   - **p6** (close/cropped) bed → degrade to `unknown`, not `drift`.
   - General rule: a **fixed-position** fact needs strong wide/medium evidence before `drift`; never `drift` from a single low-confidence/coarse token.
2. **Pillow-cave state.**
   - p2/p4 standing canopy ⇒ DRIFT. p1/p6/p8 loose pile/nest ⇒ collapsed-acceptable (or `unknown` if cropped).
   - Add tests: `standing_canopy` ⇒ drift; `loose_pile` ⇒ pass.
3. **Reduce duplicate state noise.**
   - Make **Pillow-cave the PRIMARY state-bearing fact** for fort form.
   - Do NOT emit separate driftFlags for `Pillows`/`Blanket` unless their OWN story-authorized state is explicitly violated.
   - `Lamp` dimming ⇒ drift/story_auth only when that page authorizes a brightness state; otherwise `unknown` / appearance-only.
4. **Guy's visual observations — general detector targets (report, don't over-call).**
   - The detector must be able to catch, generally: **bed-wall flips**, **pillow-cave on-bed-vs-floor location** changes. Report these as POSITION drift (general; needs wide/medium evidence per fix 1).
   - **Top-pillow / individual-pillow colour variation** that stays WITHIN the locked palette (blue/purple/mustard/cream) is **NOT a hard drift** — report it as a LOW-severity appearance note at most. Pinning individual-pillow identity/colour page-to-page is a **J2 generation-continuity** goal, not a J1 detector overreach.

## J1 / J2 boundary (do not cross in this pass)
J1 = the detector SEES drift accurately. **Actually stopping** the bed-flip / cave-form / pillow-colour drift in the images is **J2** (use SceneMemory to constrain generation) — a GENERAL mechanism, later. **No generation-correction, no autonomy, no reroll, no hard-lock here.**

## Validation
- Re-run drift on the EXISTING images only — no new generation. `npm run check` green.
- Expected: p2/p4 Pillow-cave **drift**; p1/p6/p8 **NOT** tent-drift unless explicit canopy evidence; p6 Bed `unknown`; no wall/floor/shelf composition-word noise; no duplicate Pillows/Blanket/Lamp noise.
- Explicit pathspecs only (don't touch `public/*`, `HANDOFF*`, untracked scripts). Hold the J1 feat-commit bundle until Guy confirms report ↔ eye is clean.
- Write result as `0019_cursor_J1B-r2-result.md` + INDEX line.
