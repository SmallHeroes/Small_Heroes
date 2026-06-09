/**
 * Extract StoryPremiseCandidate from hand-authored goldens (calibration anchors).
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import type { GoldenPremiseRecord, StoryPremiseCandidate } from './types';
import { loadGoldenStoryMarkdown } from './golden-story-loader';
import { normalizePremiseCandidate } from './premise-normalize';

const EXTRACT_SYSTEM = `You extract the STORY PREMISE (not prose, not page beats) from a Hebrew children's golden story.

The premise is the concrete story situation — what makes a human say "that's a story."
Resilience rides underneath; it is NOT the headline.

Map into StoryPremiseCandidate JSON with ALL fields filled.
Use English for structural/analysis fields unless the golden's hook is inherently Hebrew — then oneLineHook may be Hebrew.

Good premise DNA:
- weird/funny physical opening
- child wants something concrete
- playable objects (sandbox, leaf, pocket, flashlight — not abstract light-stone)
- companion comic engine visible
- try-fail with funny physical image
- payoff with visible release, not calm-only

whyNotTherapeuticFable must be convincing — explain why this is a story situation, not a lesson.

Return ONLY valid JSON: { "premise": StoryPremiseCandidate, "calibrationNotes": string }`.trim();

export async function extractGoldenPremise(args: {
  sourceStoryId: string;
  companionId: string;
  direction: 'bedtime' | 'adventure' | 'fantasy';
  modelId: string;
}): Promise<GoldenPremiseRecord> {
  const goldenMarkdown = loadGoldenStoryMarkdown(args.sourceStoryId);
  const llm = new OpenAIResponsesLLM(args.modelId);

  const result = await llm.call({
    stage: 'v3-golden-premise',
    systemPrompt: EXTRACT_SYSTEM,
    userPrompt: `
Source story id: ${args.sourceStoryId}
Companion: ${args.companionId}
Direction: ${args.direction}

GOLDEN STORY (read premise DNA — do not copy plot verbatim for new stories):
${goldenMarkdown.slice(0, 14000)}

Extract premise DNA. id should be "${args.sourceStoryId}_premise". titleSeed may use {{childName}}.`.trim(),
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.4,
  });

  const parsed = parseJsonFromLLM<{
    premise: StoryPremiseCandidate;
    calibrationNotes: string;
  }>(result.text, 'v3-golden-premise');

  return {
    sourceStoryId: args.sourceStoryId,
    companionId: args.companionId,
    direction: args.direction,
    premise: normalizePremiseCandidate(
      { ...parsed.premise, id: `${args.sourceStoryId}_premise` },
      'golden calibration'
    ),
    calibrationNotes: parsed.calibrationNotes,
  };
}

export async function extractAllGoldenPremises(args: {
  goldenIds: Array<{ id: string; companionId: string; direction: 'bedtime' | 'adventure' | 'fantasy' }>;
  modelId: string;
}): Promise<GoldenPremiseRecord[]> {
  const out: GoldenPremiseRecord[] = [];
  for (const g of args.goldenIds) {
    console.log(`[v3] extract golden premise: ${g.id}`);
    out.push(
      await extractGoldenPremise({
        sourceStoryId: g.id,
        companionId: g.companionId,
        direction: g.direction,
        modelId: args.modelId,
      })
    );
  }
  return out;
}

export function formatGoldenPremisesForPrompt(records: GoldenPremiseRecord[]): string {
  return records
    .map((r) => {
      const p = r.premise;
      return [
        `### ${r.sourceStoryId} (${r.direction})`,
        `Hook: ${p.oneLineHook}`,
        `Opening: ${p.openingWeirdEvent}`,
        `Child want: ${p.childWant}`,
        `Play: ${p.playSystem} | Objects: ${(p.keyObjects ?? []).join(', ')}`,
        `Try-fail: ${p.firstTry} → ${p.funnyFailureImage}`,
        `Payoff: ${p.bigReleasePayoff}`,
        `Hidden resilience: ${p.hiddenResilienceTool}`,
        `Why not fable: ${p.whyNotTherapeuticFable}`,
        `Calibration: ${r.calibrationNotes}`,
      ].join('\n');
    })
    .join('\n\n');
}
