# Phase 3a.2 — Prompt cleanup (no behavior change in production prompts; small heuristic fixes)

## Principle
Three surgical fixes to stop Flux from defaulting to character portraits when story beats have clear actions.

After phase 3a, the system uses Flux-dev and produces real scenes — but ~7 of 9 pages still show the protagonist standing/sitting alone, disconnected from the story beat. Diagnosis based on debug-endpoint dumps:

1. Stage 4B Composition picks `character_scene + hero + character_vignette` for action beats that should be `action_page + action + world_scene`. Flux follows the composition and renders character vignettes.
2. `page.imagePrompt` is polluted by a `PROMPT_CONTRACT_PAGE_N: CRITICAL_IMAGE_RULE: ...` preamble — meta-instruction boilerplate, not scene content. T3 in phase 3a swapped the field but the field itself is contaminated upstream.
3. The final prompt leads with `MAIN CHARACTER LOCK` (~80 words). Scene/action signal is buried. Character lock dominates.

This phase fixes #1 with a heuristic override, #2 with a stripper, and #3 with a reorder.

## Scope

### In scope
- One file change: `backend/providers/image.ts`
- One env edit: `.env.local` add `ENABLE_PRESENTATION_POSTPROCESS=false` (user does this manually — included here only as a documented step in the test plan)
- New helper functions: `looksLikeActionBeat`, `stripPromptContractPreamble`
- One reorder of the final prompt assembly

### Out of scope — DO NOT TOUCH
- Story generation pipeline (`backend/providers/story.ts`, `backend/providers/pipeline.ts`) — the upstream pollution stays for now; we strip downstream.
- Stage 4B Composition logic — we override at prompt-build time, not at composition time.
- `lib/promptBuilder.ts` and `lib/visualDirector.ts` — no edits to either, unless absolutely necessary for the reorder. Prefer to do the reorder in `image.ts` where the parts are already being assembled.
- `lib/styles.ts` — no style content edits.
- DB schema, migrations, enums, reader, wizard, payment, story directions.
- LoRA, IP-Adapter, model changes.
- The 36 unrelated uncommitted files in the working tree.

## Tasks

### T1 — Action-beat heuristic override

Add a helper at the top of `backend/providers/image.ts`:

```ts
/**
 * Hebrew + English action verbs that signal a "scene with action", not a "character portrait".
 * If a page text contains any of these, the composition decision is overridden to a
 * scene-focused variant regardless of what stage 4B chose.
 */
const ACTION_VERB_PATTERNS = [
  // Hebrew movement / interaction (verb stems)
  /מציצ|מסתכל|רץ|רצה|הולך|הולכת|רוקד|רוקדת|קופץ|קופצת|מתחב|התחב|שומע|שומעת|מדבר|מדברת|מחבק|מחבקת|מצביע|מצביעה|מחזיק|מחזיקה|פותח|פותחת|סוגר|סוגרת|מתגל|מתגלגל|מתגלגלת|מתכרבל|מתכרבלת|מנסה|בורח|בורחת|רואה|רואים|מסתת|התרגש|התלהב/i,
  // Hebrew sound / emotion-with-action
  /צעק|לחש|שאל|ענה|חייך|בכה|התחבא|הציץ|רעם|רשרש|זרק|תפס|ניתר|נבהל|נדהם/i,
  // English fallback (for any English-content edge cases)
  /\b(peek|peeks|peeking|hide|hides|hiding|run|runs|running|walk|walks|walking|jump|jumps|jumping|dance|dances|dancing|talk|talks|talking|hug|hugs|hugging|point|points|pointing|hold|holds|holding|reach|reaches|reaching|look|looks|looking|listen|listens|listening|whisper|whispers|whispering|shout|shouts|shouting|smile|smiles|smiling|cry|cries|crying|chase|chases|chasing|flee|flees|fleeing|tumble|tumbles|tumbling)\b/i,
];

function looksLikeActionBeat(text: string | null | undefined): boolean {
  if (!text) return false;
  return ACTION_VERB_PATTERNS.some((re) => re.test(text));
}
```

Then, in the place where the composition context string is being assembled into the visual director input (search for `composition context` literal or for the JSON-stringified composition object — most likely in `buildVisualDirectorModelInput` or wherever the prompt is composed), apply the override:

```ts
// before any composition context is built
const isActionBeat = looksLikeActionBeat(input.pagePrompt) || looksLikeActionBeat(currentPageText);
const compositionOverride = isActionBeat
  ? {
      type: 'action_page',
      focus: 'action',
      camera: 'medium', // can stay whatever it was; medium is safe
      background: 'full',
      emotion: 'whatever it was', // preserve original emotion
    }
  : null;
// when constructing the composition context string, if compositionOverride is non-null,
// replace the relevant fields BUT preserve the camera and emotion that were originally chosen.
```

Implementation note: do NOT delete the original composition object. Override only `type`, `focus`, and `background`. Keep `camera` and `emotion` from the original choice. Also override `pageTemplate` from `character_vignette_text` to `art_top_text_bottom` when `isActionBeat`. This guarantees the resulting layout treats the image as scene-with-text-bottom, not as a character vignette.

Add a log so we can see when the override fires:
```
[composition_override] page=<n> isActionBeat=true beforeType=<x> afterType=action_page beforePageTemplate=<y> afterPageTemplate=art_top_text_bottom
```

