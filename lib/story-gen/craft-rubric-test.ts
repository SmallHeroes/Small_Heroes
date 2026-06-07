/**
 * Craft rubric judge — Phase A2 calibration gate.
 * Decision Gate §8: 12 dimensions + hard-fails. Advisory only until calibrated.
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

/** Bump when rubric definitions or scoring rules change. */
export const CRAFT_RUBRIC_PROMPT_VERSION = 'craft-rubric-v1';

export const CRAFT_DIMENSIONS = [
  'childDelight',
  'humor',
  'pageTurnValue',
  'visualRichness',
  'emotionalTruth',
  'childAgency',
  'companionMemorability',
  'hebrewOrality',
  'ageFit',
  'rereadability',
  'commercialQuality',
  'imageReadiness',
] as const;

export type CraftDimension = (typeof CRAFT_DIMENSIONS)[number];

export const CRAFT_HARD_FAIL_IDS = [
  'moralizingEnding',
  'childPassiveThroughStory',
  'adultTherapeuticExplanation',
  'fearSanitizedOrDismissed',
  'genericCompanionSubstitutable',
] as const;

export type CraftHardFailId = (typeof CRAFT_HARD_FAIL_IDS)[number];

export interface CraftDimensionScore {
  dimension: CraftDimension;
  /** 0–10. ≤5 = flagged weak. */
  score: number;
  /** Short verbatim quote from the story supporting the score (Hebrew preferred). */
  evidenceQuote: string;
}

export interface CraftHardFailResult {
  id: CraftHardFailId;
  triggered: boolean;
  evidenceQuote: string;
}

export type CraftVerdict = 'strong' | 'acceptable' | 'weak' | 'fail';

