# Pre-Render Audit — Flux Clean Path

**Date:** 2026-05-25 · **Owner:** CTO · **Trigger:** before the next paid render, check what in the pipeline sabotages the image — especially "the character fills the whole frame." This doc is that check.

## Verdict

The character-fills-the-frame problem is **not a tuning issue — it is a missing component.** The clean path has *no framing control of any kind*. Six obstacles found; two are critical. **Do not render until Fixes 1–3 land.**

Two false alarms checked and cleared: `num_inference_steps: 4` is SDXL-only (Flux uses its default); the LoRA prefix is correctly skipped on the clean path (`skipLoraPromptPrefix: useCleanFlux`). So the prompt is not double-polluted — good.

---

## The framing regression — root cause

The legacy path fights this problem on purpose. `image.ts:2313` carries a documented note — the image model "systematically defaults to 55–65% character fill" — and the legacy `framingHint` (`image.ts:2317`) counters it: *"child occupies at most 25% of frame height, pull the camera way back, at least 30% breathing space."*

The clean path uses **none of it.** `buildFluxCleanPositivePrompt` assembles: style line → scene → child line → companion line → composition line. There is no size cap, no breathing-room clause, no framing floor anywhere. With nothing holding it back, Flux does what `image.ts:2313` says it does — fills the frame with the character.

**Why this keeps coming back** (tasks #36, #80, #83, #121 all fought it before): every past fix was a directive living in a per-path, per-page, mutable field. When the prompt path was rebuilt — the clean-prompt rebuild — the directive was dropped with the rest of the legacy assembly. The durable fix is to make the floor **structural**: a constant line baked into `buildFluxCleanPositivePrompt`, exactly like `FLUX_CLEAN_STYLE_TAG`. As long as the clean path exists, the floor exists.

---

## Obstacles found (ranked)

1. **[CRITICAL] No framing floor.** Nothing in the clean path caps character size or guarantees visible environment. → character fills the frame.

2. **[CRITICAL] The composition line emits the literal word "close-up."** `buildFluxCleanCompositionLine` maps `shotType==='close_up'` → `"close-up"`. Flux reads that as a cropped face. The storyboard caps close_up at 25% of pages — still 2–3 pages of exactly the thing we forbid.

3. **[HIGH] The framing signal is dead-last in the prompt.** Order is style → scene → child → companion → composition. Flux weights the *start* hardest; the character-action scene leads, the lone composition phrase is in the weakest position.

4. **[HIGH] The companion reference image is never passed to Flux.** `input_images` receives only the child photo. Bolly is text-only — which is why he renders as a rabbit/mouse on several pages ("the companion isn't good").

5. **[MEDIUM] The negative prompt has zero anti-crop terms.** No "close-up portrait / cropped face / character filling frame" exclusions — nothing pushes back on tight crops.

6. **[MEDIUM] Arm A's child face photo as `input_images` biases composition face-centered.** A face reference nudges Flux toward face-centered framing — it compounds obstacle 1 on Arm A.

Plus, carried over: scene-translate overshoots its 45–55-word target (gate prompts ran 86–118 words), and the Style 01 style tag is only 7 words (see `STYLE_DEFINITIONS.md`).

---

## The fix (for Cursor — one pass)

### Fix 1 — structural breathing-room floor (the core fix)

In `lib/flux-clean-prompt.ts`, add a **constant** framing line and place it as **line 2** of the assembled prompt (right after the style line, before the scene — high prompt weight):

```
Framing: keep the child within a fully-drawn environment with open breathing space at the frame edges — never a tight face crop, never the child filling the whole frame.
```

This is a **floor / cap**, composition-agnostic. It does NOT dictate one composition — wide / medium / three-quarter all still vary per page. That is the distinction from the old `framingDirective` that killed variety: a floor caps the *maximum* character size; it does not fix the shot.

### Fix 2 — kill the literal "close-up"

In `buildFluxCleanCompositionLine`, the `close_up` case must never emit the word "close-up." Map it to **`"medium-close shot"`** (a close framing that still shows shoulders and surroundings). With Fix 1's floor, even the emotional beat keeps its environment.

### Fix 3 — anti-crop negative terms

In `buildFluxCleanPromptParts`, add to `negativeParts`:

```
close-up portrait, cropped face, character filling the frame, oversized character, tight head crop, empty background
```

### Fix 4 — keep the word budget

The floor clause (~28 words) needs room. Tighten `translateSceneForImage` to actually land at **40–50 words** (it currently overshoots). Net total stays inside the 70–130 budget. The per-page composition line stays last — it carries per-page variety, which is fine there now that the floor does the heavy lifting.

### Fix 5 — companion description (lower priority, same file)

Strengthen `buildFluxCleanCompanionLine` so Flux stops drawing a rabbit: name the distinctive trait explicitly — *"armadillo with a hard segmented armored shell arched over its back."* Passing Bolly's reference image as a second `input_images` entry is possible (the field takes an array) but risks child/companion identity-blend — evaluate that separately, not in this pass.

### Resulting prompt skeleton

```
REALISTART01 style, <style tag>.
Framing: keep the child within a fully-drawn environment with open breathing space at
the frame edges — never a tight face crop, never the child filling the whole frame.
<scene — 40-50 words>
Child: <...>
Companion: <...>
Composition: <per-page shot — wide / medium / medium-close / three-quarter>.
```

Bundle the **Style 01 tag upgrade** from `STYLE_DEFINITIONS.md` into this same pass — same file, same re-gate.

---

## Definition of done — then render

1. Fixes 1–5 land in `lib/flux-clean-prompt.ts` + `buildFluxCleanPromptParts`.
2. Re-run the prompts-only gate. Confirm: the framing-floor line is present on every page, the word "close-up" appears nowhere, total word count is inside 70–130.
3. CTO reviews the gate output.
4. Only then — the paid 5-page A/B render.
