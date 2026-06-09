/**
 * Phase 2 — locked event spine before prose.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { ExperimentSpecV2, GoldenStoryDNA, StorySpineV2 } from './types';

const SPINE_SYSTEM = `You design the event engine of a children's story. You are NOT writing prose.
A beautiful mood is not a story. A page is valid only if something changes.
The child must CAUSE the story, not merely witness it.

Return ONLY valid JSON matching StorySpineV2.
All spine fields must be concrete physical/social events — not feelings alone.
oneSentenceEventChain must read as: desire → try/fail → companion misread → child discovery → brave child action → world response → residue.`.trim();

export async function generateStorySpineV2(args: {
  dna: GoldenStoryDNA;
  spec: ExperimentSpecV2;
  modelId: string;
}): Promise<{ spine: StorySpineV2; inputTokens: number; outputTokens: number }> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);

  const userPrompt = `
Companion profile:
${companionBlock}

GOLDEN EVENT DNA (structural template — do NOT copy plot/props from golden):
${JSON.stringify(
    {
      childDesire: args.dna.childDesire,
      entryBarrier: args.dna.entryBarrier,
      firstTry: args.dna.firstTry,
      firstTryFailsBecause: args.dna.firstTryFailsBecause,
      companionComicMistake: args.dna.companionComicMistake,
      companionVulnerability: args.dna.companionVulnerability,
      childNotices: args.dna.childNotices,
      childInvents: args.dna.childInvents,
      braveAction: args.dna.braveAction,
      worldResponse: args.dna.worldResponse,
      residue: args.dna.residue,
    },
    null,
    2
  )}

NEW STORY CONSTRAINTS (must use these — different from golden):
- setting: ${args.spec.setting}
- game/play pattern: ${args.spec.gameOrPlayPattern}
- key object: ${args.spec.keyObject}
- entry method: ${args.spec.entryMethod}
- final child action: ${args.spec.finalChildAction}
- theme: ${args.spec.resilienceTheme}
- pages: ${args.spec.pageCount}
- direction: ${args.spec.direction}

FORBIDDEN (plot-copy guard):
${args.spec.forbidPlotCopy.map((f) => `- ${f}`).join('\n')}

Return StorySpineV2 JSON with: titleSeed, direction, companionId, resilienceTheme,
protagonistWant, visibleProblem, firstAttempt, firstAttemptFailsBecause, secondComplication,
companionMisread, companionVulnerability, childDiscovery, childPlan, childBraveAction,
climaxChoice, payoff, emotionalResidue, oneSentenceEventChain.

titleSeed must include {{childName}}. companionId=${args.spec.companionId}. direction=${args.spec.direction}.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v2-story-spine',
    systemPrompt: SPINE_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.7,
  });

  const spine = parseJsonFromLLM<StorySpineV2>(result.text, 'v2-story-spine');
  return { spine, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
}
