/**
 * Dini Exp2 — Exp1b/1c prose constraints + lift energy + fantasy guardrails.
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import {
  DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN,
  formatComicBitsForPrompt,
  getComicBitsForCompanion,
} from './companion-comic-bits';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const PROSE_EXP2_SYSTEM = `You write Hebrew read-aloud picture-book stories for Small Heroes (ages 5–7).
Generator-v2 Dini Exp2: convert LOCKED PageBeats into LIVE children's prose — not beat-sheet Hebrew.

## Event obedience
Obey every PageBeatV2 event, childAction, and complicationOrChange exactly.
The CHILD causes the outcome. דִּינִי may guide, misread, joke, worry, overprotect, fail physically — but does NOT solve the problem.
Baby dragon is NOT the protagonist.

## Companion comic bit bank
Use 2–3 bits from the bank, ADAPTED to page events.
- At most ONE bank bit per page.
- At least ONE bit must create a small story consequence (moves something, reveals pattern child notices, complicates then helps).
- Do not force bits. Child acts; Dini's body/comedy supports the child's action.

## Prose style — read-aloud, energetic children's book
- Short-to-medium sentences. Concrete verbs. Natural dialogue. Physical beats.
- Start pages with motion, dialogue, interruption, or decision — NOT atmosphere.
- At most ONE small lyrical touch in the ENTIRE story, grounded in visible action.
- NO therapy language. NO moral lecture.

## LIFT ENERGY (Exp2)
- Do NOT overuse breath/slow/quiet/pace/calm/waiting language. Max 2-3 such moments in whole story.
- Resilience tool appears through action, consequence, payoff — not repeated calming vocabulary.
- After brave action, give VISIBLE RELEASE: something moves, joins, opens, reacts, game changes.
- Ending must feel like WIN: "I did something. The world changed because of me." — not only "I breathed and understood."
- Use humor and physical action boldly — not joke stuffing.

## Fantasy constraints
- Fantasy detail must serve an event. No scenic pages where child only watches.
- Child must not become Dini's assistant.
- No Dini-led or baby-dragon-led climax.

## FORBIDDEN — rhetorical page-ending questions
Max ONE rhetorical question ending a page in the whole story.
End pages with action, interruption, visible next move.

## FORBIDDEN — explicit emotion-summary sentences
Show through body/action/dialogue. Never paste emotionalShift as abstract summary.

## דִּינִי voice
Name in prose: דִּינִי only (never dragon_dini). Protective dragon logic, big body careful, tail/wing reveals emotion.

## Gender chips
Every child-gendered verb near {{childName}}: {male|female} chip, options MUST differ.
Split mixed child+companion plural into two sentences with chips on child only.

## Partial niqqud (TTS)
Add partial niqqud on ambiguous words likely misread by TTS (עָלֶה, נָח, שָׁפַךְ/שָׁפְכָה, חוֹל, דְּלִי, גֶּשֶׁר, עָמַד/עָמְדָה, אֵשׁ, קֵן, כְּנָף, זָנָב, בֵּיצָה, חֹם).
Do NOT fully vocalize. Do not nikud every common word.

## v5 markdown format
# Story: <id> — Generator-v2 Exp2
Generated: <exact ISO from user prompt>
Source: Generator-v2 Dini Exp2 (locked spine/beats + comic bits)
Prompt-version: v2-event-driven-exp2

---
title, companionId: dragon_dini, direction: fantasy, category: NEW_SIBLING, timeOfDay, gender, pages: 16, endingType: residue, worldRule, powerCard (4 steps with chips)
---
metadata lines then --- Page N --- with Hebrew + imageDirection

Do NOT emit WORD_COUNT.`.trim();

export async function generateProseExp2(args: {
  spine: StorySpineV2;
  beats: PageBeatV2[];
  spec: ExperimentSpecV2;
  modelId: string;
  generatedAt?: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const comicBits = getComicBitsForCompanion(args.spec.companionId);
  const generatedAt = args.generatedAt ?? new Date().toISOString();

  const userPrompt = `
Companion profile:
${companionBlock}

COMPANION COMIC BIT BANK (adapt 2–3; one must affect story consequence):
${formatComicBitsForPrompt(comicBits)}

FORBIDDEN NEAR-GOLDEN:
${DRAGON_DINI_FORBIDDEN_NEAR_GOLDEN.map((l) => `- ${l}`).join('\n')}

LOCKED STORY SPINE:
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS:
${JSON.stringify(args.beats, null, 2)}

Setting: ${args.spec.setting}
Game: ${args.spec.gameOrPlayPattern}
Key object: ${args.spec.keyObject}

Use exact header timestamp: ${generatedAt}
titleSeed: ${args.spine.titleSeed}
pages: ${args.spec.pageCount}

Write the complete ${args.spec.pageCount}-page story now.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-prose-exp2',
    systemPrompt: PROSE_EXP2_SYSTEM,
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
