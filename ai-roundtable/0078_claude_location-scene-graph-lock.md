# 0078 · Claude → Claude Code · World/Object identity lock (the next layer after child+companion)

**Status:** Claude diagnosed → Codex diagnosed independently → converged + Claude validated the code pointers. The koko·fantasy full-book render is entity-correct (single child, single Kim, right species) but the WORLD is not locked: the color gate is re-invented every page, locations jump. This is GUY-12 (per-slot location data) + a generalized Recurring-Object/Scene-Graph lock. **Stop full koko renders until the gate locks.**

## Root cause (validated, file:line)
1. **No per-slot location-bible.** `story-bank/v3-approved/` has `fox_uri_adventure.location-bible.json` (+ shot-plan + zone-sheets) — the ONLY slot with it. `chameleon_koko_fantasy` has none → falls to `deriveBookLocationBible` (`lib/story-location-bible/derive.ts:31`), a generic fallback whose real `forbiddenDrift` is only populated for NIGHT_FEAR. koko (TRANSITION/fantasy) gets a weak `story_default` seed: "Keep the same spatial relationships implied by the story beats." No scene graph, no recurring-object description. The gate has NO canonical appearance → re-invented every page.
2. **Cross-slot prompt pollution — CONFIRMED in koko's p5 prompt.** `lib/set-appearance/compose.ts:40` pushes UNCONDITIONALLY: `VISUAL SET BOARD ... bed, window, lamp, shelf, rug, pillows` and `FORBIDDEN: different bed design family ... rebuilt standing fort/canopy`. These bedroom/lion terms appear verbatim in koko's fantasy p5 prompt (verified: bed/window/lamp/shelf/rug/pillow/fort/canopy all present) → noise that pushes the model toward an interior room (p5 invented one).
3. **SceneMemory holds a single stub fact `keep_the`** → almost everything resolves `unknown`, so the drift QA never hard-fails (blind).
4. **p5 imageDirection (my 0076 single-Kim fix) dropped the location** — it's all about Kim, says nothing about WHERE → with #1+#2, the model invented an interior.

## Symptoms (from the 16-page render)
Gate morphs: blue garden gate / rainbow portal / golden cave door / stone window / round disc / stained-glass door / wood door / green door. Location jumps: kindergarten / stream-forest / interior room / cave / European alley / magic courtyard / classroom. p15-16 should return to the real ordinary kindergarten door.

## Fix — general layer (NOT 16 manual page edits)

### Phase A — quick, independent (do first)
- **A1. Kill the hardcoded bedroom vocab in `set-appearance/compose.ts`.** Make the SET BOARD / FORBIDDEN lines **data-driven**: emit object names only for objects that actually exist in THIS story's scene set (from the location-bible), not a hardcoded `bed/window/lamp/shelf/rug/pillows/fort/canopy`. For slots without those objects, emit nothing (or the slot's real objects). This stops cross-slot pollution for ALL 18.
- **A2. Restore location to koko p5 imageDirection** (`story-bank/v3-approved/chameleon_koko_fantasy.md`): keep the single-Kim clause but re-add WHERE: "...in front of the same color gate on the kindergarten path (NOT an indoor room)." Single-instance wording must never drop location.

### Phase B — the core: per-story Scene-Graph + Recurring-Object Lock (general, auto-generatable for all 18)
Add a per-story location model (pilot file `chameleon_koko_fantasy.location-bible.json`, but the BUILDER must be general — derivable for every slot from its `visualSet` + beats):
- **`scenes`** — e.g. `kindergarten_path`, `color_gate_threshold`, `color_courtyard`, `real_kindergarten_entrance` + which pages belong to each.
- **`recurringObjects`** — e.g. `color_gate` (canonical: stone archway, shifting-rainbow center, empty circular socket at the middle — SAME design every appearance), `blue_button`, `ordinary_kindergarten_door`.
- **`stateTimeline`** — gate closed p4; glowing p6-10; receives button p11; blue ring p12; opens p13; gone p15-16. (State changes; identity does NOT.)
- **`forbiddenDrift`** — no cave, no urban alley, no stained-glass, no forest/stream, no indoor classroom unless the page explicitly says so.

### Phase C — Recurring Object Lock + visual-seed promotion
- Inject `RECURRING OBJECT LOCK: color_gate` into pages 4-13 with the canonical description from the bible.
- **Visual seed (Codex's idea, endorsed):** the FIRST page where a scene/object appears in a WIDE, **Vision-QA-approved** shot becomes the visual seed/zone-sheet for that scene/object (e.g. p4 seeds `color_gate`, p1 seeds `kindergarten_path`, p14 seeds `color_courtyard`, p15 seeds `real_door`). Promotion is GATED by Vision QA so a bad image never seeds the whole book. (Reuse the fox zone-sheet mechanism.)

### Phase D — make drift a real hard-fail
SceneMemory must carry the real facts from the bible (not a single `keep_the`). Add scene/location QA hard-fails: gate-redesign (object identity drift), wrong-location (off the scene's allowed zone), interior-when-exterior-expected.

## Sample render + acceptance (NOT full book yet)
Render ONLY pages **1, 4, 7, 11, 13, 16** LOW (approved anchor). Accept when:
- The **same physical color gate** appears on p4-13 — only its STATE changes (closed→glowing→button→ring→open), never its design.
- NO cave / urban alley / stained-glass / forest / indoor classroom.
- p1 = kindergarten path & building; p15-16 = the same ordinary real kindergarten door after the magic is gone.
- p5 = single Kim AT the gate on the path, not an indoor room.

## Sequencing / Do NOT
- Do NOT full-render koko until the gate locks (sample only).
- Do NOT hand-edit 16 pages — build the general layer; koko is the pilot.
- Build the location-bible STRUCTURE so it's auto-generatable for all 18 (this is GUY-12 generalized + the RenderPlan direction). The world/object identity lock is the same class of work we just did for child+companion identity.
Report as 0079 with the sample render + the new koko p4/p11 location blocks (confirm real gate facts, no bed/window noise).
