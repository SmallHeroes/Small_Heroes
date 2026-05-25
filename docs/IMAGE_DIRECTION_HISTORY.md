# Image-Generation Direction — Historical Audit

**Date:** 2026-05-25 · **Purpose:** reconstruct why the project moved between gpt-image and Flux, and the true state of the LoRA / character-consistency work — so the provider decision is made with full history, not blind.

---

## The corrected history

The recollection ("migrated from gpt-image to Flux, then started LoRA") is partly wrong:

- **Flux/Replicate was the original default** — present since the first commit (`2e390aa1`, 2026-05-06). It was never a one-way "migration."
- **The LoRA training happened early** — training zips dated **Apr 30 – May 2**, before the image-model brief was written.
- The project then **ran on gpt-image-1** for a stretch.
- On **2026-05-18** (commit `a5c79a1c`) the live flag was flipped **back** to `IMAGE_PROVIDER=replicate` (Flux) — the commit message says "back."
- **Why gpt-image was dropped:** composition rigidity, documented in `docs/IMAGE_MODEL_BRIEF_for_ChatGPT.md` — it ignores framing instructions (~50% character every page, "5 versions tried, nothing works"), near-identical compositions, no inter-page continuity. **It was dropped for composition, not for character consistency.**

The real shape is **oscillation, not progression:** Flux default → gpt-image → back to Flux (05-18) → gpt-image again (Experiment 1, 05-24).

## The two half-solutions

| | gpt-image-1 `images.edit` | Flux + LoRA (live) |
|---|---|---|
| Child face identity | conditions on the real photo — strongest lever | weak / **never verified** (photo passed as `input_images`, transfer untested) |
| Composition / framing | **rigid — documented dealbreaker** | good obedience + variety |
| Art-style control | prompt only | LoRA (style-trained) |

Neither provider has ever been built to deliver **both**.

## The LoRA situation — undocumented and possibly broken

- Two style LoRAs were trained (Apr 30 – May 2), test-rendered (`lora-training-data/test-outputs/`); the live config points at them (`LORA_MODEL_STYLE_01=smallheroes/sh-realistic-artistic`, `STYLE_02=sh-pencil-storybook`; `ENABLE_LORA=true`).
- **Likely trigger-word bug:** the training captions in `lora-training-data/style_01_extra/*.txt` use `SOFTSTYLE01`, but the deployed prompts inject `REALISTART01` (`generate-image.ts:154-160`, `styles.ts:96`). If the deployed model learned `SOFTSTYLE01`, the live Flux LoRA has been silently mis-triggering.
- **The "cream v3" LoRA** (a prior note: "done, ~41 images, test approved, pending deploy") cannot be reconciled with the deployed slugs from the repo alone. No training scripts or trainer configs exist in the repo — the slugs appear only in `.env.local`.
- **The repo cannot tell us what LoRA is actually live or whether it is correctly triggered. Only the Replicate account can.**

## Where character-consistency work stopped

Multiple sequential, prompt-text-based attempts, none solving identity:
- Page-output anchor — built, then disabled (May 15 sameness regression).
- Child photo as `images.edit` reference — built, then dormant under `IMAGE_PROVIDER=replicate`.
- Claude-Vision text description — the only thing conditioning the child on the live path.
- Resemblance scoring — a 48-value RGB colour histogram (not a face embedding); logs only, never gates.
- A real face-conditioning mechanism (IP-adapter / face-adapter) on Flux — **never built.**

## Recommendation

1. **Resolve the LoRA mystery first — a Replicate-account check, ~5 min (CTO).** Does `smallheroes/sh-realistic-artistic` exist? What trigger word was it trained on (`SOFTSTYLE01` vs `REALISTART01`)? Is it the "cream v3" model? Until this is known, the provider decision is blind and the live Flux path may have been mis-firing.
2. **QA the already-generated Experiment-1 books** — Bedtime (10 pp, done: BORDERLINE) and Adventure (15 pp, gpt-image-1, 2026-05-24, **not yet judged**, generated without the wardrobe lock).
3. **Do not pre-commit to either provider.** The honest open question has never been tested: *can Flux — with a correctly-deployed LoRA and a real face-conditioning add (IP-adapter / face-adapter) — deliver both identity and composition?* gpt-image's composition ceiling is documented as unfixable; Flux's identity weakness may be an artifact of a mis-configured LoRA plus a face-adapter that was never built.

## Bottom line

The project did not "solve and forget." It has a genuine, unresolved tradeoff and has oscillated between two half-solutions. The fastest way to break the oscillation: (a) find the true LoRA state, then (b) decide whether Flux is worth one fair, full-strength test before defaulting to gpt-image's known composition ceiling.
