import type { LoadedGoldenExample } from './load-golden';
import type { RecipeDirection } from './golden-examples';

export interface RecipeRequest {
  /** Hebrew canonical name of the companion. e.g. 'מתי', 'בובו'. */
  companionName: string;
  /** Slug for record-keeping. e.g. 'turtle_beiti'. */
  companionSlug: string;
  /** Short Hebrew description of the companion (physical + personality). */
  companionDescription: string;
  /** bedtime | adventure | fantasy. */
  direction: RecipeDirection;
  /** Category like NIGHT_FEAR, ANGER, etc. */
  category: string;
  /** Short Hebrew description of the child's challenge in 1-2 sentences. */
  childChallenge: string;
  /** Short Hebrew description of the resilience metaphor (the mechanism). */
  resilienceMetaphor: string;
}

const PAGE_COUNT_BY_DIRECTION: Record<RecipeDirection, number> = {
  bedtime: 10,
  adventure: 15,
  fantasy: 20,
};

const AGE_BY_DIRECTION: Record<RecipeDirection, string> = {
  bedtime: '4-6',
  adventure: '6-8',
  fantasy: '6-8',
};

const SYSTEM_PROMPT = `You are a master Hebrew children's-book author writing for "Small Heroes".

Each story you write follows a specific literary discipline that the examples below demonstrate. Study them carefully BEFORE you write — they are your training set, not just decoration.

Universal craft rules (NEVER violate):
1. **NO explicit moral or metaphor statements.** The lesson lives in action, never in a sentence. Characters do not say "and so the child learned that...". Mom does not say "love makes room". The companion does not explain "this is a metaphor for...".
2. **Show, don't tell.** The metaphor is enacted by characters and objects, not narrated.
3. **The fear is not erased.** The corridor stays dark. The new sibling stays. The race stays lost. Only the child's relationship to it changes.
4. **The companion is NOT a wise teacher who solves things.** They share the child's struggle from the inside, demonstrate something with their own body, sometimes fail, sometimes hesitate.
5. **Heart line:** every story has 1-2 sentences that crystallize the emotional truth WITHOUT preaching. These are the lines parents will remember.
6. **Agency transfer:** somewhere in the middle, the child stops being the one who needs help and becomes the one who notices, regulates, or helps the companion. This is NEVER stated; only shown.
7. **Residue ending:** the story closes with one small physical/sensory thing that remains — a copper-dust grain, a hum in the chest, a thread, a tiny smell — proof the experience was real.

Universal style rules:
- Hebrew without nikud.
- Gender placeholders: simple verbs use "/ה" suffix (e.g. "אמר/ה"), irregulars use chip form "{זכר|נקבה}" (e.g. "{הוא|היא}", "{ראה|ראתה}", "{אותו|אותה}", "{תינוק|תינוקת}"). Never use "/ת" (won't resolve).
- Child name placeholder: {{childName}} on at least 5 different pages.
- Short sentences. Concrete language. No inflated metaphors. No flowery descriptions.
- One imageDirection in English per page (after the page text).
- The page word count should average 50-80 words.

Output format — EXACTLY this structure:

\`\`\`
# Story: <slug> — Story Bank v5 (Literary Rewrite)
Generated: <iso-date>
Source: recipe few-shot generator
Companion canonical name: <hebrew name>
Prompt-version: v5-recipe-fewshot
Notes: <direction> / <category> / <pages> pages / residue = <one-line>

---
title: "<hebrew title with {{childName}}>"
companionId: <companion slug>
direction: <bedtime|adventure|fantasy>
category: <CATEGORY>
gender: male
pages: <count>
endingType: residue
worldRule: "<one-line philosophical rule from the story>"
---

storyStyle: <one line>
metaphor: <one line>
stakes: <one line>
quietPagePosition: <number>
heartLine: <page X — "the line">
emotionalMistake: <page X — what>
uncomfortableTruth: <page X — "the truth"> 

--- Page 1 ---
<hebrew page 1 text>

imageDirection: <english image direction>

--- Page 2 ---
<hebrew page 2 text>

imageDirection: <english image direction>

... continue for all pages ...

WORD_COUNT: [n1, n2, ...] = [total]
\`\`\`
`.trim();

function exampleAsTrainingBlock(ex: LoadedGoldenExample, idx: number): string {
  return [
    `EXAMPLE ${idx + 1} — ${ex.slug}`,
    '===',
    ex.raw.trim(),
    '===',
  ].join('\n');
}

export function buildFewShotPrompt(
  request: RecipeRequest,
  examples: LoadedGoldenExample[]
): { system: string; user: string; expectedPageCount: number } {
  const pageCount = PAGE_COUNT_BY_DIRECTION[request.direction];
  const age = AGE_BY_DIRECTION[request.direction];

  const userPrompt = [
    `Below are ${examples.length} golden examples of "Small Heroes" ${request.direction} stories. Study their craft, voice, pacing, and structure carefully.`,
    '',
    examples.map((ex, idx) => exampleAsTrainingBlock(ex, idx)).join('\n\n'),
    '',
    '====',
    '',
    `Now write a NEW story matching this exact craft level.`,
    '',
    `Direction: ${request.direction}`,
    `Category: ${request.category}`,
    `Page count: ${pageCount} (EXACT — no more, no less)`,
    `Child age: ${age}`,
    '',
    `Companion: ${request.companionName}`,
    `Companion description: ${request.companionDescription}`,
    `Companion slug: ${request.companionSlug}`,
    '',
    `Child's challenge: ${request.childChallenge}`,
    '',
    `Resilience metaphor (must live in ACTION not narration): ${request.resilienceMetaphor}`,
    '',
    `Write the full story in Hebrew, output ONLY the markdown structure shown in the examples above — frontmatter, metadata block, ${pageCount} pages with imageDirection per page, WORD_COUNT footer at the end. NO commentary, NO explanation outside the file.`,
  ].join('\n');

  return {
    system: SYSTEM_PROMPT,
    user: userPrompt,
    expectedPageCount: pageCount,
  };
}
