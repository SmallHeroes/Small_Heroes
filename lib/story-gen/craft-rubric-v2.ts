/**
 * Craft rubric v2 — comparative / anchored judging.
 * Scores candidates relative to a calibration ladder (golden / mid / decoy).
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

export const CRAFT_RUBRIC_V2_PROMPT_VERSION = 'craft-rubric-v2';

export type LadderBand = 'golden' | 'competent-not-golden' | 'decoy';

export interface AnchorCard {
  id: string;
  band: LadderBand;
  label: string;
  targetScoreRange: string;
  traits: string[];
  representativeQuotes: string[];
  shouldReceive: string;
  shouldNotReceive: string;
  softFailMode?: string;
}

export interface PerDimensionComparison {
  dimension: CraftDimension;
  score: number;
  nearestAnchorBand: LadderBand;
  nearestAnchorId?: string;
  whyNotGolden?: string;
  weakestLineEvidence: string;
  strongestLineEvidence?: string;
}

export interface OverallCapApplied {
  cap: number;
  reasons: string[];
}

export interface CraftRubricV2Report {
  promptVersion: string;
  overall: number;
  rawOverall?: number;
  ladderPlacement: LadderBand;
  dimensions: Array<{
    dimension: CraftDimension;
    score: number;
    evidenceQuote: string;
  }>;
  perDimensionComparisons: PerDimensionComparison[];
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

/** Compact ladder reference — preferred for all v2 judge calls (not full anchor bodies). */
export const V2_ANCHOR_CARDS: AnchorCard[] = [
  {
    id: 'golden_fox_uri_bedtime',
    band: 'golden',
    label: 'Fox Uri bedtime',
    targetScoreRange: '8.7–9.5',
    traits: [
      'Child-native night-check voice',
      'Lantern-as-body-comedy',
      'Concrete scary→checkable turns',
      'Quotable lines parents repeat',
    ],
    representativeQuotes: [
      'מאירים טיפונת — לא חייבים להאיר את כל החושך',
      'הפנס מתכווץ כמו גחלילית ביישנית',
    ],
    shouldReceive: 'Premium oral Hebrew, specific companion engine, memorable images, child leads.',
    shouldNotReceive: 'Generic mentor tone, abstract poetry, flat talking heads.',
  },
  {
    id: 'golden_lion_shaket_adventure',
    band: 'golden',
    label: 'Lion Shaket adventure',
    targetScoreRange: '8.7–9.5',
    traits: [
      'Aim-the-roar not suppress',
      'Body ritual (paws, place)',
      'Magical frame + bedroom residue',
      'Anger shown not explained',
    ],
    representativeQuotes: ['כפות. רעמה. מקום', 'לא גדולה יותר, ברורה יותר'],
    shouldReceive: 'Specific companion ritual, page-turn motion, drawable action beats.',
    shouldNotReceive: 'Therapeutic lecture, sanitized emotion, swappable lion.',
  },
  {
    id: 'golden_dragon_dini_fantasy',
    band: 'golden',
    label: 'Dragon Dini fantasy',
    targetScoreRange: '8.7–9.5',
    traits: [
      'Sibling-specific comic engine',
      'Fantasy rule with teeth',
      'Uncomfortable truth on page',
      'Child agency transfer moment',
    ],
    representativeQuotes: ['הדרקון הקטן שלי לא מפחיד — הוא רק…', 'דיני לא מתנצלת'],
    shouldReceive: 'Profile-bound voice, surprise, rereadable lines, emotional mistake shown.',
    shouldNotReceive: 'Generic dragon wisdom, moral summary, passive child.',
  },
  {
    id: 'mid_bolly_phase_a',
    band: 'competent-not-golden',
    label: 'Phase-A Bolly adventure (generated)',
    targetScoreRange: '6.0–8.0',
    softFailMode:
      'Good structure + peek engine; quiet companion voice; adult-poetic drift; low humor; template rhythm.',
    traits: [
      'Outline beats land correctly',
      'Bolly peek sequence present but prose flat',
      'Adult-poetic lines slip in',
      'Broken/template chips in places',
    ],
    representativeQuotes: [
      'החול זוכר לשמוע',
      'קול של חול נושם עמו',
      'נשימה של שלושה קולות מתערבבת באוויר',
    ],
    shouldReceive: 'Competent-not-golden band; credit structure but penalize prose register.',
    shouldNotReceive: 'Golden tier 9+ — structure alone is NOT enough.',
  },
  {
    id: 'mid_fictional_snail',
    band: 'competent-not-golden',
    label: 'Quiet Snail (fictional anchor)',
    targetScoreRange: '6.5–7.5',
    softFailMode: 'Competent-flat; child acts; no hard flaws; forgettable prose; generic calm companion.',
    traits: [
      'Clean beats, child turns on lamp',
      'Pleasant-generic snail voice',
      'No quotable line',
      'Emotional beats stated not embodied',
    ],
    representativeQuotes: ['גם אני לא אוהב חושך גדול', 'זה אותו חדר'],
    shouldReceive: 'Mid band — fine but not sellable; low memorability and rereadability.',
    shouldNotReceive: 'Golden tier — correctness ≠ premium.',
  },
  {
    id: 'mid_fictional_moth',
    band: 'competent-not-golden',
    label: 'Moth and Color of Quiet (fictional anchor)',
    targetScoreRange: '6.5–7.5',
    softFailMode: 'Polished-but-adult-poetic; pretty abstraction; templated peek accumulation; weak child humor.',
    traits: [
      'Literary sensory imagery',
      'Abstract for ages 5–8',
      'Companion could be any gentle creature',
      'Formula rhythm',
    ],
    representativeQuotes: [
      'לשקט היה צבע',
      'האוויר היה רך כמו זיכרון',
      'הגדל הוא רק הרבה קטנות',
    ],
    shouldReceive: 'Mid band for adult-poetic drift — pretty ≠ child-native golden.',
    shouldNotReceive: 'Golden tier for "beautiful" abstraction.',
  },
  {
    id: 'decoy_lecturing_owl',
    band: 'decoy',
    label: 'Lecturing Owl',
    targetScoreRange: '3.0–5.0',
    traits: ['Therapeutic lecture', 'Passive child', 'Moralizing ending', 'Generic wise mentor'],
    representativeQuotes: ['פחד הוא רגש טבעי', 'למדנו שפחד הוא חבר'],
    shouldReceive: 'Decoy/fail band — obvious craft failures.',
    shouldNotReceive: 'Mid or golden scores.',
  },
  {
    id: 'decoy_talking_turtle',
    band: 'decoy',
    label: 'Talking Turtle',
    targetScoreRange: '3.5–5.0',
    traits: ['Flat talking heads', 'No page-turn pull', 'No humor', 'Static scenes'],
    representativeQuotes: ['אני חושב על זה', 'אולי כדאי לנסות'],
    shouldReceive: 'Decoy/fail — lifeless despite agency at end.',
    shouldNotReceive: 'Golden scores for politeness.',
  },
  {
    id: 'decoy_soft_friend',
    band: 'decoy',
    label: 'Soft Friend',
    targetScoreRange: '3.0–5.0',
    traits: ['Generic swappable companion', 'Sanitized fear', 'Adult-poetic + moralizing', 'Abstract fantasy'],
    representativeQuotes: ['זה לא באמת מפחיד', 'האומץ היה תמיד בפנים'],
    shouldReceive: 'Decoy/fail band.',
    shouldNotReceive: 'Mid band — failures are structural not just polish.',
  },
];

