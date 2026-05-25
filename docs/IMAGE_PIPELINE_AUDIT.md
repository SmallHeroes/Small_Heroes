# Image Pipeline Audit — Small Heroes

**Date:** 2026-05-25 · **Scope:** how Flux image generation actually works today; what breaks page-text obedience and causes sameness; keep vs rebuild. Research only — nothing built.
**Verdict in one line:** the Flux model is fine — the *prompt pipeline* buries the page scene and repeats ~80% boilerplate. Rebuild the prompt layer, scene-first.

---

## Core diagnosis — why the image didn't match the page text

A page's prompt to Flux is **~600-750 words**. It LEADS with a LoRA style prefix (~25 w) + a generic "WIDE STORYBOOK SCENE — pull the camera back — character 20-30%" framing block (~90 w) — ~120 words of non-page-specific content before anything about *this page*. Flux attends hardest to the start of a prompt. The actual page scene is only **~15-20% of the prompt**, sandwiched in the middle behind boilerplate. So Flux is mostly being told "wide storybook watercolor scene" — not what happens on the page. **That is the page-text-mismatch failure.**

## 1. Pipeline map

`route.ts` builds pages → `generateAllPageImages` (`image.ts:2749`) → **Storyboard LLM** (1 call/book) + **Director LLM** (1 call/page) → per-page loop → `generateWithReplicate` → **Scene-translate LLM** (1 call/page, Hebrew text → English scene) → `buildImagePrompt` (`promptBuilder.ts:46`) → `generateReplicateImage` (LoRA prefix prepended) → Flux. **Four LLM calls per book run before Flux ever renders.**

## 2. Live vs dormant

- **Live:** legacy prompt path (`buildImagePrompt`), Storyboard LLM, Scene-translate LLM, LoRA prefix, resemblance anchor-election (selects best of N, logs only).
- **Dormant:** the Visual Director prompt path, the gpt-image / DALL·E paths, `buildGPTImagePrompt`, the page-output anchor (the "May 15 sameness" mechanism — genuinely OFF).
- **Dead-wired:** the **Director LLM runs a call per page, but its output is read only inside `buildGPTImagePrompt` (gpt-image-only)** → discarded on Flux. `composeStoryboardDrivenPagePrompt` builds a ~600-word prompt that is also discarded.

## 3. What hurts page-text / storyboard obedience (ranked)

1. The scene is buried mid-prompt, behind the LoRA prefix + the generic framing block.
2. Two lossy LLM rewrites (Scene-translate, Storyboard) sit between the Hebrew page text and the prompt; both silently fall back to generic text on failure.
3. `composeStoryboardDrivenPagePrompt`'s per-page direction is computed, then discarded.
4. Generic fallbacks fire silently ("child performing a meaningful story action").
5. Three conflicting character-size targets in one prompt (20-30% / 35-50% / 30-50%).

## 4. What causes sameness

- ~500 words of **identical boilerplate on every page** → Flux locks onto the dominant repeated signal: same staging, same palette.
- `framingDirective` is a **fixed composition** ("wide scene, camera back") on every page — and it explicitly says "override any earlier instruction that wants character larger," actively cancelling per-page variety.
- The child photo is passed to Flux as `input_images` every page → nudges every page toward the same look (gpt-image-era reference handling surviving on the Flux path).
- The Director computes previous-page-aware blocking *to prevent* sameness — and it is discarded.

## 5. Should Flux remain the direction? — Yes

Nothing in the pipeline argues Flux cannot meet the bar. Every failure is prompt-assembly and wiring; Flux-2-pro follows a scene-led prompt fine. **One prerequisite:** the LoRA trigger word. Training captions use `SOFTSTYLE01`; the deployed prompt injects `REALISTART01` (`styles.ts:96`). If they do not match, the LoRA is loaded but its learned token never fires — loaded, never activated. The repo cannot confirm this; it must be checked against the actual Replicate training job.

## 6. What to remove / rebuild

