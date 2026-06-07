/**
 * Run 1 advisory attachments — craft v2.1 (real) + deterministic validators + placeholders.
 * NOT a full Phase B checkpoint; swap/freshness are explicitly not implemented.
 */

import {
  CRAFT_RUBRIC_V21_PROMPT_VERSION,
  runCraftRubricTestV21,
  type CraftRubricV21Report,
} from './craft-rubric-v2.1';
import { extractStoryBodyFromMarkdown } from './craft-rubric-v2';
import type { Scenario, StoryDirection } from './story-generation-types';
import { DIRECTION_PAGE_COUNTS } from './story-generation-types';

export interface AdvisoryPlaceholderReport {
  status: 'not_implemented_yet';
  advisoryOnly: true;
  notARealScore: true;
  module: 'swapTest' | 'freshnessTest';
  message: string;
}

export interface Run1ValidatorPageRow {
  page: number;
  wordCount: number;
  targetBand: { min: number; max: number };
  bandStatus: 'ok' | 'below' | 'above' | 'hard_max';
  imageDirectionPresent: boolean;
  imageDirectionLine: string;
  malformedChips: string[];
  identicalChipPairs: string[];
}

export interface Run1ValidatorReport {
  status: 'advisory_deterministic';
  notARealGate: true;
  direction: StoryDirection;
  expectedPages: number;
  pageCount: number;
  pageCountOk: boolean;
  pages: Run1ValidatorPageRow[];
  formatChecks: {
    hasYamlFrontmatter: boolean;
    pageHeaderStyle: 'canonical' | 'markdown_h3' | 'mixed' | 'missing';
    allPagesHaveImageDirection: boolean;
    wordCountLinePresent: boolean;
  };
  warnings: string[];
  hardMaxWarnings: string[];
}

export interface Run1AdvisoryBundle {
  runLabel: string;
  scenarioId: string;
  companionId: string;
  direction: StoryDirection;
  craftV21: CraftRubricV21Report;
  validators: Run1ValidatorReport;
  swapTest: AdvisoryPlaceholderReport;
  freshnessTest: AdvisoryPlaceholderReport;
  generatedAt: string;
}

const ADVENTURE_WORD_MIN = 30;
const ADVENTURE_WORD_MAX = 50;
const ADVENTURE_HARD_MAX = 65;

const BEDTIME_WORD_MIN = 25;
const BEDTIME_WORD_MAX = 45;
const BEDTIME_HARD_MAX = 55;

function wordBand(direction: StoryDirection): { min: number; max: number; hardMax: number } {
  if (direction === 'adventure') {
    return { min: ADVENTURE_WORD_MIN, max: ADVENTURE_WORD_MAX, hardMax: ADVENTURE_HARD_MAX };
  }
  if (direction === 'bedtime') {
    return { min: BEDTIME_WORD_MIN, max: BEDTIME_WORD_MAX, hardMax: BEDTIME_HARD_MAX };
  }
  return { min: 35, max: 55, hardMax: 70 };
}

function countHebrewWords(text: string): number {
  const stripped = text
    .replace(/imageDirection\s*:[^\n]*/gi, '')
    .replace(/\{\{[^}]+\}\}/g, ' ')
    .replace(/[{}]/g, ' ');
  const tokens = stripped.match(/[\u0590-\u05FF]+|[A-Za-z]+|\d+/g);
  return tokens?.length ?? 0;
}

function analyzeChips(prose: string): { malformed: string[]; identical: string[] } {
  const malformed: string[] = [];
  const identical: string[] = [];
  const chipRe = /\{([^{}|]+)\|([^{}|]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = chipRe.exec(prose)) !== null) {
    const full = m[0];
    const left = m[1].trim();
    const right = m[2].trim();
    if (!left || !right) malformed.push(full);
    if (left === right) identical.push(full);
  }
  const orphan = prose.match(/\{[^{}|]*\}(?!\|)/g) ?? [];
  for (const o of orphan) {
    if (!o.includes('|')) malformed.push(o);
  }
  return { malformed, identical };
}

function parsePages(markdown: string): Array<{ page: number; body: string }> {
  const pages: Array<{ page: number; body: string }> = [];
  const re =
    /\r?\n--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page \d+ ---|\r?\nWORD_COUNT:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec('\n' + markdown)) !== null) {
    pages.push({ page: parseInt(m[1], 10), body: m[2] ?? '' });
  }
  if (pages.length === 0) {
    const h3 =
      /\r?\n### Page (\d+)\r?\n([\s\S]*?)(?=\r?\n### Page \d+|\r?\nWORD_COUNT:|$)/g;
    while ((m = h3.exec('\n' + markdown)) !== null) {
      pages.push({ page: parseInt(m[1], 10), body: m[2] ?? '' });
    }
  }
  return pages;
}

export function buildSwapTestPlaceholder(): AdvisoryPlaceholderReport {
  return {
    status: 'not_implemented_yet',
    advisoryOnly: true,
    notARealScore: true,
    module: 'swapTest',
    message:
      'swapTest advisory module not built yet. No companion-boundness score — human review only.',
  };
}

export function buildFreshnessTestPlaceholder(): AdvisoryPlaceholderReport {
  return {
    status: 'not_implemented_yet',
    advisoryOnly: true,
    notARealScore: true,
    module: 'freshnessTest',
    message:
      'freshnessTest advisory module not built yet. No corpus overlap score — human review only.',
  };
}

