/**
 * Phase 5 — Hebrew prose from locked PageBeats (event-first, no enrich/word-floor).
 */

import { OpenAIResponsesLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const PROSE_SYSTEM = `You write Hebrew picture-book stories for Small Heroes (ages 3–6).
Generator-v2: EVENT-DRIVEN prose only.

For each page:
1. Start with motion, dialogue, interruption, decision, or discovery — NOT atmosphere.
2. Something must happen that was NOT true on the previous page.
3. The child must do, choose, notice, ask, refuse, try, invent, or change something.
4. Description only AFTER the event is clear.
5. End with a small reason to turn the page.
6. At most ONE sentence of atmosphere before action.
7. If a page can be summarized as "the child feels X while seeing Y," rewrite it.

Rules:
- Partial niqqud on key words for TTS.
- Gender chips: {male|female} for every child-gendered verb/adjective — options MUST differ.
- {{childName}} placeholder (double braces) — never a fixed name.
- Companion specific voice — not therapist.
- No moralizing lecture; show through action and residue ending.
- No abstract adult closure metaphors.
- imageDirection: one English line per page after prose.
- Do NOT emit WORD_COUNT.

Output full story markdown:
- Header comment (# Story, Generated, Source: Generator-v2 spike, Prompt-version: v2-event-driven)
- YAML frontmatter (title, companionId, direction, category: SOCIAL, timeOfDay, gender, pages, endingType: residue, worldRule, powerCard with 4 steps)
- metadata lines: storyStyle, metaphor, stakes, quietPagePosition, heartLine, emotionalMistake, uncomfortableTruth, agencyTransfer
- --- Page N --- blocks with Hebrew prose then imageDirection line`.trim();

export async function generateProseV2(args: {
  spine: StorySpineV2;
  beats: PageBeatV2[];
  spec: ExperimentSpecV2;
  modelId: string;
}): Promise<{ storyMarkdown: string; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);

  const userPrompt = `
Companion profile:
${companionBlock}

LOCKED STORY SPINE:
${JSON.stringify(args.spine, null, 2)}

LOCKED PAGE BEATS (obey exactly — do not add scenic padding):
${JSON.stringify(args.beats, null, 2)}

Setting: ${args.spec.setting}
Game: ${args.spec.gameOrPlayPattern}
Key object: ${args.spec.keyObject}

Write the complete ${args.spec.pageCount}-page Hebrew story markdown now.
The CHILD is the protagonist — they cause the outcome, not only enable the companion.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-prose',
    systemPrompt: PROSE_SYSTEM,
    userPrompt,
    maxOutputTokens: 12000,
    temperature: 0.75,
  });

  return {
    storyMarkdown: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
