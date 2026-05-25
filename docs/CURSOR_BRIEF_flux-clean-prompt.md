# Cursor Brief — Flux Style-01 Clean-Prompt Rebuild (Experiment)

**Owner:** CTO · **Status:** ready for Cursor · **Depends on:** `docs/IMAGE_PIPELINE_AUDIT.md`
**Goal:** a contained experiment — a clean, scene-led Flux prompt path that makes the image match the page text, holds child/Bolly continuity, and varies composition. The legacy path is preserved untouched.

---

## 0. Context

The audit (`docs/IMAGE_PIPELINE_AUDIT.md`) found the live Flux prompt is ~850 words, ~80% boilerplate; the page scene is buried at word ~122 (~14% of the prompt); a fixed `framingDirective` hardcodes one composition and *explicitly overrides* per-page variety; the companion is described twice; the Director LLM runs a per-page call whose output is discarded on Flux. That is why images do not match page text and why pages look the same.

This brief builds a **new, clean Flux Style-01 prompt path behind a flag.** It does NOT delete or rewrite the legacy path — legacy stays intact as the fallback. This is an experiment to prove the scene-led approach, not a migration.

Provider/model: `IMAGE_PROVIDER=replicate`, Style 01 LoRA `smallheroes/sh-realistic-artistic`, trigger `REALISTART01`. (A Replicate-dashboard trigger confirmation runs in parallel; if it ever differs it is a one-line swap — do not block on it.)

---

## 1. The build

### 1.1 — New prompt builder
Add a NEW function (e.g. `buildFluxCleanPrompt`) — do not modify `buildImagePrompt`. It produces a **scene-led positive prompt, target 70–110 words**, in this exact order:

```
REALISTART01 style, fine watercolor children's-book illustration on cream paper.
<SCENE — the page moment: what happens, where, who, the emotion. Concrete. ~50–80 words.>
Child: <one compact line — age, gender, hair, skin tone, outfit, 1–2 defining features. ~15–20 words.>
Companion: <one compact line — include when the companion should be visually present on this page per storyboard / imageDirection / page intent. e.g. "Bolly, a small tan armadillo with a banded segmented shell." ~12 words.>
Composition: <one line — the storyboard's per-page shot. e.g. "wide shot, low angle, child small at left.">
```

- **Slot 1** (trigger + style tag): `REALISTART01` + a SHORT (~10-word) style tag. **Not** the 25-word `loraStylePrefix`.
- **Slot 2** (scene): the page moment — it LEADS the semantic content. Keep the existing Hebrew→English scene translation (`translateSceneForImage`) — it is necessary — but target it to ~50–80 words and feed its output here, first.
- **Slots 3–4** (locks): ONE compact child line, ONE compact companion line, no duplication. **Include the companion line when the companion should visually appear on the page** — decided by the storyboard / imageDirection / page intent (e.g. `expectedCharacterIds`), NOT by a literal name match in the page text. The companion may need to be in frame even when the prose does not say its name; if the line drops on those pages, continuity breaks.
- **Slot 5** (composition): ONE line, from the storyboard's per-page shot. The single composition signal.

### 1.2 — Flag
Gate the clean path behind an env flag (e.g. `FLUX_CLEAN_PROMPT=on`). When on, the Flux path uses `buildFluxCleanPrompt`. When off, the legacy path is byte-for-byte unchanged.

### 1.3 — What the clean path bypasses (clean path only — legacy untouched)
- **Skip** `framingDirective` entirely.
- **Skip** the 330-word `optionBlock` / `STYLE_LOCK` line in the positive prompt — the LoRA carries the style.
- **Skip** the `Style:` sentence and both text-zone blocks (`textSafeZone`, `textZone`). If a text-safe consideration is needed at all, one short clause max — but prefer handling the overlay band in the reader/CSS, not the prompt.
- **One** companion description only — drop the `entityLock` duplication.
- **Skip the Director LLM call** — its output is unused on Flux; do not pay a per-page call for nothing.
- **Keep** the Storyboard LLM — it is the source of the single per-page composition line. (Verify it actually returns varied shots; if it returns uniform shots, flag it — that is the next fix, not part of this experiment.)
- **Bypass** the Visual-Director, gpt-image, and SDXL branches for this path.
- **Negative prompt:** unchanged — keep `NO_TEXT_LOCK` etc. as the separate `negative_prompt` field.

---

## 2. Do NOT

- Do NOT delete the legacy path — it stays as the fallback.
- Do NOT generate on the old bloated path, or add new rules to it.
- Do NOT train a new LoRA.
- Do NOT tune final style — `REALISTART01` + the short tag, nothing more.
- Do NOT touch the story pipeline, the recipe pipeline, or the Voice Reviewer.

---

## 3. The experiment

Render the **Bedtime gold book** (`gold-candidates/bolly_bedtime_v0.5.0-b_gold.md` — the same story as the existing `image-experiment-1/bedtime-2026-05-24-exp1-0413959e/` run) on the clean path, with the fixed test child photo and the canonical Bolly reference.

- This gives a **direct A/B**: that same story already exists rendered on the OLD bloated prompt. New clean prompt vs old, page by page.
- Run it **twice** to settle the open `input_images` question: arm **A** — child photo passed as `input_images`; arm **B** — without it (LoRA + text only). The audit (§7) flagged that the reference image helps identity but drives composition sameness; this is how we learn which.
- **Arm B is diagnostic only.** It measures whether the child-photo reference causes composition sameness — but it is still judged on child *likeness*. Better composition with a child who does not look like the test child is NOT a win; likeness is non-negotiable and Arm B cannot trade it away.
- **Log the assembled page-1 prompt** (full text + word count) so we can confirm it is actually ~70–110 words and scene-led.

---

## 4. Definition of done

- `buildFluxCleanPrompt` exists; the `FLUX_CLEAN_PROMPT` flag works; legacy path unchanged when the flag is off.
- The Bedtime book rendered on the clean path — arm A and arm B — output saved alongside `image-experiment-1/`.
- The page-1 assembled prompt logged — confirmed ~70–110 words, scene first.
- Report back: files changed, the page-1 prompt text + word count, the output location. Then CTO QA judges page-text match, child/Bolly continuity, and composition variety — against the old Bedtime book.