const PROSE_DIMENSIONS = CRAFT_DIMENSIONS.filter((d) => d !== 'imageReadiness');

const IMAGE_DIRECTION_RE = /imageDirection\s*:/i;
const ENGLISH_HEAVY_RE = /[A-Za-z]{4,}/;

export function stripImageDirections(storyBody: string): string {
  return storyBody
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('imageDirection:'))
    .join('\n')
    .replace(/\r?\n---\r?\n(?=\r?\n--- Page|\r?\n---\r?\n$)/g, '\n')
    .trim();
}

export function extractStoryBodyFromMarkdown(markdown: string): string {
  const titleMatch = markdown.match(/title:\s*"([^"]+)"/);
  const title = titleMatch?.[1] ?? '';

  const goldenPages: string[] = [];
  const goldenRe =
    /\r?\n--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page \d+ ---|\r?\nWORD_COUNT:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = goldenRe.exec(markdown)) !== null) {
    goldenPages.push(`--- Page ${m[1]} ---\n${(m[2] ?? '').trim()}`);
  }
  if (goldenPages.length > 0) {
    return `${title ? `title: "${title}"\n\n` : ''}${goldenPages.join('\n\n')}`.trim();
  }

  const hashPages: string[] = [];
  const hashRe =
    /\r?\n(?:--- Page (\d+) ---|### Page (\d+))\r?\n([\s\S]*?)(?=\r?\n(?:--- Page \d+ ---|### Page \d+|\r?\nWORD_COUNT:)|$)/g;
  while ((m = hashRe.exec(markdown)) !== null) {
    const pageNum = m[1] ?? m[2];
    hashPages.push(`--- Page ${pageNum} ---\n${(m[3] ?? '').trim()}`);
  }
  if (hashPages.length > 0) {
    return `${title ? `title: "${title}"\n\n` : ''}${hashPages.join('\n\n')}`.trim();
  }

  const hebrewPages: string[] = [];
  const hebrewRe = /עמוד (\d+)\r?\n([\s\S]*?)(?=עמוד \d+|$)/g;
  while ((m = hebrewRe.exec(markdown)) !== null) {
    hebrewPages.push(`--- Page ${m[1]} ---\n${(m[2] ?? '').trim()}`);
  }
  if (hebrewPages.length > 0) {
    return `${title ? `title: "${title}"\n\n` : ''}${hebrewPages.join('\n\n')}`.trim();
  }

  return markdown.trim();
}

