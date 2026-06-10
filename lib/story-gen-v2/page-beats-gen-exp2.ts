/**
 * Exp2 — page beats with fantasy 16-page distribution + child-led guardrails.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, PageBeatV2, StorySpineV2 } from './types';

const BEATS_EXP2_SYSTEM = `You turn a StorySpine into page-level EVENT beats for a children's fantasy book.
You are NOT writing Hebrew prose.

HARD RULE: storyFactBefore MUST differ meaningfully from storyFactAfter every page.
No scenic fantasy pages where child only watches glowing cave/sky/nest.

CHILD-LED RULES:
- Every page needs child action, decision, discovery, failed attempt, or consequence.
- Child try-fail must appear on child's action (pages ~4-5), not Dini/baby dragon failing alone.
- Climax (pages ~10-11): brave CHILD action changes situation; Dini does not solve with dragon power.
- Payoff page: visible release — something moves/opens/reacts; not calm-only ending.
- Baby dragon is NOT the protagonist.

16-page fantasy distribution (approximate):
1 want/approach · 2 barrier · 3 companion enters · 4 child first attempt · 5 child fail/backfire ·
6 companion misread/vulnerability · 7 child notices opening · 8 new approach ·
9 complication · 10 brave child action · 11 world response/release · 12-14 fallout/play · 15-16 residue+win felt

Return ONLY JSON: { "beats": PageBeatV2[] } with exact page count.`.trim();

export async function generatePageBeatsExp2(args: {
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

Generate exactly ${args.spec.pageCount} PageBeatV2 entries.
childAction must be concrete physical/social action — not "מרגיש" or "צופה" alone.
pageTurnReason pulls forward with event, not rhetorical question.

Each beat object MUST include ALL keys: page, storyFactBefore, eventOnPage, childAction, complicationOrChange, emotionalShift, storyFactAfter, pageTurnReason. Never omit eventOnPage.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-page-beats-exp2',
    systemPrompt: BEATS_EXP2_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 12000,
    temperature: 0.55,
  });

  const parsed = parseJsonFromLLM<{ beats: PageBeatV2[] }>(result.text, 'v2-page-beats-exp2');
  if (parsed.beats.length !== args.spec.pageCount) {
    throw new Error(
      `[v2-page-beats-exp2] Expected ${args.spec.pageCount} beats, got ${parsed.beats.length}`
    );
  }

  const beats = parsed.beats.map((beat, i) => normalizePageBeat(beat, i + 1));
  return { beats, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}

function normalizePageBeat(beat: PageBeatV2, fallbackPage: number): PageBeatV2 {
  const page = beat.page ?? fallbackPage;
  const childAction = beat.childAction?.trim() || 'הילד פועל';
  const before = beat.storyFactBefore?.trim() || `לפני עמוד ${page}`;
  const after = beat.storyFactAfter?.trim() || before;
  const eventOnPage =
    beat.eventOnPage?.trim() || `${childAction} — משהו משתנה בעמוד ${page}`;
  const complication =
    beat.complicationOrChange?.trim() || 'המצב משתנה בגלל פעולת הילד או דיני';
  return {
    page,
    storyFactBefore: before,
    eventOnPage,
    childAction,
    complicationOrChange: complication,
    companionReaction: beat.companionReaction,
    emotionalShift: beat.emotionalShift?.trim() || 'שינוי קטן דרך פעולה',
    storyFactAfter: after,
    pageTurnReason: beat.pageTurnReason?.trim() || 'משהו חדש קורה',
    imageDirectionSeed: beat.imageDirectionSeed,
  };
}
