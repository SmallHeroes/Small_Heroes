/**
 * Sprint B — Hebrew prose from approved PageBeatV3 + comic bits bank.
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import {
  DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN,
  formatComicBitsForPrompt,
  getComicBitsForCompanion,
} from '../story-gen-v2/companion-comic-bits';
import { POPCORN_TONE_GUARD } from './hardened-premise-p10';
import type { PageBeatV3, StoryPremiseCandidate, StorySpineV3 } from './types';

const PROSE_SPRINT_B_SYSTEM = `You write Hebrew read-aloud picture-book prose for Small Heroes ages 5–7.
Generator-v3 Sprint B — from LOCKED PageBeatV3 events.

## Core principle
THE STORY LEADS. Resilience rides underneath. Never state the lesson.

Hidden underlayer (do NOT headline): child tries something grown-up alone; big help can be too much; good help leaves room for my action.

## Style
- Short-to-medium sentences, dialogue, sound effects, physical comedy, repetition with variation
- Warm, silly, safe — NOT adult-literary, NOT therapy language
- Partial niqqud only on ambiguous words — do not over-nikud

## FORBIDDEN words/phrases
הבין ש, למד ש, לפעמים צריך, מרחב, לשחרר, שליטה, גבול, נשימה (as coping tool)
rhetorical page-ending questions
דיני הבינה / {{childName}} למד / כולם הרגישו

## Safety
${POPCORN_TONE_GUARD}
Early defuse: "אש!" is popcorn drama — חמאה וקצת דרמה, not real fire.
No microwave. No real flame.

## Page 7 discovery — SHOW don't explain
BAD: {{childName}} הבין/ה שצריך מקום
GOOD: towel flap, grains settle, "רגע — לא גג. מפרש."

## Ending structure
p10 = comic release (popcorn rain)
p11 = emotional release (sibling sees bowl, child proud — brief, not joke)
p12 = warm punchline callback ("אש" → "עוד סרט?")

## Child agency
Child wants, tries, fails, discovers, invents towel-sail, directs Dini. Dini does NOT solve climax.

## דִּינִי
Feminine fixed: דיני אמרה, דיני פרשה — NO gender chips on Dini.
Funny, protective, literal, too big for kitchen — NOT therapist.

## Companion comic bit bank
Use 2–3 bits from bank, adapted. Max 1 bank bit per page. Do not invent golden-copy lines.

## Gender chips (MANDATORY)
Every child-gendered verb/adj near {{childName}}: full {male|female} with DIFFERENT options.
CORRECT: {הוא|היא} {סגר|סגרה} {הרים|הרימה} {שמח|שמחה}
FORBIDDEN: ה{וא|יא} סגר{ה} {הרימ|הרימה} slash forms

{{childName}} stays double-braced — never a chip.

## v5 markdown format
# Story: <title> — Generator-v3 Sprint B
Generated: <ISO>
Source: Generator-v3 Sprint B (p10 popcorn)
Prompt-version: v3-sprint-b-prose

---
title: "..."
companionId: dragon_dini
direction: fantasy
category: NEW_SIBLING
timeOfDay: evening
gender: female
pages: 12
endingType: residue
worldRule: "..."
powerCard: (title, subtitle, coreTool, 4 steps with chips, companionReminder, visualMotifs)
---
metadata: storyStyle, metaphor, stakes, quietPagePosition, heartLine, etc.

--- Page N ---
imageDirection: English 25-55 words — scene only, who/what/where/key objects/Dini pose/child action. NO style boilerplate.
Hebrew prose (2-4 short paragraphs max)

Do NOT emit WORD_COUNT.`.trim();

export async function generateProseSprintB(args: {
  spine: StorySpineV3;
  beats: PageBeatV3[];
  premise: StoryPremiseCandidate;
  modelId: string;
  generatedAt?: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock('dragon_dini');
  const comicBits = getComicBitsForCompanion('dragon_dini');
  const generatedAt = args.generatedAt ?? new Date().toISOString();

  const anchors = `
REQUIRED ANCHORS (all must appear):
1. promised sibling popcorn / alone first time
2. kernel yells אש
3. Dini misunderstands and arrives
4. popcorn safety nest (pots, towels, wing)
5. child tries lid
6. lid rattles and fails
7. popcorn cloud to wing
8. butter-warm breath → more popping
9. wing-roof blocks bowl
10. kernel on Dini's nose
11. towel flap discovery (physical, not lecture)
12. towel-sail / wind tunnel — child directs Dini
13. popcorn rain payoff
14. עוד סרט callback
`;

  const userPrompt = `
Companion: ${companionBlock}

COMIC BIT BANK (place 2–3, max 1/page):
${formatComicBitsForPrompt(comicBits)}

FORBIDDEN NEAR-GOLDEN:
${DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN.map((l) => `- ${l}`).join('\n')}

LOCKED SPINE:
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS (obey events — live prose, not beat-sheet Hebrew):
${JSON.stringify(args.beats, null, 2)}

PREMISE:
${JSON.stringify(args.premise, null, 2)}

${anchors}

Generated timestamp: ${generatedAt}
titleSeed: ${args.spine.titleSeed}

Write complete 12-page story markdown now. Return valid story only.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-sprint-b-prose',
    systemPrompt: PROSE_SPRINT_B_SYSTEM,
    userPrompt,
    maxOutputTokens: 16000,
    temperature: 0.68,
  });

  return {
    storyMarkdown: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
