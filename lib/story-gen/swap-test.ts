/**
 * swapTest — advisory companion-binding judge (Decision Gate §7).
 * Strips identity and asks: could a generic calm animal carry this story?
 */

import { parseJsonFromLLM } from '../story-generator/llm';
import { getDeepProfile } from '../companion-deep-profiles';
import { callAdvisoryLlmJson } from './advisory-llm';
import { buildCompanionContextBlock } from './companion-context';
import { extractStoryBodyFromMarkdown } from './craft-rubric-v2.1';
import { stripCompanionIdentity } from './engine-vocabulary';
import { BOLLY_ENGINE } from './scenarios-bolly-armadillo';

export const SWAP_TEST_PROMPT_VERSION = 'swap-test-v1';

export type SwapVerdict = 'pass' | 'weak-pass' | 'fail';

export interface SwapTestReport {
  status: 'advisory_real';
  advisoryOnly: true;
  notARealGate: true;
  module: 'swapTest';
  promptVersion: string;
  companionId: string;
  bindingScore: number;
  requiredCompanionSignals: string[];
  genericSubstitutionRisk: 'low' | 'medium' | 'high';
  missingProfileElements: string[];
  verdict: SwapVerdict;
  summary: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface RawSwapResponse {
  bindingScore: number;
  requiredCompanionSignals: string[];
  genericSubstitutionRisk: 'low' | 'medium' | 'high';
  missingProfileElements: string[];
  verdict: SwapVerdict;
  summary: string;
}

function companionSwapCriteria(companionId: string): string {
  const profile = getDeepProfile(companionId);
  const context = buildCompanionContextBlock(companionId);
  const lines = [context];
  if (profile.swapTest) lines.push(`Swap criteria: ${profile.swapTest}`);
  if (companionId === 'bolly_armadillo') {
    lines.push(`Engine: ${BOLLY_ENGINE}`);
    lines.push(
      'Must require shell/peek/curl mechanics — fails if generic teddy or calm animal works.'
    );
  }
  if (companionId === 'baby_elephant') {
    lines.push(
      'Must require ear-curtain, half-ear/one-sound tool, body-betrayal comedy — fails if generic sensitive animal or whale noise→song reframe works.'
    );
  }
  return lines.join('\n');
}

function buildSwapSystemPrompt(): string {
  return `You are a companion-BINDING judge for Hebrew picture-book stories (advisory only).
Score 0–10: how uniquely THIS companion's body/engine/flaw/voice is required.

Strip test: if companion name/species/signature were swapped for a generic calm animal, would the story still work?
- 8–10 pass: companion is irreplaceable (specific body comedy, ritual, flaw, voice)
- 5–7 weak-pass: some binding but partially generic
- 0–4 fail: generic animal / therapist / plush could carry it

Hard fail signals:
- Generic wise mentor or "soft friend" voice
- Coping tool not tied to companion anatomy
- Fear sanitized without companion-specific comic engine
- Story beats work identically for any calm animal

Return ONLY JSON:
{
  "bindingScore": 8.5,
  "requiredCompanionSignals": ["shell peek sequence", "..."],
  "genericSubstitutionRisk": "low" | "medium" | "high",
  "missingProfileElements": [],
  "verdict": "pass" | "weak-pass" | "fail",
  "summary": "2-3 sentences"
}`.trim();
}

function normalizeVerdict(raw: RawSwapResponse): SwapVerdict {
  if (raw.verdict === 'pass' || raw.verdict === 'weak-pass' || raw.verdict === 'fail') {
    return raw.verdict;
  }
  if (raw.bindingScore >= 7) return 'pass';
  if (raw.bindingScore >= 5) return 'weak-pass';
  return 'fail';
}

export async function runSwapTest(args: {
  storyMarkdown: string;
  companionId: string;
  modelId?: string;
}): Promise<SwapTestReport> {
  const storyBody = extractStoryBodyFromMarkdown(args.storyMarkdown);
  const stripped = stripCompanionIdentity(storyBody, args.companionId);
  const criteria = companionSwapCriteria(args.companionId);

  const userPrompt = `
Companion profile (${args.companionId}):
${criteria}

STORY (companion identity masked — judge binding from body/engine/flaw/voice cues that remain):
${stripped.slice(0, 8000)}
`.trim();

  const result = await callAdvisoryLlmJson({
    stage: 'swap-test',
    systemPrompt: buildSwapSystemPrompt(),
    userPrompt,
    modelId: args.modelId,
  });

  const parsed = parseJsonFromLLM<RawSwapResponse>(result.text, 'swap-test');
  const verdict = normalizeVerdict(parsed);

  return {
    status: 'advisory_real',
    advisoryOnly: true,
    notARealGate: true,
    module: 'swapTest',
    promptVersion: SWAP_TEST_PROMPT_VERSION,
    companionId: args.companionId,
    bindingScore: parsed.bindingScore,
    requiredCompanionSignals: parsed.requiredCompanionSignals ?? [],
    genericSubstitutionRisk: parsed.genericSubstitutionRisk ?? 'medium',
    missingProfileElements: parsed.missingProfileElements ?? [],
    verdict,
    summary: parsed.summary,
    modelId: result.modelId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

/** Soft Friend decoy body for sanity validation — must fail swap. */
export const SOFT_FRIEND_DECOY_MARKDOWN = `
title: "{{childName}} והחבר הרך"
companionId: generic_soft_friend
direction: fantasy

עמוד 1
בְּמָקוֹם שֶׁבּוֹ הָאוֹר רַךְ כְּמוֹ נְשִׁימָה, {{childName}} {עָמַד|עָמְדָה} לְבַד.

עמוד 2
חָבֵר רַךְ הוֹפִיעַ — לֹא בָּרוּר אֵיזֶה חַיָּה, אֲבָל נָעִים.
"אַל תִּדְאַג," אָמַר. "הַכֹּל יִהְיֶה בְּסֵדֶר."

עמוד 3
"אֲנִי קְצָת {מְפַחֵד|מְפַחֶדֶת}," {אָמַר|אָמְרָה} {{childName}}.
"זֶה לֹא בֶּאֱמֶת מַפְחִיד," אָמַר הֶחָבֵר הָרַךְ.

עמוד 8
וְכָךְ {{childName}} {לָמַד|לָמְדָה} שֶׁהָאֹמֶץ הָיָה תָּמִיד בִּפְנִים.
`.trim();

export async function runSwapTestOnDecoy(args?: { modelId?: string }): Promise<SwapTestReport> {
  return runSwapTest({
    storyMarkdown: SOFT_FRIEND_DECOY_MARKDOWN,
    companionId: 'generic_soft_friend',
    modelId: args?.modelId,
  });
}
