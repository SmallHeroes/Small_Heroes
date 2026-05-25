# Cursor Brief — PHASE 1 v4-reference — STYLE-REFERENCE AUDITION

Style-only. No book pipeline. Do NOT lock yet.

---

**Context:** v1/v2/v3 were text-only style prompts. v3 improved (richer environments, cleaner linework) but still does not match Guy's target reference images — too generic / nursery, not premium / cinematic enough, character still generic. We have reached the ceiling of text-only style prompting. Next lever: anchor on Guy's actual reference images as a STYLE reference.

---

## Reference images

Guy's **7** target reference images are in **`style-references/01/`** (`.png`, filenames `ChatGPT Image May 18...` — they are gpt-image output, so the model is matching its own style family). Use all 7 as style references in every generation. If the API caps the number of input images, use a varied subset — pick across different scenes and compositions, never all-similar — to keep the composition lock weak.

## Mode — expected, and the known risk

- Passing reference images to gpt-image-1 means **`images.edit`** mode. That is required and expected for style reference.
- Known risk (see `docs/GPT_IMAGE_AUDIT.md`): `images.edit` pulls on **composition AND content**, not only style. Mitigations:
  - Use **multiple varied references** (not one) — different scenes and compositions, so the model cannot lock onto a single composition and is forced to extract the shared STYLE.
  - In the prompt, state explicitly: the reference images define **VISUAL STYLE ONLY** — linework, color, rendering, texture, lighting, density, charm. Do NOT copy their composition, their scenes, or their content. The references contain an owl, a bird, a puppy, an armadillo, a dragon — **none of those creatures or objects may appear in the audition outputs.**
- This audition is itself the test of whether style-reference works. If the outputs transfer style cleanly without bleeding the references' content/composition → it's the path. If they bleed → report it clearly; that is a finding.

## Run

Same 4 scenes — text describes the scene, the references supply the style:

- bedroom-night
- classroom (bright daytime, cool natural daylight)
- clinic
- forest

Each prompt = the v3 scene description + an instruction to match the visual style of the attached reference images (**style only — not their content or composition**).

Same STRICT discipline: no book pipeline, no child-identity consistency machinery, no anchors beyond the style references themselves. Style-only.

## Output

- the 4 v4-reference images
- exactly which reference images were used
- the exact prompt / brief text
- confirm the API path: `images.edit` vs `images.generate`, and how many references were passed
- explicitly note any content or composition bleed from the references

## CTO judges against Guy's reference images

Does v4-reference match the premium cinematic storybook style — rich detailed environments, controlled lively linework, designed characters with nuance, no generic nursery look, no yellow/orange wash — **and** without copying the references' creatures, scenes, or composition.

Do NOT judge identity consistency — still style-only. Do NOT proceed to Phase 2 until the style is CTO-approved.