### T2 — Strip `PROMPT_CONTRACT` pollution

Add helper:

```ts
/**
 * Some upstream stage stuffs `page.imagePrompt` with a "PROMPT_CONTRACT_PAGE_N: CRITICAL_IMAGE_RULE: ..."
 * preamble before any actual scene content. Flux treats it as instructions and the scene gets buried.
 * Strip everything up to and including the first instructional block; return only the scene tail.
 */
function stripPromptContractPreamble(raw: string | null | undefined): string {
  if (!raw) return '';
  let cleaned = raw;
  // Remove "PROMPT_CONTRACT_PAGE_N:" through the next "..." or section break
  cleaned = cleaned.replace(/PROMPT_CONTRACT_PAGE_\d+:[\s\S]*?(?=(?:SCENE:|VISUAL:|DESCRIPTION:|$))/gi, '');
  // Remove any lone "CRITICAL_IMAGE_RULE: ..." block at the start
  cleaned = cleaned.replace(/^[\s\S]*?CRITICAL_IMAGE_RULE:[\s\S]*?(?:image must\s*\.\.\.\s*"?)/i, '');
  // Remove trailing "..." truncation and whitespace
  cleaned = cleaned.replace(/^\s*\.\.\.\s*"?\s*/, '').trim();
  return cleaned;
}
```

Then, wherever `page.imagePrompt` is read and passed forward (likely the function that builds the visual director input), wrap it:

```ts
const cleanedImagePrompt = stripPromptContractPreamble(page.imagePrompt);
// Pass cleanedImagePrompt instead of page.imagePrompt
```

Log when stripping fires:
```
[image_prompt_stripped] page=<n> originalLen=<a> cleanedLen=<b> hadContract=<bool>
```

### T3 — Reorder the final prompt

Currently the prompt assembly in `image.ts` (around the `[image_prompt_final]` log) builds:

```
MAIN CHARACTER LOCK: ...           ← 80 words
MANDATORY RENDER CONSTRAINTS: ...  ← 70 words
CRITICAL TEXT EXCLUSION RULE: ...  ← 30 words
[style sentence]                    ← 50 words
Page N of M: Stage a scene...      ← actual scene
[character + companion lines]
[composition context]
```

Reorder to:

```
[style sentence]                    ← 50 words   (model sees style first)
SCENE: Page N of M: ...            ← actual scene action
[composition context]
[character + companion interaction]
MAIN CHARACTER LOCK: ...           ← only the essentials, condensed
MANDATORY RENDER CONSTRAINTS: ...  ← keep
CRITICAL TEXT EXCLUSION RULE: ...  ← keep, but trimmed
```

Implementation: in the function that assembles `finalPromptForReplicate` (in `generateWithReplicate`), reorder the parts. **Do not change the content of the parts** — only the order, and one optional condensation:

- `MAIN CHARACTER LOCK` block: condense to one paragraph (1-2 sentences) instead of 7 lines. Suggested: `MAIN CHARACTER LOCK: ${childLabel} is the same ${gender} in every image. ${age}. Hair: ${hair}. Skin: ${skinTone}. Eyes: ${eyes}. Clothing: ${clothing}. Keep identity consistent across all pages.` Single line, comma-separated. Keeps the same fields, drops the redundant boilerplate sentences.

The reorder lets Flux see "Style + Scene" before "Character" — the model anchors on the early tokens. Right now it anchors on character lock and treats everything else as decoration.

### T4 — Documented env step (no code)

In the PR description (or commit message), include this for the user:
```
After merging, add to .env.local:
  ENABLE_PRESENTATION_POSTPROCESS=false
Restart `npm run dev`. This kills the white fade artifact noted by the user.
```

Do NOT modify `.env.local` from the script — that's the user's local config.

## Safety
- All changes are in `backend/providers/image.ts`. No other production files touched.
- No changes to story generation, composition, style, character lock semantics, or DB.
- Heuristic override is opt-in by content (action verbs detected) — pages that genuinely should be character vignettes (calm intimate beats) still get the original composition.
- All changes can be reverted with `git checkout backend/providers/image.ts`.
- `npm run build` and `tsc --noEmit` must pass.

## Acceptance criteria
- `npm run build` passes.
- `tsc --noEmit` passes.
- For a fresh book with action-heavy story beats:
  - At least 70% of pages show the protagonist actively doing something in an environment, not standing/sitting in a vignette.
  - The `[composition_override]` log fires for action pages.
  - The `[image_prompt_stripped]` log shows `hadContract=true` if the upstream pollution is still present, with `cleanedLen` significantly shorter than `originalLen`.
  - The final prompt (`[image_prompt_final]`) starts with the style sentence, not with `MAIN CHARACTER LOCK:`.
- No regression on the read-v2 reader.

## Return format
- **GO / NO-GO**
- **Files changed** — should be exactly one: `backend/providers/image.ts`
- **Where the heuristic override applies** — file + function + line range
- **Where the strip helper applies** — file + function + line range
- **Where the reorder happens** — file + function + line range
- **Sample logs from a real generation run** — one full sequence covering one page that triggered the override and one that didn't
- **Sample finalPromptHead (first 250 chars)** — confirms the prompt now starts with the style sentence
- **Risks / open questions** — particularly: where is the upstream `PROMPT_CONTRACT` pollution introduced (file + function), so we know what to fix in a future phase
