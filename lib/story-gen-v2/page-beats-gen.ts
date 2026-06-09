/**
 * Phase 3 — page-level event beats (state changes, not tableaux).
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const BEATS_SYSTEM = `You turn a StorySpine into page-level EVENT beats for a children's book.
You are NOT writing Hebrew prose.

HARD RULE: for every page, storyFactBefore MUST differ meaningfully from storyFactAfter.
If the situation after the page is basically the same as before, the page is STATIC and invalid.

Do not create scenic moments. Create state changes.
The child must do, choose, notice, ask, refuse, try, invent, or change something on most pages.

12-page adventure distribution (approximate):
1 want/approach · 2 barrier · 3 companion enters · 4 first attempt · 5 fail/backfire ·
6 companion misread/vulnerability · 7 child notices opening · 8 new approach ·
9 complication · 10 brave child action · 11 world response · 12 residue

Return ONLY JSON: { "beats": PageBeatV2[] } with exactly the requested page count.`.trim();

export async function generatePageBeatsV2(args: {
  spine: StorySpineV2;
  spec: ExperimentSpecV2;
  modelId: string;
}): Promise<{ beats: PageBeatV2[]; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);

  const userPrompt = `
Companion profile:
${companionBlock}

LOCKED STORY SPINE:
${JSON.stringify(args.spine, null, 2)}

PLOT CONSTRAINTS:
- setting: ${args.spec.setting}
- game: ${args.spec.gameOrPlayPattern}
- key object: ${args.spec.keyObject}
- FORBIDDEN: ${args.spec.forbidPlotCopy.join('; ')}

Generate exactly ${args.spec.pageCount} PageBeatV2 entries (pages 1..${args.spec.pageCount}).
Each beat: page, storyFactBefore, eventOnPage, childAction, complicationOrChange,
companionReaction?, emotionalShift, storyFactAfter, pageTurnReason, imageDirectionSeed?.

childAction must be concrete. pageTurnReason must create a reason to turn the page.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-page-beats',
    systemPrompt: BEATS_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 8192,
    temperature: 0.6,
  });

  const parsed = parseJsonFromLLM<{ beats: PageBeatV2[] }>(result.text, 'v2-page-beats');
  if (parsed.beats.length !== args.spec.pageCount) {
    throw new Error(
      `[v2-page-beats] Expected ${args.spec.pageCount} beats, got ${parsed.beats.length}`
    );
  }
  return { beats: parsed.beats, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
