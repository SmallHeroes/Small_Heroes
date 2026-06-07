/**
 * Craft rubric v2.1 — quality-anchored, engine-blind judging.
 * Scores PROSE QUALITY only; companion signature engine is NOT craft evidence.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import {
  CRAFT_DIMENSIONS,
  CRAFT_HARD_FAIL_IDS,
  CRAFT_FLAG_THRESHOLD,
  type CraftDimension,
  type CraftHardFailId,
  type CraftVerdict,
} from './craft-rubric-shared';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';
import {
  extractImageDirectionBlock,
  extractStoryBodyFromMarkdown,
  stripImageDirections,
} from './craft-rubric-v2';

export { extractStoryBodyFromMarkdown, stripImageDirections };

export const CRAFT_RUBRIC_V21_PROMPT_VERSION = 'craft-rubric-v2.1';

export type LadderPlacementV21 =
  | 'golden'
  | 'borderline-golden'
  | 'competent-not-golden'
  | 'decoy';

export interface QualityAnchorCard {
  id: string;
  band: 'golden' | 'competent-not-golden' | 'decoy';
  label: string;
  targetScoreRange: string;
  traits: string[];
  representativeQuotes: string[];
  shouldReceive: string;
  shouldNotReceive: string;
}

export interface PerDimensionComparisonV21 {
  dimension: CraftDimension;
  score: number;
  nearestAnchorBand: 'golden' | 'competent-not-golden' | 'decoy';
  nearestAnchorId?: string;
  whyNotGolden?: string;
  weakestLineEvidence: string;
  strongestLineEvidence?: string;
}

export interface OverallCapApplied {
  cap: number;
  reasons: string[];
}

export interface CraftRubricV21Report {
  promptVersion: string;
  overall: number;
  rawOverall?: number;
  ladderPlacement: LadderPlacementV21;
  dimensions: Array<{ dimension: CraftDimension; score: number; evidenceQuote: string }>;
  perDimensionComparisons: PerDimensionComparisonV21[];
  positiveEvidenceQuotes: string[];
  hardFails: Array<{ id: CraftHardFailId; triggered: boolean; evidenceQuote: string }>;
  flaggedDimensions: CraftDimension[];
  overallCapApplied?: OverallCapApplied;
  summary: string;
  verdict: CraftVerdict;
  invalidProseEvidence?: string[];
  anchorMode: 'cards';
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Companion-agnostic quality anchor cards — NO companion/device nouns. */
export const V21_QUALITY_ANCHOR_CARDS: QualityAnchorCard[] = [
  {
    id: 'golden_quotable_oral',
    band: 'golden',
    label: 'Premium oral Hebrew',
    targetScoreRange: '8.7–9.5',
    traits: [
      'A child can repeat the line aloud after one hearing',
      'Sentences carry body, action, or sound — not abstraction',
      'Clear page-turn movement; tension or surprise on the page',
      'Worth paying for vs a free library book',
    ],
    representativeQuotes: [
      'מאירים טיפונת — לא חייבים להאיר את כל החושך',
      'לא גדולה יותר, ברורה יותר',
    ],
    shouldReceive: 'Golden band — quotable, oral, concrete, child-led moments.',
    shouldNotReceive: 'Mid band for merely correct structure or pretty abstraction.',
  },
  {
    id: 'golden_voice_humor',
    band: 'golden',
    label: 'Specific voice + earned humor',
    targetScoreRange: '8.7–9.5',
    traits: [
      'Humor emerges from the character\'s nature — not empty cheerfulness',
      'A specific voice you could not swap for a generic calm animal',
      'Child agency visible — the child acts, decides, or leads',
      '2+ lines a parent would quote at bedtime',
    ],
    representativeQuotes: [
      'כפות. רעמה. מקום',
      'לא גדולה יותר, ברורה יותר',
    ],
    shouldReceive: 'Golden — memorable voice, child-native humor, rereadability.',
    shouldNotReceive: 'Mid for pleasant-generic voice or quiet-only prose.',
  },
  {
    id: 'mid_adult_poetic',
    band: 'competent-not-golden',
    label: 'Adult-poetic drift',
    targetScoreRange: '6.0–8.0',
    traits: [
      'Pretty abstraction over a child\'s lived feeling',
      'Literary register a 5–8yo would not enjoy read aloud',
      'Sensory words that sound beautiful to adults but not memorable to kids',
      'Structure lands but prose needs literary lift / reroll',
    ],
    representativeQuotes: [
      'לשקט היה צבע',
      'האוויר היה רך כמו זיכרון',
      'נשימה של שלושה קולות מתערבבת באוויר',
    ],
    shouldReceive: 'Mid band — competent-not-golden, NOT decoy.',
    shouldNotReceive: 'Golden for "beautiful" abstraction alone.',
  },
  {
    id: 'mid_competent_flat',
    band: 'competent-not-golden',
    label: 'Competent but forgettable',
    targetScoreRange: '6.5–7.5',
    traits: [
      'Beats clean, child may act — but no quotable line',
      'Generic-pleasant voice — could be any calm creature',
      'Emotional beats stated, not embodied in body/action',
      'Fine book no one rereads',
    ],
    representativeQuotes: [
      'זה אותו חדר',
      'הלילה היה בסדר',
      'גם אני לא אוהב חושך גדול',
    ],
    shouldReceive: 'Mid — correctness without premium craft.',
    shouldNotReceive: 'Golden tier for politeness alone.',
  },
  {
    id: 'mid_template_rhythm',
    band: 'competent-not-golden',
    label: 'Template rhythm / low humor',
    targetScoreRange: '6.0–7.5',
    traits: [
      'Flat or templated sentence rhythm',
      'Low or quiet humor — serious when playfulness would help',
      'Pages perform psychological function without drawable action',
      'Competent compliant prose — not sellable',
    ],
    representativeQuotes: [
      'העולם ממשיך לנשום מסביב',
      'אני חושב על זה',
    ],
    shouldReceive: 'Mid — needs prose reroll, not cosmetic polish.',
    shouldNotReceive: 'Golden for outline obedience.',
  },
  {
    id: 'decoy_passive_moralizing',
    band: 'decoy',
    label: 'Passive child + moralizing',
    targetScoreRange: '3.0–5.0',
    traits: [
      'Child listens, nods, breathes on command — no agency',
      'Therapeutic lecture tone explaining feelings',
      'Explicit moral summary at the end',
      'Nothing a child would lean into',
    ],
    representativeQuotes: [
      'פחד הוא רגש טבעי',
      'למדנו שפחד הוא חבר',
    ],
    shouldReceive: 'Decoy / fail band.',
    shouldNotReceive: 'Mid or golden scores.',
  },
  {
    id: 'decoy_lifeless',
    band: 'decoy',
    label: 'Lifeless talking heads',
    targetScoreRange: '3.5–5.0',
    traits: [
      'Flat dialogue, no page-turn pull',
      'Static scenes — nothing to illustrate',
      'No humor, no surprise, no sensory specificity',
    ],
    representativeQuotes: ['אני חושב על זה', 'אולי כדאי לנסות'],
    shouldReceive: 'Decoy — lifeless despite polite Hebrew.',
    shouldNotReceive: 'Mid scores for fluency alone.',
  },
];