export function runDeterministicValidators(args: {
  storyMarkdown: string;
  direction: StoryDirection;
  expectedPages?: number;
}): Run1ValidatorReport {
  const expectedPages = args.expectedPages ?? DIRECTION_PAGE_COUNTS[args.direction];
  const band = wordBand(args.direction);
  const pages = parsePages(args.storyMarkdown);
  const warnings: string[] = [];
  const hardMaxWarnings: string[] = [];

  const hasCanonical = /--- Page \d+ ---/.test(args.storyMarkdown);
  const hasH3 = /### Page \d+/.test(args.storyMarkdown);
  let pageHeaderStyle: Run1ValidatorReport['formatChecks']['pageHeaderStyle'] = 'missing';
  if (hasCanonical && hasH3) pageHeaderStyle = 'mixed';
  else if (hasCanonical) pageHeaderStyle = 'canonical';
  else if (hasH3) pageHeaderStyle = 'markdown_h3';

  if (pageHeaderStyle === 'markdown_h3' || pageHeaderStyle === 'mixed') {
    warnings.push('Non-canonical page headers (### Page N) — format validator would flag in full Phase B.');
  }

  const pageRows: Run1ValidatorPageRow[] = pages.map(({ page, body }) => {
    const proseOnly = body.replace(/imageDirection\s*:[^\n]*/gi, '').trim();
    const wc = countHebrewWords(proseOnly);
    let bandStatus: Run1ValidatorPageRow['bandStatus'] = 'ok';
    if (wc > band.hardMax) bandStatus = 'hard_max';
    else if (wc > band.max) bandStatus = 'above';
    else if (wc < band.min) bandStatus = 'below';

    if (bandStatus === 'hard_max') {
      hardMaxWarnings.push(`Page ${page}: ${wc} words (hard max ${band.hardMax})`);
    } else if (bandStatus === 'above') {
      warnings.push(`Page ${page}: ${wc} words (target max ${band.max})`);
    } else if (bandStatus === 'below') {
      warnings.push(`Page ${page}: ${wc} words (target min ${band.min})`);
    }

    const imgMatch = body.match(/imageDirection\s*:\s*(.+)/i);
    const imageDirectionLine = imgMatch?.[0]?.trim() ?? '';
    const { malformed, identical } = analyzeChips(proseOnly);
    if (malformed.length) warnings.push(`Page ${page}: malformed chips — ${malformed.join(', ')}`);
    if (identical.length) warnings.push(`Page ${page}: identical chip options — ${identical.join(', ')}`);

    return {
      page,
      wordCount: wc,
      targetBand: { min: band.min, max: band.max },
      bandStatus,
      imageDirectionPresent: Boolean(imgMatch),
      imageDirectionLine,
      malformedChips: malformed,
      identicalChipPairs: identical,
    };
  });

  const pageCountOk = pages.length === expectedPages;
  if (!pageCountOk) {
    warnings.push(`Page count ${pages.length} !== expected ${expectedPages}`);
  }

  const allImg = pageRows.length > 0 && pageRows.every((p) => p.imageDirectionPresent);
  if (!allImg) warnings.push('One or more pages missing imageDirection line');

  const hasYaml = /^---\r?\n[\s\S]*?\r?\n---/.test(args.storyMarkdown);
  if (!hasYaml) warnings.push('Missing YAML frontmatter block (--- ... ---)');

  const wordCountLinePresent = /WORD_COUNT\s*:/i.test(args.storyMarkdown);

  return {
    status: 'advisory_deterministic',
    notARealGate: true,
    direction: args.direction,
    expectedPages,
    pageCount: pages.length,
    pageCountOk,
    pages: pageRows,
    formatChecks: {
      hasYamlFrontmatter: hasYaml,
      pageHeaderStyle,
      allPagesHaveImageDirection: allImg,
      wordCountLinePresent,
    },
    warnings,
    hardMaxWarnings,
  };
}

export async function buildRun1AdvisoryBundle(args: {
  scenario: Scenario;
  storyMarkdown: string;
  runLabel?: string;
  judgeModel?: string;
}): Promise<Run1AdvisoryBundle> {
  const storyBody = extractStoryBodyFromMarkdown(args.storyMarkdown);
  const craftV21 = await runCraftRubricTestV21({
    storyBody,
    modelId: args.judgeModel,
  });

  return {
    runLabel: args.runLabel ?? 'phase-b-run-1-canary',
    scenarioId: args.scenario.id,
    companionId: args.scenario.companionId,
    direction: args.scenario.direction,
    craftV21,
    validators: runDeterministicValidators({
      storyMarkdown: args.storyMarkdown,
      direction: args.scenario.direction,
      expectedPages: args.scenario.beatCount,
    }),
    swapTest: buildSwapTestPlaceholder(),
    freshnessTest: buildFreshnessTestPlaceholder(),
    generatedAt: new Date().toISOString(),
  };
}

export function formatCraftV21Summary(report: CraftRubricV21Report): string {
  const dims = report.dimensions
    .map((d) => `${d.dimension}=${d.score}`)
    .join(', ');
  const weakest = report.perDimensionComparisons
    .filter((c) => c.weakestLineEvidence)
    .map((c) => `${c.dimension}: "${c.weakestLineEvidence.slice(0, 60)}"`)
    .join('\n');
  return [
    `promptVersion: ${CRAFT_RUBRIC_V21_PROMPT_VERSION}`,
    `overall: ${report.overall} (raw ${report.rawOverall ?? report.overall})`,
    `ladderPlacement: ${report.ladderPlacement}`,
    `verdict: ${report.verdict}`,
    `dimensions: ${dims}`,
    `positiveQuotes: ${report.positiveEvidenceQuotes.join(' | ') || 'none'}`,
    `weakest-line evidence:\n${weakest || 'none'}`,
    `summary: ${report.summary}`,
  ].join('\n');
}