export interface CraftRubricReport {
  promptVersion: string;
  overall: number;
  dimensions: CraftDimensionScore[];
  hardFails: CraftHardFailResult[];
  /** Dimensions with score ≤ FLAG_THRESHOLD. */
  flaggedDimensions: CraftDimension[];
  summary: string;
  verdict: CraftVerdict;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

export const CRAFT_FLAG_THRESHOLD = 5;

const DIMENSION_GUIDE: Record<CraftDimension, string> = {
  childDelight:
    'Would a 4–6yo lean in, giggle, or feel seen — not just politely follow? Surprise, specificity, sensory fun.',
  humor:
    'Earned humor from character/body/situation — not empty cheerfulness or adult wit.',
  pageTurnValue:
    'Each page pulls to the next via tension, question, motion, or emotional turn — not flat summary.',
  visualRichness:
    'Scenes a picture-book artist could draw with distinct props, space, light, action — not talking heads in void.',
  emotionalTruth:
    'Feelings shown through body, choice, mistake — NOT explained clinically ("פחד הוא רגש טבעי").',
  childAgency:
    'Child acts, decides, leads moments — not only listens/obeying a mentor through the story.',
  companionMemorability:
    'Companion has signature engine, body comedy, voice, ritual — could NOT be swapped for generic wise animal.',
  hebrewOrality:
    'Oral, concrete, child-native Hebrew — NOT adult-poetic abstraction ("שדה של אור ומשמעות", "רגשות ריחפו").',
  ageFit:
    'Vocabulary, sentence rhythm, and ideas fit ages 3–6 heard aloud — not literary/over-the-head.',
  rereadability:
    'Distinct images/lines worth revisiting — not interchangeable competent filler.',
  commercialQuality:
    'Would a parent pay for this vs free library book? Specific, warm, premium — not template-compliant.',
  imageReadiness:
    'Each page implies a drawable beat (pose, setting, prop) — static dialogue-only pages score low.',
};

const HARD_FAIL_GUIDE: Record<CraftHardFailId, string> = {
  moralizingEnding:
    'Explicit lesson recap or moral summary ("ולכן למדנו ש...", "פחד הוא חבר לא אויב").',
  childPassiveThroughStory:
    'Child mostly listens, nods, breathes on command — no meaningful initiative until final page (if ever).',
  adultTherapeuticExplanation:
    'Adult/mentor explains emotions or coping in lecture tone instead of dramatized experience.',
  fearSanitizedOrDismissed:
    'Fear minimized ("זה לא באמת מפחיד", "היה רק צל") without honoring the child\'s real feeling first.',
  genericCompanionSubstitutable:
    'Companion could be any calm animal — no signature body, ritual, comic engine, or profile-bound voice.',
};

function buildCraftRubricSystemPrompt(): string {
  const dimBlock = CRAFT_DIMENSIONS.map(
    (d) => `- ${d}: ${DIMENSION_GUIDE[d]}`
  ).join('\n');

  const failBlock = CRAFT_HARD_FAIL_IDS.map(
    (id) => `- ${id}: ${HARD_FAIL_GUIDE[id]}`
  ).join('\n');

  return `You are a strict literary QA judge for Hebrew picture-book stories (ages 3–6, read aloud).

CRITICAL: Fluent, compliant, gentle Hebrew is NOT sufficient. Many AI drafts sound "fine" but fail craft.
Penalize template obedience, therapeutic lecturing, abstract poetry, flat talking-head pages, and generic companions.

Score each dimension 0–10:
- 0–3: clear fail
- 4–5: weak / templated
- 6–7: competent but not golden
- 8–9: strong literary tier
- 10: exceptional (rare)

Dimensions:
${dimBlock}

Hard-fails (binary — set triggered true only with clear evidence):
${failBlock}

Rules:
- Every dimension MUST include a short evidenceQuote (verbatim from the story, ≤25 words).
- Every hard-fail MUST include evidenceQuote (empty string if not triggered).
- flaggedDimensions: list every dimension with score ≤ ${CRAFT_FLAG_THRESHOLD}.
- overall: 0–10 holistic quality for publication (hard-fails should pull overall ≤4).
- verdict: strong (≥8, no hard-fails), acceptable (7–7.9), weak (5–6.9), fail (<5 OR any hard-fail triggered).
- Do NOT reward politeness, moral clarity, or "nice messages" over literary craft.

Prompt version: ${CRAFT_RUBRIC_PROMPT_VERSION}

Return ONLY valid JSON matching this schema:
{
  "overall": number,
  "dimensions": [{ "dimension": "<one of 12 ids>", "score": number, "evidenceQuote": string }],
  "hardFails": [{ "id": "<hard-fail id>", "triggered": boolean, "evidenceQuote": string }],
  "flaggedDimensions": ["..."],
  "summary": "2–3 sentences",
  "verdict": "strong" | "acceptable" | "weak" | "fail"
}`;
}

function buildCraftRubricUserPrompt(storyBody: string): string {
  return `Judge this story body. Score craft only — ignore missing YAML/frontmatter if prose is present.

=== STORY BODY ===
${storyBody.trim()}
=== END ===`;
}

function normalizeReport(
  raw: Omit<CraftRubricReport, 'promptVersion' | 'modelId' | 'inputTokens' | 'outputTokens'>,
  modelId: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): CraftRubricReport {
  const dimMap = new Map<CraftDimension, CraftDimensionScore>();
  for (const d of CRAFT_DIMENSIONS) {
    const hit = raw.dimensions.find((x) => x.dimension === d);
    dimMap.set(d, hit ?? { dimension: d, score: 0, evidenceQuote: '(missing from judge)' });
  }

  const failMap = new Map<CraftHardFailId, CraftHardFailResult>();
  for (const id of CRAFT_HARD_FAIL_IDS) {
    const hit = raw.hardFails.find((x) => x.id === id);
    failMap.set(
      id,
      hit ?? { id, triggered: false, evidenceQuote: '' }
    );
  }

  const dimensions = CRAFT_DIMENSIONS.map((d) => dimMap.get(d)!);
  const hardFails = CRAFT_HARD_FAIL_IDS.map((id) => failMap.get(id)!);
  const flaggedDimensions = dimensions
    .filter((d) => d.score <= CRAFT_FLAG_THRESHOLD)
    .map((d) => d.dimension);

  const anyHardFail = hardFails.some((h) => h.triggered);
  let verdict = raw.verdict;
  if (anyHardFail && verdict !== 'fail') verdict = 'fail';
  if (raw.overall <= CRAFT_FLAG_THRESHOLD && verdict === 'acceptable') verdict = 'weak';

  return {
    promptVersion: CRAFT_RUBRIC_PROMPT_VERSION,
    overall: raw.overall,
    dimensions,
    hardFails,
    flaggedDimensions,
    summary: raw.summary,
    verdict,
    modelId,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  };
}

export async function runCraftRubricTest(args: {
  storyBody: string;
  modelId?: string;
}): Promise<CraftRubricReport> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const llm = new OpenAIResponsesLLM(modelId);
  const systemPrompt = buildCraftRubricSystemPrompt();
  const userPrompt = buildCraftRubricUserPrompt(args.storyBody);