function buildV2SystemPrompt(anchorCards: AnchorCard[]): string {
  const cardsJson = JSON.stringify(anchorCards, null, 2);

  return `You are a comparative literary QA judge for Hebrew picture-book stories (ages 5–8, read aloud).

You do NOT score in absolute isolation. Compare the candidate to the CALIBRATION LADDER anchor cards and answer:
"Is this closer to golden, competent-not-golden (mid), or decoy — and why?"

Prompt version: ${CRAFT_RUBRIC_V2_PROMPT_VERSION}

CALIBRATION LADDER (anchor cards — NOT the candidate):
${cardsJson}

BAND TARGETS:
- golden: 8.7–9.5 (rare at 9+; needs memorable voice, child-native humor, quotable lines)
- competent-not-golden: 6.0–8.0 (usable structure, NOT sellable prose — needs literary lift)
- decoy: 3.0–5.0 (hard craft failures)

CRITICAL RULES:
1. PROSE-ONLY for 11 dimensions: candidate Hebrew story text ONLY. NEVER cite English imageDirection for childDelight, humor, pageTurnValue, visualRichness, emotionalTruth, childAgency, companionMemorability, hebrewOrality, ageFit, rereadability, or commercialQuality. imageDirection may be used ONLY for imageReadiness (if provided separately).
2. visualRichness = drawable scenes implied by HEBREW prose, not English prompts.
3. WEAKEST-LINE EVIDENCE: For EVERY dimension in perDimensionComparisons, cite the WEAKEST relevant Hebrew line first (weakestLineEvidence). Optionally add strongestLineEvidence AFTER. Hunt adult-poetic drift, flat dialogue, template rhythm, generic companion voice, pages that only perform psychological function.
4. ANTI ADULT-POETIC: Lines like "החול זוכר לשמוע", "קול של חול נושם עמו", "לשקט היה צבע", "האוויר היה רך כמו זיכרון", "נשימה של שלושה קולות מתערבבת באוויר" are SUSPICIOUS — reduce hebrewOrality, ageFit, childDelight, rereadability, commercialQuality. Test: would a 5–8yo enjoy and remember this read aloud?
5. Do NOT give 9+ for structure + emotional correctness alone. Great structure + merely-good prose ≈ 7, not 9.
6. competent-not-golden = dangerous middle: not trash, not a tiny fix — needs prose reroll.
7. Score 12 dimensions 0–10 comparatively. Golden anchors should score higher than mid anchors; mid higher than decoy.
8. Hard-fails remain advisory (flag only, do not auto-zero overall).

Return ONLY valid JSON:
{
  "ladderPlacement": "golden" | "competent-not-golden" | "decoy",
  "overall": number,
  "dimensions": [{ "dimension": "<id>", "score": number, "evidenceQuote": "<Hebrew weakest line for prose dims>" }],
  "perDimensionComparisons": [{
    "dimension": "<id>",
    "score": number,
    "nearestAnchorBand": "golden" | "competent-not-golden" | "decoy",
    "nearestAnchorId": "<anchor card id>",
    "whyNotGolden": "<if not golden, why>",
    "weakestLineEvidence": "<Hebrew quote — REQUIRED>",
    "strongestLineEvidence": "<optional Hebrew quote>"
  }],
  "hardFails": [{ "id": "<hard-fail id>", "triggered": boolean, "evidenceQuote": string }],
  "flaggedDimensions": ["<dims with score <= ${CRAFT_FLAG_THRESHOLD}>"],
  "summary": "2-4 sentences comparing candidate to nearest band",
  "verdict": "strong" | "acceptable" | "weak" | "fail"
}`;
}

