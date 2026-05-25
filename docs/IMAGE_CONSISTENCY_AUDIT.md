# Image Consistency Audit — Small Heroes

**Date:** 2026-05-24 · **Scope:** the live image-generation + character-consistency system vs paying-customer quality
**Method:** code audit of `image.ts`, `generate-image.ts`, `resemblance-core.ts`, `replicate.ts`, `styles.ts`, `route.ts`, `story-bank-loader.ts`. The resemblance-embedding finding was verified by direct read.

---

## 1. Current state map

### What EXISTS and works
- Live image generation runs through Flux on Replicate — `IMAGE_PROVIDER=replicate` (`.env.local`) → `generateWithReplicate` (`image.ts:2382`). `USE_VISUAL_DIRECTOR=false` → the legacy prompt path.
- Style 01/02 use LoRA-trained Flux models (`sh-realistic-artistic`, `sh-pencil-storybook`; trigger words `REALISTART01/02`), resolved by `resolveReplicateImageModelForStyle` (`replicate.ts:75`), applied at `generate-image.ts:154`. Style 03 → base `flux-2-pro`.
- The customer photo is re-passed to every page as a reference input (`image.ts:3216,3438` → `referenceImages`).
- Hebrew text is kept out of images — `NO_TEXT_LOCK` in every prompt (`image.ts:468`) + `STRICT_NEGATIVE_PROMPT` on the Replicate call (`image.ts:1427,2411`). Adequate; no fix needed.
- The resemblance-scoring + anchor-election machinery runs end to end.

### What is DORMANT (built, switched off)
- **The gpt-image-1 `images.edit` face-conditioning path** — `generateGPTImage` (`generate-image.ts:285`) is fully built and NOT rotted. It uploads the customer photo as a real image input. Gated off purely by `IMAGE_PROVIDER=replicate`; it runs the moment that flag is `gpt-image`.
- **Page-output anchor** (`ENABLE_PAGE_OUTPUT_ANCHOR`) — disabled; re-enabling it for every page caused the May-15 "sameness" regression (`image.ts:3535`).
- **The "cream v3" LoRA** — training-data dirs exist (`lora-training-data/style_cream_*`) but the live env points at `sh-realistic-artistic` / `sh-pencil-storybook`, not a `cream`-named slug. Either `sh-realistic-artistic` IS the cream model renamed, or cream was trained and never deployed. One question for whoever ran training.

### What is MISWIRED (the real problems)
- **"Resemblance" does not measure faces.** Verified by direct read: `buildEmbedding` (`resemblance-core.ts:268`) is a 16-bin-per-channel RGB histogram — 48 values of whole-image colour distribution. Two different children with similar colouring score as a match; the same child in a different-coloured shirt scores as a mismatch. It is a colour-similarity score wearing the name "resemblance."
- **And it only logs.** The page monitor (`image.ts:3491-3531`) scores the final image, emits a telemetry audit, and does nothing else — no threshold, no regenerate.
- **The child's face never conditions the model on the live path.** The photo reaches the model only as a Claude-Vision *text description* (`describeChildFromPhoto`, `story-bank-loader.ts:707`). Flux is also handed the photo as `input_images`, but whether flux-2-pro transfers face identity from it is unverified and was never production-tested.
- **Bolly has zero visual anchor** — only a text description repeated per page. Bolly is not even an entry in `lib/companions.ts`. No reference image, no LoRA, no character sheet.
- **Anchor election runs once.** It fires only on the first page (`shouldRunAnchorElection`, `image.ts:3201`); the best-rendered child it elects is never reused as the anchor for later pages.

---

## 2. Provider decision fork

Two real, working paths to child-face consistency. Neither currently delivers both identity and composition.

**Path A — gpt-image-1 `images.edit`.** Customer photo in as a true image input → real face conditioning, the strongest identity lever short of training. **One env flip from live** (`IMAGE_PROVIDER=gpt-image`). Weakness (documented in `IMAGE_MODEL_BRIEF`): ignores framing instructions (~50% character regardless of prompt), samey compositions page to page. ~$3/book. A `gpt-image-2` toggle exists but is untested.

**Path B — Flux on Replicate (current live).** Good framing obedience, composition variety, LoRA style control. Weakness: child-face conditioning is weak and **unverified** — flux-2-pro takes an image input but its identity-transfer behaviour was never production-tested.

**CTO recommendation: Path A for the pilot.** This is a personalized product — face identity is the value proposition and non-negotiable; composition variety is a quality ceiling, not a dealbreaker. A parent forgives samey compositions; a parent does not forgive not recognizing their child. Path A is one flag from live and supports multi-reference (`images.edit` takes up to 4 inputs) — so [child photo + Bolly sheet] together is trivial.

**Decision required before the build:** A, B, or "test Flux `input_images` face-transfer first, then decide."

---

## 3. Prioritized fix list

| # | Fix | Effort | Files | Depends on |
|---|---|---|---|---|
| a | **Child face conditioning** — activate real photo conditioning (flip to gpt-image, or verify Flux `input_images`) | ~1–2 d | `.env.local`, `generate-image.ts`, `image.ts` | provider decision |
| b | **Bolly visual anchor** — create one canonical Bolly reference image; feed via `initialCharacterAnchors` → `referenceImages` (2nd `images.edit` reference on Path A) | ~1–2 d | `companions.ts`, `route.ts`, `image.ts` | — |
| c | **Real face-similarity QA** — replace the RGB colour histogram with an actual face-recognition embedding; then gate + regenerate (2–3 attempts, keep best) in the page monitor | ~3–4 d | `resemblance-core.ts`, `image.ts` | — |
| d | **Carry the anchor to every page** — reuse the elected best-rendered child as the anchor for later pages, without re-triggering the May-15 sameness regression | ~1 d | `image.ts`, `route.ts` | a, c |

**Note on (c):** the tempting shortcut — "the resemblance infra is complete, just add the threshold" — is wrong. The infra is complete for *colour*. A regenerate-gate on the colour histogram would regenerate books by shirt colour. (c) is a real build, and it is what makes "safety mode" actually work.

---

## Execution plan (CTO-agreed)

1. **Decide the provider** (§2).
2. **Experiment 1 (~1 day):** flip to the chosen provider, create the Bolly reference image, run the **Bedtime** test book — short, controlled — with one **fixed test child photo** + the Bolly reference. Human-QA it.
3. **Build fix (c)** — the real face-similarity QA + regenerate gate.
4. **Stress test on Adventure** — varied scenes (clinic, street, indoors). Same-setting Bedtime consistency is the easy 80%; Adventure is the mandatory proof.
5. Only then return to text / scenarios.

**Pass bar (set before generation):** a person shown the test book cold agrees — same child on every page, same Bolly on every page, each scene matches its text, no text rendered inside any image.
