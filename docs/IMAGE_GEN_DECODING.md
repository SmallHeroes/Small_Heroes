# How Image Generation Works — Small Heroes

**Date:** 2026-05-25 · **Scope:** the live path — `FLUX_CLEAN_PROMPT=on`, Flux via Replicate.
Factual decoding for external review: what runs, what is skipped, what actually reaches the model.

---

## The flow, end to end

```
Hebrew page text
   │
   ├─►  1. STORYBOARD LLM      — 1 call per book   → per-page visual plan
   │
   ├─►  2. DIRECTOR LAYER      — SKIPPED on the clean path (does not run)
   │
   ├─►  3. SCENE-TRANSLATE LLM — 1 call per page   → Hebrew text → English scene
   │
   └─►  4. CLEAN PROMPT ASSEMBLY → 5. Flux render
```

---

## 1. Is there a storyboard? — YES

One LLM call per book (`generateStoryboard`, `image.ts:3096`). It returns one `PageVisualStoryboard` row per page. Each row has **~13 fields**:

`shotType` · `compositionMode` · `cameraAngle` · `protagonistDominance` · `textZone` · `lighting` · `emotionalTone` · `action` · `environment` · `intent` · `mainCharacterVisibility` · `pageLayoutStyle` · `pageNumber`

**Critical:** of those ~13 fields, **only 4 reach the image prompt** — `shotType`, `cameraAngle`, `protagonistDominance`, `compositionMode`. The other 9 (including `action`, `environment`, `intent`, `lighting`) are computed and then **dropped** — they never reach Flux. (`textZone` + `lighting` are kept for reader layout, not for the image.)

## 2. Is there camera-angle direction / blocking?

Two separate things in the codebase are called "direction":

- **`storyboard.cameraAngle`** — a single field on the storyboard row (`eye_level` / `low_angle` / `high_angle` / `three_quarter`).
- **The Director layer** (`generateSceneBlocking`) — the *real* cinematic blocking: character positions, eyeline, interaction, emotion, and it is **previous- and next-page aware** (continuity). It produces a structured BLOCKING JSON per page.

**On the clean path the Director layer does not run.** `image.ts:3119` gates it: `if (isDirectorLayerEnabled() && !isFluxCleanPromptEnabled())`. With the clean flag on, it goes to the `else` branch and logs `[Director] skipped — FLUX_CLEAN_PROMPT=on` (`image.ts:3195`). `blockingByPage` stays empty.

So on the clean path the only "direction" the image gets is the storyboard's `shotType` + `cameraAngle`, condensed into one line.

## 3. Hard rules — per page / per book?

Yes, but almost all are **soft** — instructions inside the Storyboard LLM prompt (`image.ts:944-998`), not deterministic code:

- **Per page:** narrative-beat → preferred `shotType` (OPENING→wide, INTRODUCING_COMPANION→medium, HEART_LINE→close_up, RESOLUTION→medium/wide); no two consecutive pages share a `shotType`.
- **Per book:** at most 25% of pages may be `close_up`; at least 70% must be medium or wide; at least 4 distinct composition types must appear.
- **Deterministic (the only hard code):** `rotateAvoidingRepeat` normalizes the LLM output and, for any missing/invalid `shotType`, fills it from `SHOT_TYPES[i % 5]`.

There is **no hard rule on character size in frame** — no floor, no cap. (That is the gap documented in `PRE_RENDER_AUDIT.md`.)

## 4. ★ Are the Director and the Storyboard connected?

**On the clean path: NO — because the Director does not run at all.**

- The Director layer *exists* and *is* wired to the storyboard — when it runs (legacy path), `generateSceneBlocking` receives the storyboard row as input (`storyboard: sb`, `image.ts:3153`). So on the **legacy** path they are connected.
- On the **clean path** the Director is switched off entirely (`image.ts:3119` / `:3195`). It produces nothing; `blockingByPage` is empty; no blocking reaches the image.
- Result: on the clean path the **storyboard runs alone**. Its per-page shot *is* the entire direction the image receives — and only 4 of its ~13 fields survive, compressed into a single line.

Why it was skipped (not a bug): the Director's output was only ever consumed by the old gpt-image prompt builder and was discarded on the Flux path anyway — so the clean-prompt rebuild stopped paying for a per-page LLM call whose result went nowhere. The *consequence*, though, is that the clean path has **no cinematic blocking and no cross-page continuity layer** — the sophistication that exists in the Director code is simply not in play.

---

## What actually reaches Flux (the clean prompt)

```
REALISTART01 style, <style tag>.        ← fixed
<scene>                                 ← Scene-translate LLM (from Hebrew page text)
Child: <...>                            ← built from child profile
Companion: <...>                        ← built from companion data (when present)
Composition: <shot, angle, dominance, mode>.   ← the ONLY storyboard-derived line
```

The composition line is **last** — the weakest position for Flux, which weights the start of a prompt hardest.

| Question | Answer |
|---|---|
| Storyboard exists? | Yes — 1 LLM call/book, ~13 fields/page |
| Storyboard fields reaching the image | 4 of ~13 (shot, angle, dominance, mode) |
| Director / cinematic blocking exists? | Yes in code — **skipped on the clean path** |
| Director ↔ Storyboard connected? | Only on legacy. On the clean path the Director is OFF |
| Cross-page continuity layer active? | No (that was the Director's job) |
| Hard per-page/per-book rules | Soft LLM instructions only; 1 deterministic shot-rotation fallback |
| Hard character-size / framing rule | None |
| Composition signal position in prompt | Last (weakest) |
