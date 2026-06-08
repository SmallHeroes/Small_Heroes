/**
 * Taste Judge v1 — product/editorial gate (NOT craft scoring).
 * One question: would a parent pay, read aloud happily, child ask again?
 */

import { OpenAIResponsesLLM, parseJsonFromLLM } from '../story-generator/llm';
import { getDeepProfile } from '../companion-deep-profiles';
import { normalizePartialGenderChips } from './chip-normalize';
import {
  extractStoryBodyFromMarkdown,
  stripImageDirections,
} from './craft-rubric-v2';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';
import type { StoryDirection } from './story-generation-types';

export const TASTE_JUDGE_PROMPT_VERSION = 'taste-judge-v1';

export type TasteVerdict =
  | 'BANK_READY'
  | 'STRONG_DRAFT'
  | 'REWRITE'
  | 'HUMAN_REVIEW'
  | 'FAIL';

export type TasteConfidence = 'low' | 'medium' | 'high';

export type TasteAxisId =
  | 'rereadability'
  | 'memorability'
  | 'readAloudNaturalness'
  | 'companionDelight'
  | 'pageTurnEnergy';

export interface TasteAxisResult {
  axis: TasteAxisId;
  result: 'pass' | 'fail';
  note?: string;
}

export interface TasteWeakestPage {
  page: number;
  reason: string;
}

export interface TasteJudgeContext {
  companionName?: string;
  ageRange?: string;
  direction?: StoryDirection | string;
  engineOneLiner?: string;
}

export interface TasteJudgeReport {
  promptVersion: typeof TASTE_JUDGE_PROMPT_VERSION;
  verdict: TasteVerdict;
  confidence: TasteConfidence;
  axes: TasteAxisResult[];
  weakestPage: TasteWeakestPage;
  weakestLine: string;
  strongestLine: string;
  reasons: string[];
  rewriteInstruction?: string[];
  humanReason?: string;
  failReason?: string;
  technicalLeakHits: string[];
  invalidTechnicalReasoning: boolean;
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TasteCalibrationItem {
  id: string;
  label: string;
  category:
    | 'golden'
    | 'canary'
    | 'mid'
    | 'decoy'
    | 'boring'
    | 'beautiful-but-wrong';
  report: TasteJudgeReport;
}

export interface TasteCalibrationGateResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
  invalidItems: string[];
  surprisingVerdicts: string[];
}

const TASTE_AXIS_IDS: TasteAxisId[] = [
  'rereadability',
  'memorability',
  'readAloudNaturalness',
  'companionDelight',
  'pageTurnEnergy',
];

const TECHNICAL_LEAK_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\byaml\b/i, label: 'yaml' },
  { pattern: /\bfrontmatter\b/i, label: 'frontmatter' },
  { pattern: /\bmetadata\b/i, label: 'metadata' },
  { pattern: /\bpower\s*card\b/i, label: 'powerCard' },
  { pattern: /\bimage\s*direction\b/i, label: 'imageDirection' },
  { pattern: /\bcompanion\s*id\b/i, label: 'companionId' },
  { pattern: /\bgender\s*chip\b/i, label: 'gender chip' },
  { pattern: /\{male\|female\}/i, label: 'chip format' },
  { pattern: /\bchip\s*correct/i, label: 'chip correctness' },
  { pattern: /\bvalidator\b/i, label: 'validator' },
  { pattern: /\bword\s*count\b/i, label: 'word count' },
  { pattern: /עמוד\s*\d+\s*—\s*word/i, label: 'word band' },
];

function stripYamlishLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^title:\s*/i.test(t)) return false;
      if (/^companionId:/i.test(t)) return false;
      if (/^direction:/i.test(t)) return false;
      if (/^storyStyle:/i.test(t)) return false;
      if (/^metaphor:/i.test(t)) return false;
      if (/^stakes:/i.test(t)) return false;
      if (/^heartLine:/i.test(t)) return false;
      if (/^agencyTransfer:/i.test(t)) return false;
      if (/^powerCard:/i.test(t)) return false;
      if (/^pages:/i.test(t)) return false;
      if (/^gender:/i.test(t)) return false;
      if (/^---\s*$/.test(t)) return false;
      if (/^#\s*Story:/i.test(t)) return false;
      if (/^Generated:/i.test(t)) return false;
      if (/^WORD_COUNT:/i.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Prose pages only — keeps {{childName}} and {male|female} chips; strips technical layers. */
export function extractTasteProseFromMarkdown(markdown: string): string {
  const body = extractStoryBodyFromMarkdown(markdown);
  const stripped = stripImageDirections(body);
  return stripYamlishLines(stripped);
}

/** Normalize accidental technical artifacts in calibration probes before blind taste run. */
export function normalizeTasteProbeProse(prose: string): string {
  let wrapped = prose.trim();
  if (!/--- Page \d+ ---/.test(wrapped) && /עמוד \d+/.test(wrapped)) {
    wrapped = extractStoryBodyFromMarkdown(wrapped);
  }
  if (!/--- Page 1 ---/.test(wrapped)) {
    wrapped = `--- Page 1 ---\n${wrapped}`;
  }

  const normalized = normalizePartialGenderChips(
    `${wrapped}\n\nWORD_COUNT: [1] = 1`
  ).markdown.replace(/\r?\nWORD_COUNT:[\s\S]*$/i, '').trim();

  return normalized
    .replace(/עֲצַר\/ה/g, '{עוצר|עוצרת}')
    .replace(/עצר\/ה/g, '{עוצר|עוצרת}')
    .replace(/עֲצַר\{ת\}/g, '{עוצר|עוצרת}')
    .replace(/מניח\{ת\}/g, '{מניח|מניחה}')
    .replace(/נוגע\{ת\}/g, '{נוגע|נוגעת}');
}

export function buildTasteContext(args: {
  companionId?: string;
  direction?: StoryDirection | string;
  companionDisplayName?: string;
}): TasteJudgeContext {
  const ageRange = '3–6';
  if (!args.companionId || args.companionId.startsWith('fictional_') || args.companionId.startsWith('probe_') || args.companionId.startsWith('generic_')) {
    return {
      companionName: args.companionDisplayName ?? args.companionId ?? 'companion',
      ageRange,
      direction: args.direction,
      engineOneLiner: undefined,
    };
  }

  const profile = getDeepProfile(args.companionId);
  const companionName =
    args.companionDisplayName ??
    (args.companionId === 'baby_elephant'
      ? 'טוּבִּי'
      : args.companionId === 'bolly_armadillo'
        ? 'בּוֹלִי'
        : args.companionId);

  const engineOneLiner =
    profile.copingStrategy?.trim() ||
    profile.comfortRitual?.trim() ||
    profile.signatureBehavior?.trim() ||
    undefined;

  return {
    companionName,
    ageRange,
    direction: args.direction,
    engineOneLiner,
  };
}

function buildTasteJudgeSystemPrompt(): string {
  return `You are a premium Hebrew children's picture-book EDITOR (ages 3–6, read aloud).

This is a PRODUCT / EDITORIAL taste gate — NOT a craft rubric. No 0–10 scores. No dimension averages.

THE ONE QUESTION:
"Would a parent pay for this, read it aloud happily, and would a child ask to hear it again?"

You receive Hebrew PROSE PAGES ONLY. You do NOT see YAML, metadata, power cards, image directions, validators, or chip formatting rules.
Do NOT reason about chips, YAML, format, metadata, companionId, or technical correctness. If you mention those, your judgment is invalid.

VERDICTS (pick exactly one):
- BANK_READY — paid-product quality; parent reads aloud happily; child may ask again; memorable voice; embodied action; page-turn energy; companion feels specific and delightful.
- STRONG_DRAFT — commercially promising and good, but needs light human polish; NOT auto-ship.
- REWRITE — structurally/engine-right but not delightful, memorable, or read-aloud enough; ONE author rewrite might fix.
- HUMAN_REVIEW — promising or pretty BUT age/engine/sensitivity/tone risk needs a human decision.
- FAIL — wrong age/engine/structure; generic/swappable; do not auto-rewrite.

EXPLICIT RULE:
Pretty language is NOT a compensating factor. If age or engine are wrong, beauty does NOT rescue the story.
If prose is beautiful but age/engine wrong → prefer HUMAN_REVIEW or FAIL over REWRITE (rewriting may polish the wrong story).

RUBRIC (answer internally, then output axis pass/fail):
1. Would a child ask for this again tomorrow? (rereadability)
2. At least 2 memorable/quotable lines? (memorability)
3. Companion funny/specific/embodied — not swappable calm mentor? (companionDelight)
4. Child DOES something visible and meaningful? 
5. A small wow/laugh/tender surprise?
6. Every page creates a page-turn reason? (pageTurnEnergy)
7. Read-aloud natural — not adult-poetic/therapeutic? (readAloudNaturalness)
8. Any filler/lesson/"AI story" page?

MANDATORY WEAKNESS (do not gush over one good line):
- weakestPage { page, reason } — REQUIRED
- weakestLine — REQUIRED verbatim Hebrew quote from the story
- strongestLine — REQUIRED verbatim Hebrew quote
- reasons[] must cite REAL story lines in Hebrew
- Answer: where might a child lose interest? where does it sound adult? first thing you'd rewrite?

If verdict=REWRITE → rewriteInstruction[] (2–4 concrete, prose-only instructions).
If verdict=HUMAN_REVIEW → humanReason (age/engine/sensitivity risk).
If verdict=FAIL → failReason.

Prompt version: ${TASTE_JUDGE_PROMPT_VERSION}

Return ONLY valid JSON:
{
  "verdict": "BANK_READY" | "STRONG_DRAFT" | "REWRITE" | "HUMAN_REVIEW" | "FAIL",
  "confidence": "low" | "medium" | "high",
  "axes": [
    { "axis": "rereadability", "result": "pass" | "fail", "note": "optional short" },
    { "axis": "memorability", "result": "pass" | "fail" },
    { "axis": "readAloudNaturalness", "result": "pass" | "fail" },
    { "axis": "companionDelight", "result": "pass" | "fail" },
    { "axis": "pageTurnEnergy", "result": "pass" | "fail" }
  ],
  "weakestPage": { "page": number, "reason": "string" },
  "weakestLine": "Hebrew quote",
  "strongestLine": "Hebrew quote",
  "reasons": ["string with Hebrew evidence"],
  "rewriteInstruction": ["only if REWRITE"],
  "humanReason": "only if HUMAN_REVIEW",
  "failReason": "only if FAIL"
}`;
}

function buildTasteJudgeUserPrompt(prose: string, context?: TasteJudgeContext): string {
  const contextBlock = context
    ? [
        '=== OPTIONAL CONTEXT (not prose) ===',
        context.companionName ? `Companion: ${context.companionName}` : '',
        context.ageRange ? `Age: ${context.ageRange}` : '',
        context.direction ? `Direction: ${context.direction}` : '',
        context.engineOneLiner ? `Engine (one line): ${context.engineOneLiner}` : '',
        '=== END CONTEXT ===',
        '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return `${contextBlock}Judge this story BLIND on taste only.

=== PROSE PAGES ===
${prose.trim()}
=== END PROSE ===`;
}

function collectTechnicalLeaks(text: string): string[] {
  const hits: string[] = [];
  for (const { pattern, label } of TECHNICAL_LEAK_PATTERNS) {
    if (pattern.test(text)) hits.push(label);
    pattern.lastIndex = 0;
  }
  return [...new Set(hits)];
}

interface RawTasteJudge {
  verdict?: TasteVerdict;
  confidence?: TasteConfidence;
  axes?: Array<{ axis?: string; result?: string; note?: string }>;
  weakestPage?: { page?: number; reason?: string };
  weakestLine?: string;
  strongestLine?: string;
  reasons?: string[];
  rewriteInstruction?: string[];
  humanReason?: string;
  failReason?: string;
}

function normalizeAxes(raw?: RawTasteJudge['axes']): TasteAxisResult[] {
  const byId = new Map<TasteAxisId, TasteAxisResult>();
  for (const axis of TASTE_AXIS_IDS) {
    byId.set(axis, { axis, result: 'fail' });
  }
  for (const entry of raw ?? []) {
    const axis = entry.axis as TasteAxisId;
    if (!TASTE_AXIS_IDS.includes(axis)) continue;
    byId.set(axis, {
      axis,
      result: entry.result === 'pass' ? 'pass' : 'fail',
      note: entry.note?.trim() || undefined,
    });
  }
  return TASTE_AXIS_IDS.map((a) => byId.get(a)!);
}

function normalizeTasteReport(
  raw: RawTasteJudge,
  modelId: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): TasteJudgeReport {
  const verdict = raw.verdict ?? 'HUMAN_REVIEW';
  const blob = JSON.stringify(raw);
  const technicalLeakHits = collectTechnicalLeaks(blob);

  const reasons = (raw.reasons ?? []).map((r) => r.trim()).filter(Boolean);
  if (!raw.weakestLine?.trim()) reasons.push('(judge omitted weakestLine)');
  if (!raw.strongestLine?.trim()) reasons.push('(judge omitted strongestLine)');

  return {
    promptVersion: TASTE_JUDGE_PROMPT_VERSION,
    verdict,
    confidence: raw.confidence ?? 'medium',
    axes: normalizeAxes(raw.axes),
    weakestPage: {
      page: raw.weakestPage?.page ?? 0,
      reason: raw.weakestPage?.reason?.trim() || 'unspecified',
    },
    weakestLine: raw.weakestLine?.trim() || '(missing)',
    strongestLine: raw.strongestLine?.trim() || '(missing)',
    reasons,
    rewriteInstruction:
      verdict === 'REWRITE' ? (raw.rewriteInstruction ?? []).filter(Boolean) : undefined,
    humanReason: verdict === 'HUMAN_REVIEW' ? raw.humanReason?.trim() : undefined,
    failReason: verdict === 'FAIL' ? raw.failReason?.trim() : undefined,
    technicalLeakHits,
    invalidTechnicalReasoning: technicalLeakHits.length > 0,
    modelId,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  };
}

export async function runTasteJudge(args: {
  prose: string;
  context?: TasteJudgeContext;
  modelId?: string;
}): Promise<TasteJudgeReport> {
  const modelId = args.modelId ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const llm = new OpenAIResponsesLLM(modelId);

  const result = await llm.call({
    stage: 'taste-judge-v1',
    systemPrompt: buildTasteJudgeSystemPrompt(),
    userPrompt: buildTasteJudgeUserPrompt(args.prose, args.context),
    jsonMode: true,
    maxOutputTokens: 4096,
    temperature: 0,
  });

  const parsed = parseJsonFromLLM<RawTasteJudge>(result.text, 'taste-judge-v1');
  return normalizeTasteReport(parsed, modelId, {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });
}

export interface TasteProbeSpec {
  id: string;
  label: string;
  category: 'boring' | 'beautiful-but-wrong';
  storyBody: string;
  designedVerdict: string;
}

export function parseTasteProbeSpecs(markdown: string): TasteProbeSpec[] {
  const specs: TasteProbeSpec[] = [];

  const boringParts = markdown.split(/^## BORING #/m).slice(1);
  for (let i = 0; i < boringParts.length; i++) {
    const section = boringParts[i] ?? '';
    const labelMatch = section.match(/^ — "([^"]+)"/);
    const label = labelMatch?.[1] ?? `boring_${i + 1}`;
    const bodyMatch = section.match(
      /=== STORY BODY[^=]*===\r?\n([\s\S]*?)\r?\n=== END ===/
    );
    const designed = section.match(/\*\*Designed verdict:\*\* ([^\n]+)/)?.[1] ?? '';
    if (!bodyMatch?.[1]) continue;
    specs.push({
      id: `boring_${i + 1}`,
      label,
      category: 'boring',
      storyBody: bodyMatch[1].trim(),
      designedVerdict: designed,
    });
  }

  const beautifulMatch = markdown.match(
    /^## BEAUTIFUL-BUT-WRONG[\s\S]*?=== STORY BODY[^=]*===\r?\n([\s\S]*?)\r?\n=== END ===/m
  );
  if (beautifulMatch?.[1]) {
    const section = markdown.split(/^## BEAUTIFUL-BUT-WRONG/m)[1] ?? '';
    const labelMatch = section.match(/^ — "([^"]+)"/);
    const designed = section.match(/\*\*Designed verdict:\*\* ([^\n]+)/)?.[1] ?? '';
    specs.push({
      id: 'beautiful_but_wrong_moths_song',
      label: labelMatch?.[1] ?? "The Moth's Song",
      category: 'beautiful-but-wrong',
      storyBody: beautifulMatch[1].trim(),
      designedVerdict: designed,
    });
  }

  return specs;
}

export function evaluateTasteCalibrationGate(
  items: TasteCalibrationItem[]
): TasteCalibrationGateResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const invalidItems: string[] = [];
  const surprisingVerdicts: string[] = [];

  const goldens = items.filter((i) => i.category === 'golden');
  const goldenBankReady = goldens.filter((i) => i.report.verdict === 'BANK_READY').length;
  const goldenStrong = goldens.filter((i) => i.report.verdict === 'STRONG_DRAFT').length;
  const goldenLow = goldens.filter((i) =>
    ['REWRITE', 'FAIL', 'HUMAN_REVIEW'].includes(i.report.verdict)
  );

  if (goldenStrong > 2) {
    warnings.push(`Goldens: ${goldenStrong} STRONG_DRAFT (expected ≤2)`);
  }
  if (goldenBankReady + goldenStrong < 8) {
    warnings.push(
      `Goldens: only ${goldenBankReady + goldenStrong}/10 at BANK_READY or STRONG_DRAFT (expected most)`
    );
  }
  for (const g of goldenLow) {
    surprisingVerdicts.push(`Golden ${g.id}: ${g.report.verdict} — flag for human review`);
  }

  const b4 = items.find((i) => i.id === 'bolly_b4_hacheder_bed');
  if (b4 && b4.report.verdict !== 'BANK_READY') {
    failures.push(`B4 canary must be BANK_READY (got ${b4.report.verdict})`);
  }

  for (const c of items.filter((i) => i.category === 'canary' && i.id !== 'bolly_b4_hacheder_bed')) {
    if (!['BANK_READY', 'STRONG_DRAFT'].includes(c.report.verdict)) {
      failures.push(`Canary ${c.id}: expected BANK_READY or STRONG_DRAFT (got ${c.report.verdict})`);
    }
    if (!c.report.weakestLine || c.report.weakestLine === '(missing)') {
      warnings.push(`Canary ${c.id}: judge omitted weakestLine`);
    }
  }

  for (const item of items.filter((i) =>
    ['mid', 'decoy', 'boring'].includes(i.category)
  )) {
    if (item.report.verdict === 'BANK_READY') {
      failures.push(`${item.category} ${item.id}: must NOT be BANK_READY (got BANK_READY)`);
    }
  }

  const beautiful = items.filter((i) => i.category === 'beautiful-but-wrong');
  for (const b of beautiful) {
    if (b.report.verdict === 'BANK_READY' || b.report.verdict === 'STRONG_DRAFT') {
      failures.push(
        `beautiful-but-wrong ${b.id}: must be HUMAN_REVIEW or FAIL (got ${b.report.verdict})`
      );
    }
  }

  for (const item of items) {
    if (item.report.invalidTechnicalReasoning) {
      invalidItems.push(
        `${item.id}: technical leak [${item.report.technicalLeakHits.join(', ')}]`
      );
    }
    if (!item.report.weakestLine || item.report.weakestLine === '(missing)') {
      warnings.push(`${item.id}: missing weakestLine`);
    }
  }

  return {
    pass: failures.length === 0 && invalidItems.length === 0,
    failures,
    warnings,
    invalidItems,
    surprisingVerdicts,
  };
}

export function formatTasteCalibrationTable(items: TasteCalibrationItem[]): string {
  const header =
    '| story | category | verdict | confidence | weakestPage | weakestLine | strongestLine | reasons |';
  const sep =
    '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const rows = items.map((item) => {
    const r = item.report;
    const reasons = r.reasons.slice(0, 2).join(' · ').replace(/\|/g, '/');
    const wLine = r.weakestLine.replace(/\|/g, '/').slice(0, 60);
    const sLine = r.strongestLine.replace(/\|/g, '/').slice(0, 60);
    const wp = r.weakestPage.page ? `p${r.weakestPage.page}` : '?';
    return `| ${item.id} | ${item.category} | ${r.verdict} | ${r.confidence} | ${wp}: ${r.weakestPage.reason.slice(0, 40)} | ${wLine} | ${sLine} | ${reasons} |`;
  });
  return [header, sep, ...rows].join('\n');
}
