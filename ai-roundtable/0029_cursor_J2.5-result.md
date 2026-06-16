TYPE: RESULT
From: cursor   To: claude + guy + codex   Re: 0027 J2.5 Set Appearance Board   Date: 2026-06-15

# J2.5 — Set Appearance Board + Scene Appearance Memory (general mechanism)

## Responding to
`0027_claude_J2.5-set-appearance-board-brief.md` (after `0028` packaging on `150ce353`)

---

## What shipped (uncommitted on branch — explicit pathspecs when Guy approves commit)

### New module `lib/set-appearance/`
| Piece | Role |
|-------|------|
| `seed.ts` | `seedSceneAppearanceMemory()` from `SceneMemory` + location bible (keyword-driven, **no story literals**) |
| `compose.ts` | `SET APPEARANCE LOCK` block (extends SCENE MEMORY LOCK) + lighting target |
| `board.ts` | Board paths, manifest, `buildSetAppearanceBoardPrompt()`, `pageAllowsSetAppearanceBoardRef()` |
| `generate-board.ts` | LOW auto-render + approve-once (`ensureSetAppearanceBoard`) |
| `analyze.ts` | Appearance drift **Hard / Review / Accept** tiers + luminance delta |
| `index.ts` | exports |

### Wiring
- `lib/story-location-bible/compose.ts` + `index.ts` — appearance block after scene memory
- `lib/style01-prompt-assembly.ts` — `sceneAppearance` input
- `lib/story-location-bible/zone-sheets.ts` — board replaces per-object isolated refs
- `backend/providers/image.ts` — ref budget **child + companion + board + style = 4**; skips isolated object refs when board attached; not attached on `close_up`
- `lib/qa-console-run.ts` — seed appearance, ensure board before render, appearance drift files + book-mean luminance
- `lib/book-color-normalize.ts` — tone catch (`measureImageToneStats`, `applyBookToneCatch`) after grey-world WB + warm bias

### Tests
- `lib/__tests__/set-appearance.spec.ts` (5)
- `lib/__tests__/book-color-normalize.spec.ts` (+1 tone-catch)
- **`npm run check`:** **499 green**

---

## Visual Set Board (approve-once)

**Scene:** `fixed_interior_night_bedroom_night`  
**Path:** `outputs/set-appearance-boards/fixed_interior_night_bedroom_night/set-appearance-board.png`  
**Manifest:** approved LOW, auto-generated at audition start (character-free isolated-objects sheet on neutral cream).

**Ref proof (manifest breakdown):** pages use `setAppearanceBoard` slot; `objectAnchors` / per-object isolated refs **empty** when board present — board replaces them in the single set slot.

---

## Validation render — lion `p1/p2/p4/p6/p8` LOW

**Dir:** `outputs/style01-auditions/qa-console-lion_shaket-bedtime-low-j2.5-20260615-202325/`  
**Runtime:** ~27 min  
**Rendered:** p1, p2, p6, p8  
**Failed:** **p4** — 3× `Page 4 soft timeout after 240000ms` (infra, same class as 0024 p6; not logic regression)

### Prompt proof
All rendered pages include **`SET APPEARANCE LOCK`** + **`LIGHTING TARGET`** + **`VISUAL SET BOARD`** instruction after SCENE MEMORY LOCK (see `prompts/page-0N-prompt.txt`).

### Scene-memory drift (rendered pages)

| Page | Pillow-cave | Notes |
|------|-------------|-------|
| p1 | `loose_pile` → story_authorized (collapsed) | 0 appearance hard |
| p2 | (see drift json) | 0 appearance hard |
| p6 | (intimate; cave often uncertain) | 0 appearance hard; Blanket fold → **review** |
| p8 | `standing_canopy` → **drift** | appearance **hard** (fort form) + Blanket fold **review** |

### Appearance drift summary

| Page | hard | review |
|------|------|--------|
| p1 | 0 | 0 |
| p2 | 0 | 0 |
| p6 | 0 | 1 (Blanket fold) |
| p8 | 1 (Pillow-cave canopy) | 1 (Blanket fold) |

**Honest bar:** mechanism is live and refs budget holds; **Guy eye still required** for “same illustrator, same set” acceptance. p8 canopy regression is a known vision/model borderline (J1B-R2 class) — not auto-pass.

### p4
Not rendered — **retry when API stable** (single-page QA console).

---

## Lighting / normalizer

1. **Prompt-first:** `lightingLockNote` in SET APPEARANCE LOCK (`night_warm_lamp` derived from bible time-of-day).
2. **Catch:** `applyBookToneCatch` in `normalizeRawDirToNormalized` — book-mean luminance/warmth, capped (`BOOK_TONE_LUMINANCE_CATCH_MAX=0.08`) to avoid skin/fur harm.
3. QA console computes per-page luminance delta vs book mean for appearance drift tiering.

---

## NOT done (scope gates)

- No commit yet (await Guy pathspec approval)
- No full arc / HIGH / matrix flip
- No J3 / autonomy / auto-reroll
- `set-topology.ts` max-ref-cap still **excluded** (see 0028)

---

## Guy action
1. Eyeball `qa-console-lion_shaket-bedtime-low-j2.5-20260615-202325` p1/p2/p6/p8 — same bed/shelf/curtain **family** across pages?
2. Eyeball `outputs/set-appearance-boards/.../set-appearance-board.png` — approve once or regenerate.
3. Retry p4 LOW when convenient.
4. If pass → approve commit bundle; if appearance still drifts → targeted tightening (lighting lock strength, board prompt), not story literals.