function buildV2UserPrompt(proseBody: string, imageDirectionBlock?: string): string {
  const imageSection = imageDirectionBlock
    ? `\n\n=== IMAGE DIRECTIONS (imageReadiness ONLY) ===\n${imageDirectionBlock.trim()}\n=== END IMAGE ===`
    : '';

  return `Judge this CANDIDATE story. Compare to anchor cards. Hebrew prose below has imageDirection lines removed.

=== CANDIDATE PROSE ===
${proseBody.trim()}
=== END PROSE ===${imageSection}`;
}

function extractImageDirectionBlock(storyBody: string): string {
  const lines = storyBody.split(/\r?\n/);
  const blocks: string[] = [];
  let currentPage = '';
  for (const line of lines) {
    if (line.startsWith('--- Page ')) {
      currentPage = line;
      continue;
    }
    if (line.trim().startsWith('imageDirection:')) {
      blocks.push(`${currentPage}\n${line.trim()}`);
    }
  }
  return blocks.join('\n\n');
}

function applyOverallCaps(args: {
  overall: number;
  dimensions: Array<{ dimension: CraftDimension; score: number }>;
  ladderPlacement: LadderBand;
}): { overall: number; cap?: OverallCapApplied; ladderPlacement: LadderBand } {
  const score = (d: CraftDimension) =>
    args.dimensions.find((x) => x.dimension === d)?.score ?? 10;

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

  if (cap < 10 && overall !== args.overall) {
    // capped
  }

  if (companion < 8 && ladderPlacement === 'golden') {
    ladderPlacement = 'competent-not-golden';
    reasons.push('companionMemorability < 8 → cannot classify golden');
  }

  if (overall >= 8.8 && (humor < 8 || companion < 8 || orality < 8)) {
    overall = Math.min(overall, 8.0);
    ladderPlacement = 'competent-not-golden';
    reasons.push('would reach golden tier but voice/humor/orality caps → mid band');
  }

  const capApplied =
    reasons.length > 0 ? { cap, reasons } : undefined;

  return { overall, cap: capApplied, ladderPlacement };
}

function validateProseEvidence(report: CraftRubricV2Report): string[] {
  const invalid: string[] = [];
  for (const comp of report.perDimensionComparisons) {
    if (comp.dimension === 'imageReadiness') continue;
    const weak = comp.weakestLineEvidence ?? '';
    const ev = report.dimensions.find((d) => d.dimension === comp.dimension)?.evidenceQuote ?? '';
    for (const quote of [weak, ev]) {
      if (!quote) continue;
      if (IMAGE_DIRECTION_RE.test(quote)) {
        invalid.push(`${comp.dimension}: cites imageDirection`);
      }
      if (ENGLISH_HEAVY_RE.test(quote) && !/[\u0590-\u05FF]/.test(quote)) {
        invalid.push(`${comp.dimension}: English-only evidence for prose dim`);
      }
    }
  }
  return invalid;
}

