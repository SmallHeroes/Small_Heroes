/**
 * Generate StoryPremiseCandidate batches for v3 Sprint A.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { buildCompanionContextBlock } from '../story-gen/companion-context';
import type { GoldenPremiseRecord, PremiseFamily, PremiseExperimentSpecV3, StoryPremiseCandidate } from './types';
import { formatGoldenPremisesForPrompt } from './golden-premise-extract';
import { normalizePremiseCandidate } from './premise-normalize';

const PREMISE_GEN_SYSTEM = `You invent STORY PREMISES for Hebrew children's books (ages 5–7).
You are NOT writing prose. You are NOT writing page beats.

Top principle: THE STORY LEADS. Resilience rides underneath.

A premise is a concrete story situation with story electricity — not a lesson.

## Literary DNA (not imitation of any author)
- absurd events told with full seriousness
- concrete child-world objects (pocket, popcorn, sock-ball, laundry basket, sticker, lunchbox)
- creatures with stubborn inner logic
- repetition with escalation
- warm narrator without adult abstraction
- humor before moral
- physical comedy

## Avoid symbolic-first engines
No light-stone, spark gate, glowing ring, magic mirror of feelings.
Test: if a child cannot touch, throw, drop, hide, or laugh at it — too abstract.

## Dini comic engine (high-level only — no exact joke lines)
- protective dragon logic
- big body trying to be careful
- tail/wing betrays emotion
- overprotection
- dragon-scale misreading of small child problems

## Each candidate MUST fill every StoryPremiseCandidate field.
whyNotTherapeuticFable must convincingly explain why this is a story, not a fable.
whyNotGoldenCopy must explain freshness vs calibration goldens.

Return ONLY JSON: { "candidates": StoryPremiseCandidate[] }`.trim();

const FAMILY_QUOTAS: Array<{ family: PremiseFamily; count: number; hint: string }> = [
  {
    family: 'everyday_magical_invasion',
    count: 3,
    hint: 'Magic invades ordinary home/play — pocket, laundry, lunchbox, bath, hallway',
  },
  {
    family: 'companion_causes_comic_mess',
    count: 3,
    hint: 'Dini overhelps physically — wing rearranges room, tail erases line, nest in wrong place',
  },
  {
    family: 'child_game_social',
    count: 3,
    hint: 'Playground/game/social try with smaller creature watching — child wants turn/status/fairness',
  },
  {
    family: 'object_creature_absurdity',
    count: 3,
    hint: 'Absurd object or tiny creature — popcorn hat, sleepy cloud, sock-ball, sticker rebellion',
  },
];

export async function generatePremiseCandidates(args: {
  spec: PremiseExperimentSpecV3;
  goldenPremises: GoldenPremiseRecord[];
  modelId: string;
}): Promise<StoryPremiseCandidate[]> {
  const companionBlock = buildCompanionContextBlock(args.spec.companionId);
  const goldenBlock = formatGoldenPremisesForPrompt(args.goldenPremises);

  const familyInstructions = FAMILY_QUOTAS.map(
    (f) => `- ${f.family}: exactly ${f.count} candidates — ${f.hint}`
  ).join('\n');

  const userPrompt = `
Companion DeepProfile + comic engine:
${companionBlock}

CALIBRATION GOLDEN PREMISE DNA (what "good" looks like — do NOT copy plots):
${goldenBlock}

EXPERIMENT:
- companion: ${args.spec.companionId}
- direction: ${args.spec.direction}
- resilience theme (HIDDEN under story): ${args.spec.resilienceTheme}
- child age: ${args.spec.childAgeMin}–${args.spec.childAgeMax}

FORBID PLOT COPY:
${args.spec.forbidPlotCopy.map((f) => `- ${f}`).join('\n')}

Generate exactly ${args.spec.candidateCount} premise candidates spanning families:
${familyInstructions}

Each candidate needs unique id like dini_premise_01.
titleSeed must include {{childName}}.
Set premiseFamily on each candidate.

bigReleasePayoff must be VISIBLE (something moves/opens/joins/laughs) — not calm-only.
childWant must belong to the child, not Dini or baby dragon.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-premise-gen',
    systemPrompt: PREMISE_GEN_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 16000,
    temperature: 0.85,
  });

  const parsed = parseJsonFromLLM<{ candidates: StoryPremiseCandidate[] }>(
    result.text,
    'v3-premise-gen'
  );

  if (parsed.candidates.length !== args.spec.candidateCount) {
    console.warn(
      `[v3-premise-gen] Expected ${args.spec.candidateCount}, got ${parsed.candidates.length}`
    );
  }

  return parsed.candidates.map((c, i) =>
    normalizePremiseCandidate(
      {
        ...c,
        id: c.id?.trim() || `dini_premise_${String(i + 1).padStart(2, '0')}`,
        resilienceTheme: c.resilienceTheme || args.spec.resilienceTheme,
      },
      args.spec.resilienceTheme
    )
  );
}
