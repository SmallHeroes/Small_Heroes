# Launch Readiness Audit — Small Heroes

**Date:** 2026-05-24 · **Scope:** pre-pilot, 3 axes vs paying-customer quality
**Headline:** Not pilot-ready. One hard blocker — image character-consistency. Text and reader are tractable.

---

## The finding that reframes the launch question

There are **two products in this repo**, and the launch decision hinges on which one the pilot serves:

- **Live product** — `app/api/generate/route.ts` builds every customer book from the **story bank** (`loadStoryFromBank`, route.ts:502): pre-authored, human-written, human-reviewed stories, personalized with the child's name + character DNA.
- **In-development** — the v0.5 **recipe pipeline** (`lib/story-generator/`, `orchestrate-recipe.ts`): LLM-generated stories. This is where the **Voice Reviewer (Phase C)** lives.

**Verified: the Voice Reviewer never runs on a customer book.** `runVoiceReviewer` is called only from `scripts/calibrate-voice-reviewer.ts` and `orchestrate-recipe.ts`; nothing in `app/` reaches `orchestrate-recipe.ts`. The live route imports `loadStoryFromBank`, not the recipe orchestrator.

Phase C is QA for a pipeline that is not live. It is sound, foundational work for the LLM-generation roadmap — but it is **not a launch gate**. "Phase C is done" must not be read as "launch QA is handled."

---

## Axis verdicts — for the recommended path (a story-bank pilot)

| Axis | Verdict | Why |
|---|---|---|
| **Text** | GREEN | Live text is human-authored, human-reviewed bank stories — low risk. Caveat: spot-check personalization (name / gender / character-DNA insertion); prior gender-mismatch bugs make that the one place bank text can break. |
| **Image** | RED | **The blocker.** Character consistency is prompt-text-only on the live Flux/Replicate path. The face-conditioning path (gpt-image-1 `images.edit` with the child's photo) is dormant under `IMAGE_PROVIDER=replicate`. Resemblance scoring logs pass/fail but never regenerates a bad image. The child may not look like the child; Bolly has no visual anchor beyond a text description. |
| **Reader / UX** | YELLOW | `read-v2` is genuinely book-shaped (full-bleed, text-on-image, RTL, sound typography); mobile is strong. Fixable defects: desktop silently crops 2:3 art into a 3:4 frame; a dev "regenerate page" toolbar ships to users if `NEXT_PUBLIC_GENERATION_SECRET` is set; PDF is functional but not premium. |

*If the pilot is instead meant to serve the recipe pipeline: Text flips to RED — the pipeline isn't live and Phase C isn't wired — and the launch is months out, not weeks.*

---

## Top blockers — must fix before any paid pilot

1. **Image — child & companion consistency.** Pick one provider that actually conditions on the child's face (make the gpt-image-1 `images.edit` path live, or add face-conditioning to Flux). Give Bolly a real visual anchor carried to every page, not page 1 only.
2. **Image — resemblance must gate, not log.** A `soft_fail` / `extreme_mismatch` must auto-regenerate (new seed, hard cap), not ship.
3. **Reader — desktop crop + dev-toolbar leak.** Fix the 2:3→3:4 silent crop; gate the regen toolbar behind a non-public flag.
4. **Text — personalization spot-check.** Confirm name / gender / DNA insertion does not corrupt the vetted bank stories. Cheap and fast — do it.

---

## Can wait (post-pilot)

- Wiring Phase C / making the recipe pipeline live — the scaling roadmap, not the pilot.
- Image OCR no-text check and image-vs-text vision QA — desirable, not gating for a small supervised pilot.
- PDF facing-spread polish and a designed cover — if the pilot is web-reader-first.
- Deleting dead legacy systems (`reader.html`, the unused pipelines) — tech-debt cleanup.
- Confirming exactly which LoRA is live.

---

## Recommended launch definition

**A small, supervised, story-bank pilot — not "no-human-review."**

- **Source:** the story bank (human-authored, vetted). Not the recipe pipeline.
- **Scope:** Bolly, age 5–6, the proven scenarios, the 3 directions. Narrow MVP.
- **Gate:** images. A parent must recognize their child and see one consistent companion. Until blockers 1–2 land, do not run a paid pilot.
- **Safety mode:** every pilot book gets a human eyeball on the *images* before delivery. The triage signal is the resemblance / image-QA system — not the Voice Reviewer, which does not run on bank stories.
- **Honest naming:** a supervised pilot, not a fully automated product. That is the correct model at low volume.
- Phase C and the recipe pipeline stay the roadmap for scaling beyond hand-authored stories — resumed after the pilot proves the image layer.

---

## Bottom line

The launch blocker was never text. It is **image character-consistency**. Phase C is good engineering aimed at a future pipeline; the next real work is making the child look like the child.