A **contained rebuild of the prompt-assembly layer** — not a pipeline rewrite. The orchestration (`generateAllPageImages`, the Replicate call, the storyboard) stays.

- Collapse to ONE prompt builder. Drop the dormant ones from the Flux path (`buildGPTImagePrompt`, `composeVisualDirectorPrompt`) and the discarded `composeStoryboardDrivenPagePrompt`.
- New prompt order: **scene FIRST**, then a one-line child lock, a one-line companion lock, one short composition line from the storyboard, one short style line, the trigger word. **~60-90 words total.**
- Cut `optionBlock` from ~330 words to ~40 — the LoRA carries the style; stop re-describing watercolor in the prompt.
- Delete the fixed `framingDirective` — the storyboard's per-page shot becomes the only composition signal.
- Stop calling the Director LLM until/unless its output is wired into the Flux prompt — today it is a per-page API call for nothing.
- `input_images`: test with and without — it helps child identity but drives composition sameness.

## 7. Best next experiment

One 10-page Style-01 Flux book with the stripped, scene-led prompt, in **two arms**: (A) child photo passed as `input_images`; (B) LoRA + text only. Measure per page: (1) page-text match, (2) child + companion continuity, (3) composition variety. Run only **after** the LoRA trigger word is verified.

## Open caveat

The rebuild fixes page-text match and sameness with high confidence. **Continuity — the same child across pages — is the one requirement still genuinely open.** It rests on the LoRA trigger fix and the `input_images` question; the two-arm experiment is what resolves it.

---

## 8. Sample prompt decomposition — one real interior page

The actual Flux prompt assembled for one Style-01 interior page, front to back (`buildImagePrompt`, `promptBuilder.ts:88-100`; LoRA prefix `generate-image.ts:159`):

| # | Block | ~words | Page-specific? |
|---|---|---|---|
| 1 | LoRA prefix — `REALISTART01 style, premium children's book illustration, adorable round characters, large sparkling eyes…` | ~27 | no — fixed |
| 2 | `framingDirective` — "WIDE STORYBOOK SCENE, pull camera back, 20-30%, Ruzzier/Klassen/Potter, override anything larger" | ~95 | no — **fixed every page** |
| 3 | `compositionDirective` — "COMPOSITION: …" | ~15 | partial |
| 4 | **translated scene — the page moment** | ~100 | **YES — the only real page content** |
| 5 | `CHARACTER_LOCK` (+ `COMPANION_LOCK`) | ~75 | no — fixed |
| 6 | `entityLock` — "Companion: …" — **duplicates the companion already in #5** | ~15 | no — fixed |
| 7 | `textSafeZone` — "TEXT-OVERLAY BAND, bottom 33%…" | ~70 | no — fixed |
| 8 | `textZone` directive | ~55 | no — fixed |
| 9 | `Style:` sentence — "Children's picture book page… Maintain exact same artistic style…" | ~70 | no — fixed |
| 10 | `STYLE_LOCK` = the full `optionBlock` (MEDIUM LOCK → RENDERING → CHARACTER STYLE → DETAIL → COLOR → BACKGROUND → LIGHTING → COMPOSITION → TEXTURE → EXCLUSIONS) | ~330 | no — fixed |

**Total ≈ 850 words.** By the requested buckets:
- **page-specific scene:** items 3-4 ≈ **~115 words ≈ 13-14%**
- **character lock:** items 5-6 ≈ ~90 words (companion described **twice**)
- **style lock:** items 1 + 9 + 10 ≈ **~427 words ≈ 50% of the whole prompt**
- **composition instructions:** items 2-3 ≈ ~110 words — but ~95 of that is the *fixed* `framingDirective`
- **negative / no-text:** ~15 words inside the prompt (optionBlock exclusions) + a separate `negative_prompt` field (`NO_TEXT_LOCK` + `STRICT_NEGATIVE_PROMPT`)
- **legacy fixed boilerplate:** framing + both text-zone blocks + style sentence ≈ ~290 words ≈ ~34%

