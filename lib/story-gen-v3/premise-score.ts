/**
 * LLM judge scoring for surviving premise candidates.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import type { GoldenPremiseRecord, PremiseScoreDimensions, StoryPremiseCandidate } from './types';
import { formatGoldenPremisesForPrompt } from './golden-premise-extract';

const WEIGHTS: Record<keyof Omit<PremiseScoreDimensions, 'emotionalAlignment'>, number> = {
  hookStrength: 0.2,
  comicEngineStrength: 0.15,
  physicalPlayPotential: 0.15,
  childAgencyPotential: 0.15,
  tryFailPotential: 0.1,
  payoffReleasePotential: 0.1,
  companionSpecificity: 0.05,
  visualPageVariety: 0.05,
  lowMoralizingRisk: 0.05,
};

const EMOTIONAL_THRESHOLD = 6;

const JUDGE_SYSTEM = `You score children's story PREMISES (not prose) for Small Heroes Generator-v3.

Score each dimension 0–10 (integers).
Reward story electricity first — hook, physical play, comic engine, child agency, visible payoff.
Penalize therapeutic fables, abstract magic objects, companion-led arcs (companion solves climax or owns discovery).

ROLE RULE: The child protagonist is always {{childName}} — never call the companion by the child's name in notes.
Companion names (Uri, Koko, Dini, etc.) are separate from the child; critique child vs companion roles neutrally.

emotionalAlignment: does a real child feeling exist under the funny hook? (threshold ≥6 required)

Return ONLY JSON:
{
  "scores": { hookStrength, comicEngineStrength, physicalPlayPotential, childAgencyPotential, tryFailPotential, payoffReleasePotential, companionSpecificity, visualPageVariety, lowMoralizingRisk, emotionalAlignment },
  "weightedTotal": number,
  "notes": string
}`.trim();

/** Exported for regression tests — judge/critic prompts stay companion-neutral. */
export const PREMISE_CRITIC_SYSTEM = `You are a harsh premise critic. List 2–4 specific weaknesses of this children's story premise.
Focus: therapeutic fable risk, abstract symbolism, weak hook, companion-led arc (companion solves climax), flat payoff.

ROLE RULE: The child protagonist is {{childName}} in titleSeed/childWant — never confuse companion name with the child.
Example mistake to avoid: calling the child "Uri" when Uri is the fox companion.

Return ONLY JSON: { "attacks": string[] }`.trim();

export function computeWeightedTotal(scores: PremiseScoreDimensions): number {
  let total = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const k = key as keyof typeof WEIGHTS;
    total += (scores[k] ?? 0) * weight;
  }
  return Math.round(total * 100) / 100;
}

export async function scorePremiseCandidate(args: {
  candidate: StoryPremiseCandidate;
  goldenPremises: GoldenPremiseRecord[];
  modelId: string;
}): Promise<{ scores: PremiseScoreDimensions; weightedTotal: number; notes: string }> {
  const goldenBlock = formatGoldenPremisesForPrompt(args.goldenPremises);

  const userPrompt = `
CALIBRATION (what good looks like):
${goldenBlock}

CANDIDATE TO SCORE:
${JSON.stringify(args.candidate, null, 2)}

Score honestly. If it feels like a therapeutic fable, hookStrength and lowMoralizingRisk should be low.`.trim();

  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-premise-judge',
    systemPrompt: JUDGE_SYSTEM,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 1024,
    temperature: 0.3,
  });

  const parsed = parseJsonFromLLM<{
    scores: PremiseScoreDimensions;
    weightedTotal?: number;
    notes: string;
  }>(result.text, 'v3-premise-judge');

  const weightedTotal = parsed.weightedTotal ?? computeWeightedTotal(parsed.scores);
  return { scores: parsed.scores, weightedTotal, notes: parsed.notes };
}

export function passesEmotionalThreshold(scores: PremiseScoreDimensions): boolean {
  return (scores.emotionalAlignment ?? 0) >= EMOTIONAL_THRESHOLD;
}

export async function criticAttackPremise(args: {
  candidate: StoryPremiseCandidate;
  modelId: string;
}): Promise<string[]> {
  const llm = new OpenAIResponsesLLM(args.modelId);
  const result = await llm.call({
    stage: 'v3-premise-critic',
    systemPrompt: PREMISE_CRITIC_SYSTEM,
    userPrompt: JSON.stringify(args.candidate, null, 2),
    jsonMode: true,
    maxOutputTokens: 512,
    temperature: 0.4,
  });

  const parsed = parseJsonFromLLM<{ attacks: string[] }>(result.text, 'v3-premise-critic');
  return parsed.attacks ?? [];
}