type RawV2 = Omit<
  CraftRubricV2Report,
  'promptVersion' | 'modelId' | 'inputTokens' | 'outputTokens' | 'anchorMode' | 'rawOverall' | 'overallCapApplied' | 'invalidProseEvidence'
> & { overallCapApplied?: OverallCapApplied };

function normalizeV2Report(
  raw: RawV2,
  modelId: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): CraftRubricV2Report {
  const dimensions = CRAFT_DIMENSIONS.map((d) => {
    const hit = raw.dimensions.find((x) => x.dimension === d);
    return {
      dimension: d,
      score: hit?.score ?? 0,
      evidenceQuote: hit?.evidenceQuote ?? '',
    };
  });

  const perDimensionComparisons: PerDimensionComparison[] = CRAFT_DIMENSIONS.map((d) => {
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

  const capped = applyOverallCaps({
    overall: raw.overall,
    dimensions,
    ladderPlacement: raw.ladderPlacement,
  });

  let verdict = raw.verdict;
  if (hardFails.some((h) => h.triggered) && verdict !== 'fail') verdict = 'fail';
  if (capped.ladderPlacement === 'competent-not-golden' && verdict === 'strong') verdict = 'acceptable';
  if (capped.overall < 5) verdict = 'fail';

  const report: CraftRubricV2Report = {
    promptVersion: CRAFT_RUBRIC_V2_PROMPT_VERSION,
    overall: capped.overall,
    rawOverall: raw.overall,
    ladderPlacement: capped.ladderPlacement,
    dimensions,
    perDimensionComparisons,
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

export async function runCraftRubricTestV2(args: {
  storyBody: string;
  modelId?: string;
  anchorCards?: AnchorCard[];
}): Promise<CraftRubricV2Report> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const anchorCards = args.anchorCards ?? V2_ANCHOR_CARDS;
  const fullBody = args.storyBody.trim();
  const proseBody = stripImageDirections(fullBody);
  const imageBlock = extractImageDirectionBlock(fullBody);

  const llm = new OpenAIResponsesLLM(modelId);
  let lastErr: unknown;
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await llm.call({
        stage: 'craft-rubric-v2',
        systemPrompt: buildV2SystemPrompt(anchorCards),
        userPrompt: buildV2UserPrompt(proseBody, imageBlock || undefined),
        jsonMode: true,
        maxOutputTokens: 8192,
        temperature: 0,
      });
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  if (!result) throw lastErr;

  const parsed = parseJsonFromLLM<RawV2>(result.text, 'craft-rubric-v2');
  return normalizeV2Report(parsed, modelId, {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export interface MidTierAnchorSpec {
  id: string;
  label: string;
  storyBody: string;
  expectedSoftFail: string;
}

export function parseMidTierAnchorSpecs(markdown: string): MidTierAnchorSpec[] {
  const sections = markdown.split(/^## Mid-tier anchor #\d+/m).slice(1);
  const specs: MidTierAnchorSpec[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] ?? '';
    const labelMatch = section.match(/^ — "([^"]+)"/);
    const label = labelMatch?.[1] ?? `midtier_${i + 1}`;

    const bodyMatch = section.match(
      /=== STORY BODY[^=]*===\r?\n([\s\S]*?)\r?\n=== END ===/
    );
    if (!bodyMatch?.[1]) continue;

    const softFailMatch = section.match(/\*\*Soft-fail mode:\*\* ([^\n]+)/);
    specs.push({
      id: `midtier_${i + 1}`,
      label,
      storyBody: extractStoryBodyFromMarkdown(bodyMatch[1].trim()),
      expectedSoftFail: softFailMatch?.[1]?.trim() ?? '',
    });
  }

  return specs;
}

export interface V2CalibrationRow {
  id: string;
  label: string;
  kind: 'golden' | 'mid' | 'decoy';
  overall: number;
  rawOverall?: number;
  ladderPlacement: LadderBand;
  verdict: CraftVerdict;
  scores: Record<CraftDimension, number>;
  capApplied?: OverallCapApplied;
  invalidProseEvidence?: string[];
  softFailReason?: string;
}

export function reportToV2CalibrationRow(
  id: string,
  label: string,
  kind: 'golden' | 'mid' | 'decoy',
  report: CraftRubricV2Report,
  extra?: { softFailReason?: string }
): V2CalibrationRow {
  const scores = {} as Record<CraftDimension, number>;
  for (const d of report.dimensions) scores[d.dimension] = d.score;
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
    softFailReason: extra?.softFailReason,
  };
}

export function formatV2LadderTable(rows: V2CalibrationRow[]): string {
  const header =
    '| Story | Kind | Overall | Placement | Verdict | childDelight | humor | pageTurn | visual | emoTruth | agency | companion | orality | ageFit | reread | commercial | imageReady | Cap | Invalid |';
  const sep =
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |';

  const body = rows
    .map((r) => {
      const s = r.scores;
      return `| ${r.label} | ${r.kind} | ${r.overall} | ${r.ladderPlacement} | ${r.verdict} | ${s.childDelight} | ${s.humor} | ${s.pageTurnValue} | ${s.visualRichness} | ${s.emotionalTruth} | ${s.childAgency} | ${s.companionMemorability} | ${s.hebrewOrality} | ${s.ageFit} | ${s.rereadability} | ${s.commercialQuality} | ${s.imageReadiness} | ${r.capApplied ? r.capApplied.cap : '—'} | ${r.invalidProseEvidence?.length ? r.invalidProseEvidence.join('; ') : '—'} |`;
    })
    .join('\n');

  return `${header}\n${sep}\n${body}`;
}

export interface V2CalibrationGate {
  pass: boolean;
  failures: string[];
  goldenMin: number;
  midMax: number;
  decoyMax: number;
  bollyOverall?: number;
  bollyPlacement?: LadderBand;
}

export function evaluateV2CalibrationGate(rows: V2CalibrationRow[]): V2CalibrationGate {
  const golden = rows.filter((r) => r.kind === 'golden');
  const mid = rows.filter((r) => r.kind === 'mid');
  const decoy = rows.filter((r) => r.kind === 'decoy');

  const goldenMin = Math.min(...golden.map((r) => r.overall));
  const goldenMax = Math.max(...golden.map((r) => r.overall));
  const midMax = Math.max(...mid.map((r) => r.overall));
  const midMin = Math.min(...mid.map((r) => r.overall));
  const decoyMax = Math.max(...decoy.map((r) => r.overall));

  const bolly = mid.find((r) => r.id.includes('bolly') || r.label.toLowerCase().includes('bolly'));

  const failures: string[] = [];

  for (const g of golden) {
    for (const m of mid) {
      if (m.overall >= g.overall) {
        failures.push(`Mid "${m.label}" (${m.overall}) >= golden "${g.label}" (${g.overall})`);
      }
    }
  }

  for (const m of mid) {
    for (const d of decoy) {
      if (d.overall >= m.overall) {
        failures.push(`Decoy "${d.label}" (${d.overall}) >= mid "${m.label}" (${m.overall})`);
      }
    }
  }

  for (const m of mid) {
    if (m.overall >= 8.8 || m.ladderPlacement === 'golden') {
      failures.push(`Mid "${m.label}" reached golden band (${m.overall}, placement=${m.ladderPlacement})`);
    }
    if (m.overall < 6.0 || m.overall > 8.0) {
      failures.push(`Mid "${m.label}" outside 6.0–8.0 target (${m.overall})`);
    }
  }

  const invalidEvidence = rows.some((r) => (r.invalidProseEvidence?.length ?? 0) > 0);
  if (invalidEvidence) {
    failures.push('One or more reports cite imageDirection/English for prose dimensions');
  }

  if (bolly && (bolly.overall < 6.0 || bolly.overall > 8.0)) {
    failures.push(`Phase-A Bolly outside 6.0–8.0 (${bolly.overall})`);
  }

  return {
    pass: failures.length === 0,
    failures,
    goldenMin,
    midMax,
    decoyMax,
    bollyOverall: bolly?.overall,
    bollyPlacement: bolly?.ladderPlacement,
  };
}