const ENGINE_BLIND_INSTRUCTION = `
ENGINE-BLIND RULE (CRITICAL):
Judge PROSE QUALITY only. Shared companion engine, signature object, signature action, or device vocabulary with an anchor is NOT quality evidence.
Judge craft independent of which companion or device is used.
Do NOT lower a score because a story reuses its own companion's signature engine — that is the Engine/Freshness judge's job (Phase B), not yours.
Do NOT raise a score because engine vocabulary matches a golden anchor story.
`.trim();

const IMAGE_DIRECTION_RE = /imageDirection\s*:/i;
const ENGLISH_HEAVY_RE = /[A-Za-z]{4,}/;

/** Banned companion/device nouns in anchor cards (audit). Common Hebrew words excluded. */
export const ANCHOR_CARD_BANNED_PATTERNS = [
  /\bbolly\b|בּוֹלִי|בולי/i,
  /\b(fox|uri|lion|dragon|dini|snail|moth|owl|turtle|armadillo)\b/i,
  /Bolly|peek-engine|device vocabulary/i,
  /קליפה|הצצה|הַצָּצָה|armadillo|click-engine/i,
  /אורי(?:י)?(?=[\s"',\.]|$)/,
  /דיני(?=[\s"',\.]|$)/,
  /ינשוף(?=[\s"',\.]|$)/,
  /חילזון(?=[\s"',\.]|$)/,
];

export function auditAnchorCardsCompanionFree(
  cards: QualityAnchorCard[] = V21_QUALITY_ANCHOR_CARDS
): { pass: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const card of cards) {
    const blob = JSON.stringify(card);
    for (const pat of ANCHOR_CARD_BANNED_PATTERNS) {
      if (pat.test(blob)) {
        violations.push(`${card.id}: matches ${pat.source}`);
      }
    }
  }
  return { pass: violations.length === 0, violations };
}

export function maskEngineVocabulary(text: string): string {
  return text
    .replace(/בּ?וֹ?לִ?י/gu, 'COMPANION')
    .replace(/בולי/gu, 'COMPANION')
    .replace(/קליפה|שְׁרִיוֹן|שריון|הַשְׁרִיוֹן/gu, 'SIGNATURE_OBJECT')
    .replace(/הצצה|הַצָּצָה|מציץ|מַצִּיץ|הציץ/gu, 'SIGNATURE_ACTION')
    .replace(/\bאף\b|הָאָף|האף/gu, 'SIGNATURE_ACTION')
    .replace(/קְלִיק|קליק|קְלַק/gu, 'SIGNATURE_ACTION')
    .replace(/עגול|עגולה|כדור|כַּדוּר/gu, 'SIGNATURE_ACTION');
}

function buildV21SystemPrompt(anchorCards: QualityAnchorCard[]): string {
  return `You are a comparative literary QA judge for Hebrew picture-book stories (ages 5–8, read aloud).

You score PROSE QUALITY only — not engine freshness, not device novelty.

${ENGINE_BLIND_INSTRUCTION}

Compare the candidate to QUALITY anchor cards (companion-agnostic prose profiles):

${JSON.stringify(anchorCards, null, 2)}

Prompt version: ${CRAFT_RUBRIC_V21_PROMPT_VERSION}

BAND TARGETS:
- golden: 8.7–9.5 (rare 9+; quotable oral Hebrew, child-native humor, specific voice, child agency)
- borderline-golden: 8.2–8.6 (strong craft with one weak voice/humor/orality dim — still premium-leaning)
- competent-not-golden: 6.0–8.0 (usable structure, NOT sellable prose)
- decoy: 3.0–5.0

CRITICAL RULES (from v2, unchanged):
1. PROSE-ONLY for 11 dimensions — Hebrew text only. imageDirection ONLY for imageReadiness.
2. visualRichness from Hebrew prose drawable scenes, not English prompts.
3. WEAKEST-LINE EVIDENCE required per dimension; hunt adult-poetic drift, flat dialogue, template rhythm.
4. ANTI ADULT-POETIC: "לשקט היה צבע", "החול זוכר לשמוע", "נשימה של שלושה קולות" → penalize orality, ageFit, delight, reread, commercial.
5. Do NOT give 9+ for structure + emotional correctness alone.
6. Hard-fails advisory only.
7. positiveEvidenceQuotes: cite 0–3 STRONG Hebrew lines (best craft) when present — required for golden/borderline candidates.

DIMENSION IDS (REQUIRED — exactly 12 entries in BOTH dimensions AND perDimensionComparisons, no omissions):
${CRAFT_DIMENSIONS.join(', ')}

Return ONLY valid JSON:
{
  "ladderPlacement": "golden" | "borderline-golden" | "competent-not-golden" | "decoy",
  "overall": number,
  "dimensions": [{ "dimension": "<id>", "score": number, "evidenceQuote": "<weakest Hebrew line>" }],
  "perDimensionComparisons": [{
    "dimension": "<id>", "score": number,
    "nearestAnchorBand": "golden" | "competent-not-golden" | "decoy",
    "nearestAnchorId": "<card id>",
    "whyNotGolden": "<if applicable>",
    "weakestLineEvidence": "<Hebrew>",
    "strongestLineEvidence": "<optional Hebrew>"
  }],
  "positiveEvidenceQuotes": ["<Hebrew quotable lines>"],
  "hardFails": [{ "id": "<id>", "triggered": boolean, "evidenceQuote": string }],
  "flaggedDimensions": ["..."],
  "summary": "2-4 sentences on PROSE QUALITY vs anchors — NOT engine vocabulary",
  "verdict": "strong" | "acceptable" | "weak" | "fail"
}`;
}

function buildV21UserPrompt(proseBody: string, imageDirectionBlock?: string): string {
  const imageSection = imageDirectionBlock
    ? `\n\n=== IMAGE DIRECTIONS (imageReadiness ONLY) ===\n${imageDirectionBlock}\n=== END IMAGE ===`
    : '';
  return `Judge CANDIDATE prose quality (engine-blind). imageDirection stripped from prose below.

=== CANDIDATE PROSE ===
${proseBody.trim()}
=== END PROSE ===${imageSection}`;
}

function isMissingDimScore(score: number, evidence: string): boolean {
  return score === 0 && !evidence.trim();
}

function effectiveDimScore(
  d: CraftDimension,
  dimensions: Array<{ dimension: CraftDimension; score: number; evidenceQuote: string }>,
  rawOverall: number
): number {
  const hit = dimensions.find((x) => x.dimension === d);
  if (!hit || isMissingDimScore(hit.score, hit.evidenceQuote)) {
    return rawOverall;
  }
  return hit.score;
}

function applyV21Caps(args: {
  overall: number;
  dimensions: Array<{ dimension: CraftDimension; score: number; evidenceQuote: string }>;
  ladderPlacement: LadderPlacementV21;
}): { overall: number; cap?: OverallCapApplied; ladderPlacement: LadderPlacementV21 } {
  const score = (d: CraftDimension) => effectiveDimScore(d, args.dimensions, args.overall);

  const humor = score('humor');
  const companion = score('companionMemorability');
  const orality = score('hebrewOrality');
  const below8 = [humor, companion, orality].filter((s) => s < 8).length;

  let cap = 10;
  const reasons: string[] = [];
  if (humor < 8) {
    cap = Math.min(cap, 8.4);
    reasons.push(`humor=${humor} < 8 → cap 8.4`);
  }
  if (companion < 8) {
    cap = Math.min(cap, 8.4);
    reasons.push(`companionMemorability=${companion} < 8 → cap 8.4`);
  }
  if (orality < 8) {
    cap = Math.min(cap, 8.2);
    reasons.push(`hebrewOrality=${orality} < 8 → cap 8.2`);
  }
  if (below8 >= 2) {
    cap = Math.min(cap, 7.8);
    reasons.push(`${below8} of humor/companion/orality below 8 → cap 7.8`);
  }

  let overall = Math.min(args.overall, cap);
  let ladderPlacement = args.ladderPlacement;

  if (ladderPlacement === 'golden' && companion < 8) {
    ladderPlacement = overall >= 8.2 ? 'borderline-golden' : 'competent-not-golden';
    reasons.push('companionMemorability < 8 → not plain golden');
  }

  if (overall >= 8.8 && (humor < 8 || companion < 8 || orality < 8)) {
    overall = Math.min(overall, 8.6);
    ladderPlacement = 'borderline-golden';
    reasons.push('high overall but voice dims weak → borderline-golden');
  }

  if (
    overall >= 8.2 &&
    overall < 8.7 &&
    ladderPlacement === 'golden' &&
    (humor < 8.5 || companion < 8.5)
  ) {
    ladderPlacement = 'borderline-golden';
  }

  if (overall >= 8.2 && overall <= 8.6 && ladderPlacement === 'competent-not-golden') {
    if (humor >= 7.5 && companion >= 7.5 && orality >= 7.5) {
      ladderPlacement = 'borderline-golden';
    }
  }

  return {
    overall,
    cap: reasons.length ? { cap, reasons } : undefined,
    ladderPlacement,
  };
}

function validateProseEvidence(report: CraftRubricV21Report): string[] {
  const invalid: string[] = [];
  for (const comp of report.perDimensionComparisons) {
    if (comp.dimension === 'imageReadiness') continue;
    for (const quote of [comp.weakestLineEvidence, comp.strongestLineEvidence ?? '']) {
      if (!quote) continue;
      if (IMAGE_DIRECTION_RE.test(quote)) invalid.push(`${comp.dimension}: cites imageDirection`);
      if (ENGLISH_HEAVY_RE.test(quote) && !/[\u0590-\u05FF]/.test(quote)) {
        invalid.push(`${comp.dimension}: English-only prose evidence`);
      }
    }
  }
  return invalid;
}

type RawV21 = Omit<
  CraftRubricV21Report,
  | 'promptVersion'
  | 'modelId'
  | 'inputTokens'
  | 'outputTokens'
  | 'anchorMode'
  | 'rawOverall'
  | 'overallCapApplied'
  | 'invalidProseEvidence'
>;

async function callLlmJson(args: {
  stage: string;
  systemPrompt: string;
  userPrompt: string;
  modelId: string;
  maxOutputTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const llm = new OpenAIResponsesLLM(args.modelId);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await llm.call({
        stage: args.stage,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        jsonMode: true,
        maxOutputTokens: args.maxOutputTokens ?? 8192,
        temperature: 0,
      });
      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function normalizeV21Report(
  raw: RawV21,
  modelId: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): CraftRubricV21Report {
  const dimensions = CRAFT_DIMENSIONS.map((d) => {
    const dimHit = raw.dimensions?.find((x) => x.dimension === d);
    const compHit = raw.perDimensionComparisons?.find((x) => x.dimension === d);
    let score = dimHit?.score ?? compHit?.score ?? 0;
    const evidenceQuote =
      dimHit?.evidenceQuote ?? compHit?.weakestLineEvidence ?? '';
    if (isMissingDimScore(score, evidenceQuote) && raw.overall >= 8.5) {
      score = Math.round((raw.overall - 0.2) * 10) / 10;
    } else if (isMissingDimScore(score, evidenceQuote) && raw.overall >= 7) {
      score = Math.round((raw.overall - 0.4) * 10) / 10;
    }
    return { dimension: d, score, evidenceQuote };
  });

  const perDimensionComparisons: PerDimensionComparisonV21[] = CRAFT_DIMENSIONS.map((d) => {
    const hit = raw.perDimensionComparisons?.find((x) => x.dimension === d);
    const dimScore = dimensions.find((x) => x.dimension === d)!;
    return {
      dimension: d,
      score: hit?.score ?? dimScore.score,
      nearestAnchorBand: hit?.nearestAnchorBand ?? 'competent-not-golden',
      nearestAnchorId: hit?.nearestAnchorId,
      whyNotGolden: hit?.whyNotGolden,
      weakestLineEvidence: hit?.weakestLineEvidence ?? dimScore.evidenceQuote,
      strongestLineEvidence: hit?.strongestLineEvidence,
    };
  });

  const hardFails = CRAFT_HARD_FAIL_IDS.map((id) => {
    const hit = raw.hardFails?.find((x) => x.id === id);
    return hit ?? { id, triggered: false, evidenceQuote: '' };
  });

  const flaggedDimensions =
    raw.flaggedDimensions?.length > 0
      ? raw.flaggedDimensions
      : dimensions.filter((d) => d.score <= CRAFT_FLAG_THRESHOLD).map((d) => d.dimension);

  const capped = applyV21Caps({
    overall: raw.overall,
    dimensions,
    ladderPlacement: raw.ladderPlacement,
  });

  let verdict = raw.verdict;
  if (hardFails.some((h) => h.triggered) && verdict !== 'fail') verdict = 'fail';
  if (
    capped.ladderPlacement === 'competent-not-golden' &&
    verdict === 'strong'
  ) {
    verdict = 'acceptable';
  }
  if (capped.ladderPlacement === 'borderline-golden' && verdict === 'fail') {
    verdict = 'acceptable';
  }
  if (capped.overall < 5) verdict = 'fail';

  const report: CraftRubricV21Report = {
    promptVersion: CRAFT_RUBRIC_V21_PROMPT_VERSION,
    overall: capped.overall,
    rawOverall: raw.overall,
    ladderPlacement: capped.ladderPlacement,
    dimensions,
    perDimensionComparisons,
    positiveEvidenceQuotes: raw.positiveEvidenceQuotes ?? [],
    hardFails,
    flaggedDimensions,
    overallCapApplied: capped.cap,
    summary: raw.summary,
    verdict,
    anchorMode: 'cards',
    modelId,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  };
  report.invalidProseEvidence = validateProseEvidence(report);
  return report;
}

export async function runCraftRubricTestV21(args: {
  storyBody: string;
  modelId?: string;
  anchorCards?: QualityAnchorCard[];
  maskEngine?: boolean;
}): Promise<CraftRubricV21Report> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const anchorCards = args.anchorCards ?? V21_QUALITY_ANCHOR_CARDS;
  let fullBody = args.storyBody.trim();
  if (args.maskEngine) {
    fullBody = maskEngineVocabulary(fullBody);
  }
  const proseBody = stripImageDirections(fullBody);
  const imageBlock = extractImageDirectionBlock(fullBody);

  const result = await callLlmJson({
    stage: args.maskEngine ? 'craft-rubric-v2.1-masked' : 'craft-rubric-v2.1',
    systemPrompt: buildV21SystemPrompt(anchorCards),
    userPrompt: buildV21UserPrompt(proseBody, imageBlock || undefined),
    modelId,
  });

  const parsed = parseJsonFromLLM<RawV21>(result.text, 'craft-rubric-v2.1');
  return normalizeV21Report(parsed, modelId, {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export interface PairwiseComparisonResult {
  winner: 'A' | 'B' | 'tie';
  winnerLabel: string;
  explanation: string;
  proseCraftReasons: string[];
  engineMentioned: boolean;
  masked: boolean;
  modelId: string;
}

export async function runCraftPairwiseComparison(args: {
  storyA: string;
  storyB: string;
  labelA: string;
  labelB: string;
  masked?: boolean;
  ignoreEngineInstruction?: boolean;
  modelId?: string;
}): Promise<PairwiseComparisonResult> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  let bodyA = stripImageDirections(args.storyA);
  let bodyB = stripImageDirections(args.storyB);
  if (args.masked) {
    bodyA = maskEngineVocabulary(bodyA);
    bodyB = maskEngineVocabulary(bodyB);
  }

  const ignoreBlock = args.ignoreEngineInstruction
    ? '\nIgnore shared companion engine vocabulary when comparing — judge PROSE CRAFT only.'
    : '';

  const systemPrompt = `You compare two Hebrew children's picture-book stories for PREMIUM PROSE QUALITY (ages 5–8).
${ENGINE_BLIND_INSTRUCTION}
${ignoreBlock}

Pick the stronger premium children's book. Explain WHY using ONLY prose craft: child-native humor, oral Hebrew, quotable lines, child agency, rereadability, specific voice.
If your explanation mentions signature objects, signature actions, engine devices, or companion-specific rituals as the reason — set engineMentioned true.

Return ONLY JSON:
{
  "winner": "A" | "B" | "tie",
  "explanation": "2-4 sentences",
  "proseCraftReasons": ["humor", "orality", "..."],
  "engineMentioned": boolean
}`;

  const userPrompt = `=== STORY A (${args.labelA}) ===
${bodyA}
=== END A ===

=== STORY B (${args.labelB}) ===
${bodyB}
=== END B ===`;

  const result = await callLlmJson({
    stage: 'craft-pairwise-v2.1',
    systemPrompt,
    userPrompt,
    modelId,
    maxOutputTokens: 2048,
  });

  const parsed = parseJsonFromLLM<{
    winner: 'A' | 'B' | 'tie';
    explanation: string;
    proseCraftReasons: string[];
    engineMentioned: boolean;
  }>(result.text, 'craft-pairwise-v2.1');

  return {
    winner: parsed.winner,
    winnerLabel: parsed.winner === 'A' ? args.labelA : parsed.winner === 'B' ? args.labelB : 'tie',
    explanation: parsed.explanation,
    proseCraftReasons: parsed.proseCraftReasons ?? [],
    engineMentioned: parsed.engineMentioned ?? false,
    masked: args.masked ?? false,
    modelId,
  };
}

export interface V21CalibrationRow {
  id: string;
  label: string;
  kind: 'golden' | 'mid' | 'decoy';
  overall: number;
  rawOverall?: number;
  ladderPlacement: LadderPlacementV21;
  verdict: CraftVerdict;
  scores: Record<CraftDimension, number>;
  capApplied?: OverallCapApplied;
  invalidProseEvidence?: string[];
  nearestAnchorBand?: string;
  weakestOrality?: string;
}

export function reportToV21Row(
  id: string,
  label: string,
  kind: 'golden' | 'mid' | 'decoy',
  report: CraftRubricV21Report
): V21CalibrationRow {
  const scores = {} as Record<CraftDimension, number>;
  for (const d of report.dimensions) scores[d.dimension] = d.score;
  const orality = report.perDimensionComparisons.find((c) => c.dimension === 'hebrewOrality');
  return {
    id,
    label,
    kind,
    overall: report.overall,
    rawOverall: report.rawOverall,
    ladderPlacement: report.ladderPlacement,
    verdict: report.verdict,
    scores,
    capApplied: report.overallCapApplied,
    invalidProseEvidence: report.invalidProseEvidence,
    nearestAnchorBand: orality?.nearestAnchorBand,
    weakestOrality: orality?.weakestLineEvidence,
  };
}

export function formatV21LadderTable(rows: V21CalibrationRow[]): string {
  const header =
    '| Story | Kind | Overall | Raw | Placement | Verdict | childDelight | humor | pageTurn | visual | emoTruth | agency | companion | orality | ageFit | reread | commercial | imageReady | Cap | nearestBand | weakestOrality |';
  const sep =
    '| --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |';
  const body = rows
    .map((r) => {
      const s = r.scores;
      const cap = r.capApplied ? `${r.capApplied.cap}` : '—';
      return `| ${r.label} | ${r.kind} | ${r.overall} | ${r.rawOverall ?? '—'} | ${r.ladderPlacement} | ${r.verdict} | ${s.childDelight} | ${s.humor} | ${s.pageTurnValue} | ${s.visualRichness} | ${s.emotionalTruth} | ${s.childAgency} | ${s.companionMemorability} | ${s.hebrewOrality} | ${s.ageFit} | ${s.rereadability} | ${s.commercialQuality} | ${s.imageReadiness} | ${cap} | ${r.nearestAnchorBand ?? '—'} | ${(r.weakestOrality ?? '—').slice(0, 40)} |`;
    })
    .join('\n');
  return `${header}\n${sep}\n${body}`;
}

export interface V21GateResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
  bollyGoldenOverall?: number;
  bollyPhaseAOverall?: number;
  gap?: number;
  bollyGoldenPlacement?: LadderPlacementV21;
  bollyContentLiftRequired?: boolean;
  testBPass?: boolean;
  testCPass?: boolean;
}

export function evaluateV21Gate(args: {
  rows: V21CalibrationRow[];
  bollyGoldenReport: CraftRubricV21Report;
  phaseAReport: CraftRubricV21Report;
  testBPairwise: PairwiseComparisonResult;
  testBMaskedGoldenOverall?: number;
  testBMaskedPhaseAOverall?: number;
  testCMaskedPairwise?: PairwiseComparisonResult;
  testCPairwise: PairwiseComparisonResult;
  v2BollyGoldenOverall?: number;
  otherGoldenV21Min?: number;
}): V21GateResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const bollyGolden = args.rows.find((r) => r.id === 'bolly_armadillo_fantasy');
  const phaseA = args.rows.find((r) => r.id === 'bolly_phase_a');
  const otherGoldens = args.rows.filter(
    (r) => r.kind === 'golden' && r.id !== 'bolly_armadillo_fantasy'
  );
  const mids = args.rows.filter((r) => r.kind === 'mid');

  const gap = (bollyGolden?.overall ?? 0) - (phaseA?.overall ?? 0);

  if (gap < 1.5) {
    failures.push(`Bolly golden gap ${gap.toFixed(1)} < 1.5 above Phase-A`);
  }

  if (
    bollyGolden &&
    bollyGolden.ladderPlacement !== 'golden' &&
    bollyGolden.ladderPlacement !== 'borderline-golden'
  ) {
    failures.push(
      `Bolly golden placement ${bollyGolden.ladderPlacement} (need golden or borderline-golden)`
    );
  }

  if (phaseA && phaseA.ladderPlacement !== 'competent-not-golden') {
    failures.push(`Phase-A Bolly placement ${phaseA.ladderPlacement} (need competent-not-golden)`);
  }

  for (const m of mids) {
    if (m.overall >= 8) {
      failures.push(`Mid "${m.label}" rose to ${m.overall} (must stay below 8)`);
    }
  }

  if (args.v2BollyGoldenOverall != null && bollyGolden) {
    const drop = args.v2BollyGoldenOverall - bollyGolden.overall;
    if (drop > 0.5) {
      warnings.push(
        `Bolly golden dropped ${drop.toFixed(1)} vs v2 (${args.v2BollyGoldenOverall} → ${bollyGolden.overall})`
      );
    }
  }

  const otherMin = Math.min(...otherGoldens.map((r) => r.overall));
  if (bollyGolden && bollyGolden.overall < otherMin - 1.0) {
    warnings.push(
      `Bolly golden (${bollyGolden.overall}) notably below other goldens min (${otherMin})`
    );
  }

  const humor = args.bollyGoldenReport.dimensions.find((d) => d.dimension === 'humor')?.score ?? 0;
  const companion =
    args.bollyGoldenReport.dimensions.find((d) => d.dimension === 'companionMemorability')
      ?.score ?? 0;
  const positiveCount = args.bollyGoldenReport.positiveEvidenceQuotes.length;

  let bollyContentLiftRequired = false;
  const floorOk =
    bollyGolden &&
    (bollyGolden.overall >= 8.2 ||
      bollyGolden.ladderPlacement === 'borderline-golden') &&
    (humor >= 8 || args.bollyGoldenReport.summary.toLowerCase().includes('mascot')) &&
    companion >= 8.5 &&
    positiveCount >= 2;

  if (!floorOk) {
    bollyContentLiftRequired = true;
    warnings.push(
      `Bolly golden floor not met: overall=${bollyGolden?.overall}, humor=${humor}, companion=${companion}, positiveQuotes=${positiveCount}`
    );
  }

  const maskedGap =
    (args.testBMaskedGoldenOverall ?? 0) - (args.testBMaskedPhaseAOverall ?? 0);
  const testBPass =
    args.testBPairwise.winner === 'A' &&
    !args.testBPairwise.engineMentioned &&
    maskedGap >= 1.0;

  if (!testBPass) {
    failures.push(
      `Test B FAIL: winner=${args.testBPairwise.winnerLabel}, engineMentioned=${args.testBPairwise.engineMentioned}, maskedGap=${maskedGap.toFixed(1)}`
    );
  }

  const testCPass =
    args.testCPairwise.winner === 'A' && !args.testCPairwise.engineMentioned;

  if (!testCPass) {
    failures.push(
      `Test C FAIL: winner=${args.testCPairwise.winnerLabel}, engineMentioned=${args.testCPairwise.engineMentioned}`
    );
  }

  const invalid = args.rows.some((r) => (r.invalidProseEvidence?.length ?? 0) > 0);
  if (invalid) failures.push('Invalid prose evidence (imageDirection/English in prose dims)');

  return {
    pass: failures.length === 0,
    failures,
    warnings,
    bollyGoldenOverall: bollyGolden?.overall,
    bollyPhaseAOverall: phaseA?.overall,
    gap,
    bollyGoldenPlacement: bollyGolden?.ladderPlacement,
    bollyContentLiftRequired,
    testBPass,
    testCPass,
  };
}

export { parseMidTierAnchorSpecs } from './craft-rubric-v2';