  const result = await llm.call({
    stage: 'craft-rubric',
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0,
  });

  type RawReport = Omit<
    CraftRubricReport,
    'promptVersion' | 'modelId' | 'inputTokens' | 'outputTokens'
  >;
  const parsed = parseJsonFromLLM<RawReport>(result.text, 'craft-rubric');

  return normalizeReport(parsed, modelId, {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export function extractGoldenStoryBody(markdown: string): string {
  const titleMatch = markdown.match(/^title:\s*"([^"]+)"/m);
  const title = titleMatch?.[1] ?? '';

  const pageRe = /\r?\n--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page \d+ ---|\r?\nWORD_COUNT:|$)/g;
  const pages: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pageRe.exec(markdown)) !== null) {
    const pageNum = match[1];
    const chunk = match[2]?.trim() ?? '';
    pages.push(`--- Page ${pageNum} ---\n${chunk}`);
  }

  if (pages.length === 0) {
    return markdown.trim();
  }

  const header = title ? `title: "${title}"\n\n` : '';
  return `${header}${pages.join('\n\n')}`.trim();
}

export interface DecoySpec {
  id: string;
  label: string;
  storyBody: string;
  expectedLowDimensions: CraftDimension[];
  expectedHardFails: CraftHardFailId[];
}

export function parseDecoySpecs(decoysMarkdown: string): DecoySpec[] {
  const decoySections = decoysMarkdown.split(/^## Decoy \d+/m).slice(1);
  const specs: DecoySpec[] = [];

  for (let i = 0; i < decoySections.length; i++) {
    const section = decoySections[i] ?? '';
    const labelMatch = section.match(/^ — "([^"]+)"/);
    const label = labelMatch?.[1] ?? `decoy_${i + 1}`;

    const bodyMatch = section.match(
      /=== STORY BODY[^=]*===\r?\n([\s\S]*?)\r?\n=== END ===/
    );
    if (!bodyMatch?.[1]) continue;

    const failLine = section.match(/\*\*Designed to fail on:\*\* ([^\n]+)/);
    const expectedLowDimensions: CraftDimension[] = [];
    const expectedHardFails: CraftHardFailId[] = [];

    if (failLine?.[1]) {
      const text = failLine[1].toLowerCase();
      if (text.includes('childagency') || text.includes('child agency')) {
        expectedLowDimensions.push('childAgency');
      }
      if (text.includes('companionmemorability') || text.includes('companion memorability')) {
        expectedLowDimensions.push('companionMemorability');
      }
      if (text.includes('emotionaltruth') || text.includes('emotional truth')) {
        expectedLowDimensions.push('emotionalTruth');
      }
      if (text.includes('pageturnvalue') || text.includes('page-turn') || text.includes('page turn')) {
        expectedLowDimensions.push('pageTurnValue');
      }
      if (text.includes('visualrichness') || text.includes('visual richness')) {
        expectedLowDimensions.push('visualRichness');
      }
      if (text.includes('humor')) {
        expectedLowDimensions.push('humor');
      }
      if (text.includes('rereadability')) {
        expectedLowDimensions.push('rereadability');
      }
      if (text.includes('imagereadiness') || text.includes('image readiness')) {
        expectedLowDimensions.push('imageReadiness');
      }
      if (text.includes('hebreworality') || text.includes('hebrew orality')) {
        expectedLowDimensions.push('hebrewOrality');
      }
      if (text.includes('agefit') || text.includes('age fit')) {
        expectedLowDimensions.push('ageFit');
      }
      if (text.includes('moralizing')) {
        expectedHardFails.push('moralizingEnding');
      }
      if (text.includes('child passive') || text.includes('passive child')) {
        expectedHardFails.push('childPassiveThroughStory');
      }
      if (text.includes('therapeutic') || text.includes('adult/therapeutic')) {
        expectedHardFails.push('adultTherapeuticExplanation');
      }
      if (text.includes('sanitized') || text.includes("wasn't really scary")) {
        expectedHardFails.push('fearSanitizedOrDismissed');
      }
      if (text.includes('generic') || text.includes('swappable') || text.includes('swap-relevant')) {
        expectedHardFails.push('genericCompanionSubstitutable');
      }
    }

    specs.push({
      id: `decoy_${i + 1}`,
      label,
      storyBody: bodyMatch[1].trim(),
      expectedLowDimensions: [...new Set(expectedLowDimensions)],
      expectedHardFails: [...new Set(expectedHardFails)],
    });
  }

  return specs;
}

