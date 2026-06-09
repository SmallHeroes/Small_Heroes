/**
 * Optional Sprint A phase 2 — convert selected premise to spine + beats (no prose).
 * Only run after human premise gate passes.
 */

import fs from 'fs';
import path from 'path';

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { PageBeatV2, StorySpineV2 } from '../story-gen-v2/types';
import type { PremiseExperimentSpecV3, StoryPremiseCandidate } from './types';

const SPINE_FROM_PREMISE_SYSTEM = `Convert a StoryPremiseCandidate into StorySpineV2 JSON (event engine, not prose).
Preserve the weird hook, physical play, child agency, and visible payoff from the premise.
Child owns climax. Companion supports only.

Return ONLY StorySpineV2 JSON.`.trim();

const BEATS_FROM_PREMISE_SYSTEM = `Convert StorySpineV2 + premise into 16 PageBeatV2 entries (fantasy).
Every page must change state. Child acts on most pages.
Return ONLY { "beats": PageBeatV2[] }.`.trim();

export async function generateSpineAndBeatsFromPremise(args: {
  premise: StoryPremiseCandidate;
  spec: PremiseExperimentSpecV3;
  runDir: string;
  modelId: string;
  pageCount?: number;
}): Promise<void> {
  const pageCount = args.pageCount ?? 16;
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const llm = new OpenAIResponsesLLM(args.modelId);

  const spineResult = await llm.call({
    stage: 'v3-premise-to-spine',
    systemPrompt: SPINE_FROM_PREMISE_SYSTEM,
    userPrompt: `
Companion: ${companionBlock}

PREMISE (locked):
${JSON.stringify(args.premise, null, 2)}

direction=${args.spec.direction} companionId=${args.spec.companionId}`.trim(),
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0.6,
  });

  const spine = parseJsonFromLLM<StorySpineV2>(spineResult.text, 'v3-premise-to-spine');
  fs.writeFileSync(path.join(args.runDir, 'story-spine.json'), JSON.stringify(spine, null, 2));

  const beatsResult = await llm.call({
    stage: 'v3-premise-to-beats',
    systemPrompt: BEATS_FROM_PREMISE_SYSTEM,
    userPrompt: `
PREMISE:
${JSON.stringify(args.premise, null, 2)}

SPINE:
${JSON.stringify(spine, null, 2)}

Generate exactly ${pageCount} beats.`.trim(),
    jsonMode: true,
    maxOutputTokens: 12000,
    temperature: 0.55,
  });

  const { beats } = parseJsonFromLLM<{ beats: PageBeatV2[] }>(
    beatsResult.text,
    'v3-premise-to-beats'
  );
  fs.writeFileSync(path.join(args.runDir, 'page-beats.json'), JSON.stringify(beats, null, 2));
}
