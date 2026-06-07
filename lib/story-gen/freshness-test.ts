/**
 * freshnessTest — advisory corpus overlap with engine-vs-shape distinction.
 * Decision Gate §6: penalize story SHAPE reuse, allow companion signature ENGINE recurrence.
 */

import { parseJsonFromLLM } from '../story-generator/llm';
import { callAdvisoryLlmJson } from './advisory-llm';
import { extractStoryBodyFromMarkdown } from './craft-rubric-v2.1';
import {
  engineChannelIds,
  FRESHNESS_DIMENSIONS,
  maskCompanionEngine,
  shapeChannelIds,
  type FreshnessChannel,
} from './engine-vocabulary';
import {
  corpusIndexForPrompt,
  loadFreshnessCorpus,
  type FreshnessCorpusEntry,
} from './freshness-corpus';

export const FRESHNESS_TEST_PROMPT_VERSION = 'freshness-test-v1';

export type FreshnessRecommendation = 'pass' | 'caution' | 'reroll' | 'revise';

export interface FreshnessDimensionRow {
  dimensionId: string;
  label: string;
  channel: FreshnessChannel;
  overlapScore: number;
  /** Score used for gating — engine channel discounted when same companion reuses engine. */
  effectiveScore: number;
  evidence: string;
  nearestMatchId: string;
  nearestMatchCompanionId: string;
  recommendation: FreshnessRecommendation;
}