**Where the page scene appears:** it starts at roughly **word 122** — after the LoRA prefix and the entire fixed framing block — and is ~14% of the string. Flux weights the start hardest; the start is all fixed boilerplate. The `[prompt_compact_warning]` (>450 words) fires on every page.

## 9. Every layer that rewrites the page scene

The scene passes through five transforms before Flux:

1. **Upstream `imagePrompt` generator** — the story stage authors `page.imagePrompt`. `extractSceneCore` (`image.ts:479`) exists *specifically* to strip "PROMPT_CONTRACT" instructional preambles it leaves — so `imagePrompt` arrives already polluted.
2. **Storyboard LLM** (`generateStoryboard`, 1×book) — rewrites each page into shotType / `action` / `environment` / `intent` — a parallel scene representation.
3. **`compositionDirective`** — built from the Stage-4B `composition` plan, or a deterministic `getCompositionVariation(pageNumber)` fallback — a third composition string.
4. **`translateSceneForImage`** (gpt-4o-mini, 1×page, `image.ts:488`) — takes the **Hebrew `bookPageText` as the primary source** (good — the real page text *is* the input) plus `pagePrompt` as a camera hint, and compresses to an 80-120-word English scene. Lossy mini-model compression; on failure silently falls back to `extractSceneCore(pagePrompt)`.
5. **`buildImagePrompt`** — positions that scene at slot 4 of 10, behind ~120 words of fixed boilerplate.

(Plus: the Director LLM produces blocking that is **discarded** on the Flux path; `composeStoryboardDrivenPagePrompt` builds a full ~600-word prompt that is **also discarded**.)

**Dilution verdict:** the page text is correctly the *source* — `translateSceneForImage` reads `bookPageText`, so the scene is not ignored at the root. The damage is downstream: **(a)** three-to-four composition signals that don't agree — the Storyboard's `action`/`environment`, the `compositionDirective`/`getCompositionVariation`, and the fixed `framingDirective`; **(b)** the scene is a lossy mini-model compression; **(c)** it is then buried. The fix is not "stop rewriting the text" — it is *collapse the composition streams to one, and stop burying the scene*.

## 10. Proposed minimal Flux-first target path

**Inputs — only these:**
- The page text (Hebrew) → one scene-translate pass → the page moment, ~50-80 words.
- One composition line — the Storyboard's per-page shot (e.g. "wide shot, low angle, child small at left").
- Child identity — one compact line.
- Companion identity — one compact line, only when the page text names it.
- Style — carried by the LoRA (trigger word + a ~8-word tag). No prose style block.

**Prompt order — target ≈ 70-110 words:**
```
REALISTART01 style, fine watercolor children's-book illustration.
[SCENE: the page moment — what happens, where, who, the emotion — concrete, ~50-80 words]
[Child: one compact line.]  [Companion: one compact line, if the page names it.]
[Composition: one line from the storyboard shot.]
```
Scene leads. Style is a tag, not a 427-word essay. One composition line, not four.

**Removed / bypassed:** the `framingDirective` block; the 330-word `optionBlock` inside the prompt (the LoRA carries style); the `Style:` sentence; the duplicate `entityLock`; both text-zone blocks (handle the overlay band in the reader/CSS, or one short clause at most); the Director LLM call; `composeStoryboardDrivenPagePrompt`; the gpt-image / Visual-Director / SDXL branches.

**Kept for Style 01:** the `sh-realistic-artistic` LoRA + a **verified** trigger word; the Storyboard's per-page shot as the single composition line; a compact character lock; the separate `negative_prompt` (NO_TEXT).

**How it preserves the three goals:**
- **Page-text match** — the scene is the first semantic content the model reads; nothing buries it.
- **Composition variety** — the fixed `framingDirective` is gone; the Storyboard's per-page shot is the *only* composition signal, so pages differ as the storyboard differs. (This also requires the Storyboard to actually vary shots — verify it does.)
- **Character continuity** — one clean, un-buried character lock + the LoRA; the child-photo `input_images` is the open variable, settled by the two-arm experiment (§7).