export interface DecoyCalibrationMatch {
  decoyId: string;
  label: string;
  expectedLowDimensions: CraftDimension[];
  expectedHardFails: CraftHardFailId[];
  flaggedDimensions: CraftDimension[];
  triggeredHardFails: CraftHardFailId[];
  dimensionHits: CraftDimension[];
  dimensionMisses: CraftDimension[];
  hardFailHits: CraftHardFailId[];
  hardFailMisses: CraftHardFailId[];
  dimensionMatchRate: number;
  hardFailMatchRate: number;
  pass: boolean;
}

export function compareDecoyToExpectations(
  spec: DecoySpec,
  report: CraftRubricReport
): DecoyCalibrationMatch {
  const flagged = report.flaggedDimensions;
  const triggered = report.hardFails.filter((h) => h.triggered).map((h) => h.id);

  const dimensionHits = spec.expectedLowDimensions.filter((d) => flagged.includes(d));
  const dimensionMisses = spec.expectedLowDimensions.filter((d) => !flagged.includes(d));
  const hardFailHits = spec.expectedHardFails.filter((id) => triggered.includes(id));
  const hardFailMisses = spec.expectedHardFails.filter((id) => !triggered.includes(id));

  const dimDenom = spec.expectedLowDimensions.length || 1;
  const dimensionMatchRate = dimensionHits.length / dimDenom;
  const hardFailMatchRate =
    spec.expectedHardFails.length === 0
      ? 1
      : hardFailHits.length / spec.expectedHardFails.length;

  const pass =
    report.overall < 6 &&
    dimensionMatchRate >= 0.67 &&
    hardFailMatchRate >= 0.67;

  return {
    decoyId: spec.id,
    label: spec.label,
    expectedLowDimensions: spec.expectedLowDimensions,
    expectedHardFails: spec.expectedHardFails,
    flaggedDimensions: flagged,
    triggeredHardFails: triggered,
    dimensionHits,
    dimensionMisses,
    hardFailHits,
    hardFailMisses,
    dimensionMatchRate,
    hardFailMatchRate,
    pass,
  };
}

export interface CalibrationRow {
  id: string;
  label: string;
  kind: 'golden' | 'decoy';
  overall: number;
  verdict: CraftVerdict;
  scores: Record<CraftDimension, number>;
  flaggedDimensions: CraftDimension[];
  triggeredHardFails: CraftHardFailId[];
}

export function reportToCalibrationRow(
  id: string,
  label: string,
  kind: 'golden' | 'decoy',
  report: CraftRubricReport
): CalibrationRow {
  const scores = {} as Record<CraftDimension, number>;
  for (const d of report.dimensions) {
    scores[d.dimension] = d.score;
  }
  return {
    id,
    label,
    kind,
    overall: report.overall,
    verdict: report.verdict,
    scores,
    flaggedDimensions: report.flaggedDimensions,
    triggeredHardFails: report.hardFails.filter((h) => h.triggered).map((h) => h.id),
  };
}

export function formatCalibrationTableMarkdown(rows: CalibrationRow[]): string {
  const dimHeaders = CRAFT_DIMENSIONS.join(' | ');
  const header = `| Story | Kind | Overall | Verdict | ${dimHeaders} | Flagged | Hard-fails |`;
  const sep = `| --- | --- | ---: | --- | ${CRAFT_DIMENSIONS.map(() => '---:').join(' | ')} | --- | --- |`;

  const body = rows
    .map((r) => {
      const dimScores = CRAFT_DIMENSIONS.map((d) => r.scores[d] ?? '-').join(' | ');
      return `| ${r.label} | ${r.kind} | ${r.overall} | ${r.verdict} | ${dimScores} | ${r.flaggedDimensions.join(', ') || '—'} | ${r.triggeredHardFails.join(', ') || '—'} |`;
    })
    .join('\n');

  return `${header}\n${sep}\n${body}`;
}