export interface FreshnessTestReport {
  status: 'advisory_real';
  advisoryOnly: true;
  notARealGate: true;
  module: 'freshnessTest';
  promptVersion: string;
  candidateId: string;
  candidateCompanionId: string;
  compareMode: 'corpus' | 'pairwise' | 'self';
  compareTargetId?: string;
  dimensions: FreshnessDimensionRow[];
  shapeOverlapMax: number;
  shapeOverlapMean: number;
  engineOverlapMax: number;
  sameEngineDifferentShape: boolean;
  recommendation: FreshnessRecommendation;
  summary: string;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface RawFreshnessDim {
  dimensionId: string;
  overlapScore: number;
  evidence: string;
  nearestMatchId: string;
}

interface RawFreshnessResponse {
  dimensions: RawFreshnessDim[];
  summary: string;
}

const ENGINE_VS_SHAPE_RULE = `
CRITICAL ENGINE vs SHAPE RULE (non-negotiable):
- SIGNATURE ENGINE overlap is ALLOWED and EXPECTED when the same companion reuses its ritual/tool/comic body (e.g. Tubi half-ear/one-sound, Bolly peek/shell).
- STORY SHAPE overlap is RISK — reused opening/trigger/climax/agency arc/residue across the catalog.
- For engine-channel dimensions (toolCopingAction, signatureImagery, comicEngine): score 0–1 when two stories share the SAME companion's engine; score 2–4 only if a DIFFERENT companion's engine is copied or the beat-for-beat arc is cloned.
- For shape-channel dimensions: score 0=distinct, 4=near-duplicate shape. Same companion with different scenario should usually score 0–2.
- Comparing Tubi S5 vs Tubi S2: engine dims may overlap (OK); shape dims must stay low — verdict PASS.
- Comparing identical story to itself: all dims should be 4 — verdict reroll.
`.trim();

function buildFreshnessSystemPrompt(): string {
  const dimList = FRESHNESS_DIMENSIONS.map(
    (d) => `${d.id} (${d.label}, ${d.channel})`
  ).join('\n');
  return `You are a Hebrew picture-book FRESHNESS judge (advisory only).
Compare the CANDIDATE story's structural fingerprint vs the CORPUS — NOT prose quality.

${ENGINE_VS_SHAPE_RULE}

Score each dimension overlap 0–4:
0 = clearly distinct
1 = faint echo
2 = moderate similarity (caution)
3 = strong template reuse (revise)
4 = near-duplicate (reroll)

Dimensions:
${dimList}

Return ONLY JSON:
{
  "dimensions": [
    {
      "dimensionId": "openingDevice",
      "overlapScore": 0,
      "evidence": "one sentence",
      "nearestMatchId": "corpus_id"
    }
  ],
  "summary": "2-3 sentences"
}`.trim();
}

function adjustEffectiveScore(args: {
  raw: number;
  channel: FreshnessChannel;
  candidateCompanionId: string;
  nearestCompanionId: string;
  compareMode: FreshnessTestReport['compareMode'];
}): number {
  if (args.compareMode === 'self') return args.raw;
  if (args.channel === 'engine') {
    if (args.candidateCompanionId === args.nearestCompanionId) {
      return Math.min(args.raw, 1);
    }
  }
  return args.raw;
}

function dimRecommendation(effective: number): FreshnessRecommendation {
  if (effective >= 4) return 'reroll';
  if (effective >= 3) return 'revise';
  if (effective >= 2) return 'caution';
  return 'pass';
}

function aggregateRecommendation(
  shapeMax: number,
  compareMode: FreshnessTestReport['compareMode']
): FreshnessRecommendation {
  if (compareMode === 'self' && shapeMax >= 3) return 'reroll';
  if (shapeMax >= 4) return 'reroll';
  if (shapeMax >= 3) return 'revise';
  if (shapeMax >= 2) return 'caution';
  return 'pass';
}

function normalizeRows(
  raw: RawFreshnessResponse,
  args: {
    candidateCompanionId: string;
    compareMode: FreshnessTestReport['compareMode'];
    corpus: FreshnessCorpusEntry[];
  }
): FreshnessDimensionRow[] {
  const byId = new Map(args.corpus.map((c) => [c.id, c]));
  return FRESHNESS_DIMENSIONS.map((def) => {
    const hit =
      raw.dimensions.find((d) => d.dimensionId === def.id) ??
      ({
        dimensionId: def.id,
        overlapScore: 0,
        evidence: 'missing from judge',
        nearestMatchId: '',
      } as RawFreshnessDim);
    const nearest = byId.get(hit.nearestMatchId);
    const nearestCompanionId = nearest?.companionId ?? '';
    const effectiveScore = adjustEffectiveScore({
      raw: hit.overlapScore,
      channel: def.channel,
      candidateCompanionId: args.candidateCompanionId,
      nearestCompanionId,
      compareMode: args.compareMode,
    });
    return {
      dimensionId: def.id,
      label: def.label,
      channel: def.channel,
      overlapScore: hit.overlapScore,
      effectiveScore,
      evidence: hit.evidence,
      nearestMatchId: hit.nearestMatchId,
      nearestMatchCompanionId: nearestCompanionId,
      recommendation: dimRecommendation(effectiveScore),
    };
  });
}

async function judgeFreshness(args: {
  candidateId: string;
  candidateCompanionId: string;
  candidateBody: string;
  candidateMasked: string;
  corpus: FreshnessCorpusEntry[];
  compareMode: FreshnessTestReport['compareMode'];
  compareTargetId?: string;
  modelId?: string;
}): Promise<FreshnessTestReport> {
  const corpusIndex = corpusIndexForPrompt(args.corpus, 350);
  const userPrompt = `
CANDIDATE id=${args.candidateId} companion=${args.candidateCompanionId} mode=${args.compareMode}
${args.compareTargetId ? `PAIR TARGET id=${args.compareTargetId}` : ''}

CANDIDATE (engine tokens masked for shape read):
${args.candidateMasked.slice(0, 6000)}

CORPUS INDEX (${args.corpus.length} stories):
${corpusIndex}
`.trim();

  const result = await callAdvisoryLlmJson({
    stage: 'freshness-test',
    systemPrompt: buildFreshnessSystemPrompt(),
    userPrompt,
    modelId: args.modelId,
  });

  const parsed = parseJsonFromLLM<RawFreshnessResponse>(result.text, 'freshness-test');
  const dimensions = normalizeRows(parsed, {
    candidateCompanionId: args.candidateCompanionId,
    compareMode: args.compareMode,
    corpus: args.corpus,
  });

  const shapeRows = dimensions.filter((d) => d.channel === 'shape');
  const engineRows = dimensions.filter((d) => d.channel === 'engine');
  const shapeOverlapMax = Math.max(0, ...shapeRows.map((d) => d.effectiveScore));
  const shapeOverlapMean =
    shapeRows.length > 0
      ? shapeRows.reduce((a, d) => a + d.effectiveScore, 0) / shapeRows.length
      : 0;
  const engineOverlapMax = Math.max(0, ...engineRows.map((d) => d.overlapScore));
  const sameEngineDifferentShape =
    args.compareMode === 'pairwise' &&
    engineOverlapMax >= 2 &&
    shapeOverlapMax <= 2;

  return {
    status: 'advisory_real',
    advisoryOnly: true,
    notARealGate: true,
    module: 'freshnessTest',
    promptVersion: FRESHNESS_TEST_PROMPT_VERSION,
    candidateId: args.candidateId,
    candidateCompanionId: args.candidateCompanionId,
    compareMode: args.compareMode,
    compareTargetId: args.compareTargetId,
    dimensions,
    shapeOverlapMax,
    shapeOverlapMean,
    engineOverlapMax,
    sameEngineDifferentShape,
    recommendation: aggregateRecommendation(shapeOverlapMax, args.compareMode),
    summary: parsed.summary,
    modelId: result.modelId,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

export async function runFreshnessTest(args: {
  storyMarkdown: string;
  candidateId: string;
  companionId: string;
  modelId?: string;
  excludeSelfFromCorpus?: boolean;
}): Promise<FreshnessTestReport> {
  const storyBody = extractStoryBodyFromMarkdown(args.storyMarkdown);
  const masked = maskCompanionEngine(storyBody, args.companionId);
  const corpus = loadFreshnessCorpus({
    excludeId: args.excludeSelfFromCorpus ? args.candidateId : undefined,
  });
  return judgeFreshness({
    candidateId: args.candidateId,
    candidateCompanionId: args.companionId,
    candidateBody: storyBody,
    candidateMasked: masked,
    corpus,
    compareMode: 'corpus',
    modelId: args.modelId,
  });
}

export async function runFreshnessPairwiseTest(args: {
  storyMarkdownA: string;
  idA: string;
  companionIdA: string;
  storyMarkdownB: string;
  idB: string;
  companionIdB: string;
  modelId?: string;
}): Promise<FreshnessTestReport> {
  const bodyA = extractStoryBodyFromMarkdown(args.storyMarkdownA);
  const maskedA = maskCompanionEngine(bodyA, args.companionIdA);
  const entryB: FreshnessCorpusEntry = {
    id: args.idB,
    label: args.idB,
    companionId: args.companionIdB,
    direction: 'adventure',
    source: 'canary',
    filePath: '',
    storyMarkdown: args.storyMarkdownB,
    storyBody: extractStoryBodyFromMarkdown(args.storyMarkdownB),
    shapeMaskedBody: maskCompanionEngine(
      extractStoryBodyFromMarkdown(args.storyMarkdownB),
      args.companionIdB
    ),
  };
  return judgeFreshness({
    candidateId: args.idA,
    candidateCompanionId: args.companionIdA,
    candidateBody: bodyA,
    candidateMasked: maskedA,
    corpus: [entryB],
    compareMode: 'pairwise',
    compareTargetId: args.idB,
    modelId: args.modelId,
  });
}

export async function runFreshnessSelfTest(args: {
  storyMarkdown: string;
  candidateId: string;
  companionId: string;
  modelId?: string;
}): Promise<FreshnessTestReport> {
  const storyBody = extractStoryBodyFromMarkdown(args.storyMarkdown);
  const masked = maskCompanionEngine(storyBody, args.companionId);
  const selfEntry: FreshnessCorpusEntry = {
    id: args.candidateId,
    label: args.candidateId,
    companionId: args.companionId,
    direction: 'adventure',
    source: 'generated',
    filePath: '',
    storyMarkdown: args.storyMarkdown,
    storyBody,
    shapeMaskedBody: masked,
  };
  const report = await judgeFreshness({
    candidateId: args.candidateId,
    candidateCompanionId: args.companionId,
    candidateBody: storyBody,
    candidateMasked: masked,
    corpus: [selfEntry],
    compareMode: 'self',
    compareTargetId: args.candidateId,
    modelId: args.modelId,
  });
  return report;
}

export { engineChannelIds, shapeChannelIds };
