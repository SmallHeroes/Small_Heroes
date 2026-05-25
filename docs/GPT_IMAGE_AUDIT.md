# gpt-image Path Audit — Why It Looked the Same

**Date:** 2026-05-25 · **Owner:** CTO · **Type:** research only, no build.
Question: was gpt-image good before a change broke it, and is its composition sameness cleanly fixable?

---

## Verdict up front

gpt-image's style and character consistency are genuinely excellent — that's real. But the composition sameness is **not** a cleanly removable anchor. **The project already built the exact fix the theory called for — and the rendered evidence shows it failed.** On gpt-image-1's `images.edit`, identity and composition come bundled; you cannot keep one and drop the other with a prompt.

---

## 1. Was gpt-image good? — Yes

The May-24 Adventure book (`image-experiment-1/adventure-2026-05-24-exp-adventure-282b9b84/`, 15 pages, manifest `provider: gpt-image`) — viewed directly: warm cute storybook style, child + armadillo consistent across all 15 pages. The style and identity are not in question.

## 2. What causes the sameness — `images.edit` mode

The Adventure book was rendered with **reference images**: the child photo + the Bolly photo (manifest: `childReference`, `bollyReference`, `hasDualReference: true`). When reference images are present, `generateGPTImage` (`generate-image.ts:332`) switches from `images.generate` to **`images.edit`**.

`images.edit` structurally conditions the *output* on the reference image. With a fixed child portrait as the reference on every page, every page is anchored to that portrait — same camera distance, same centered placement, same pose-toward-camera. The **setting** varies (bedroom, clinic); the **camera** never does.

## 3. Identity-only, or composition too? — Composition too. And the fix was already tried.

This is the key finding. The codebase **already contains the exact fix the "clean path" theory proposes.** `generate-image.ts:261`, `REFERENCE_PHOTO_PREFIX`, is prepended to every reference render and says, verbatim, to use the photo *only* for face identity and: "DO NOT copy from the photo: the background, lighting, pose, outfit, clothing colors, **camera angle, or composition**."

The Adventure book was rendered **with that prefix active** — and it is still same-y. A text instruction cannot override what `images.edit` does at the model level. The code comment at `generate-image.ts:323-330` even records the history: `images.edit` "was previously disabled with the comment 'anchors composition and hurts scene diversity'," then re-enabled on the bet that the prefix would fix it. The render proves the bet lost.

**Conclusion:** on gpt-image-1 `images.edit`, identity and composition are one mechanism. The reference photo that gives you the consistent child is the same thing that locks the camera. They are not separable by prompting — that has been tested.

## 4. The trade gpt-image-1 forces

| gpt-image-1 mode | Identity | Composition |
|---|---|---|
| `images.edit` (with photo) | strong, proven | locked — same-y |
| `images.generate` (no photo) | generic — drifts | free — varied |

You get one or the other. The consistency you admired in the Adventure book and the sameness you reject are the **same mechanism**.

## 5. Character size — "too choked" is documented

`buildGPTImagePrompt` already demands the opposite of choked: the `framingHint` (`image.ts:2324`) says "child occupies AT MOST 25%… PULL THE CAMERA WAY BACK… 30% breathing space." The code comment right above it (`image.ts:2320`) states plainly: **"gpt-image-1 systematically defaults to 55-65% character fill no matter what we ask."** The reference portrait reinforces it.

So "smaller characters / more breathing room" — the thing you just asked for — is the single thing gpt-image-1 is documented to resist hardest. The prompt already asks for it as loud as possible and loses.

## 6. The yellow cast

Promptable, unlike the above. The style block uses `styleContract.renderingDescription`, which for Style 01 is warm-worded ("warm soft tones," "warm cream paper," "golden undertones"). That, plus gpt-image's own warm bias, produces the yellow white balance. Fix: neutralize the warm language and add an explicit neutral-white-balance instruction. Applies to whichever provider we land on.

## 7. What this means for the bake-off

The chat's hoped-for "clean gpt-image path — keep identity, remove composition anchoring" rests on a premise the code disproves. The realistic gpt-image options are:

- **gpt-image-1 + photo** — gorgeous, consistent, but same-y framing + 55-65% character fill. Will not meet "breathing room / varied composition."
- **gpt-image-1, no photo** — varied composition, but identity goes generic — back to the consistency problem.
- **gpt-image-2** — `generate-image.ts:352` notes it "plans composition before rendering — should obey framing." A real lead, but untested here. (Task #119.)

Your newest requirements — smaller characters, more breathing room, varied composition — are gpt-image-1's **documented weaknesses** and Flux's **strengths** (Flux follows the scene-led framing floor; gpt-image-1 ignores it).

**Recommendation:** the decisive test is now the **Flux base-flux, no-LoRA, 5-page render**. Flux already gives variety + breathing room + cute style; the one open question is whether it holds the same child across pages. If it does, Flux wins outright — it meets every requirement including the new ones. If its identity drifts unacceptably, *then* revisit gpt-image — specifically gpt-image-2, or gpt-image-1 without the photo — knowing gpt-image-1 + photo will always be same-y.

Run the Flux 5-page test first. It is the cheaper, more decisive render given everything above.
