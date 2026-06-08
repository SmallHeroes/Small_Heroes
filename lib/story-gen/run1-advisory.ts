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
import {
  analyzeGenderChips,
  countPageWords,
  hasValidYamlFrontmatter,
  pageProseOnly,
  parseStoryPages,
  parseWordCountLine,
} from './story-page-utils';
import {
  directionWordBand,
  WORD_BAND_THIN_FAIL_MAJORITY,
} from './word-bands';
import type { GenderChipRepairReport } from './gender-chip-repair';
import type { ChipNormalizeReport } from './chip-normalize';
import type { ChipSafetyReport } from './chip-safety';
import { scanChipSafety } from './chip-safety';
import type { HebrewSanityReport } from './hebrew-sanity';
import type { ThinPageEnrichReport } from './thin-page-enrich';
import type { ProofreadReport } from './proofread-pass';
import type { PowerCardSanitizerReport } from './powercard-metadata-sanitizer';
import { runFreshnessTest, type FreshnessTestReport } from './freshness-test';
import { runSwapTest, type SwapTestReport } from './swap-test';

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
  advisoryResult: 'pass' | 'fail';
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
    wordCountMatchesValidator: boolean;
    wordBandThinFail: boolean;
    identicalGenderChipFail: boolean;
  };
  failures: string[];
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
  swapTest: SwapTestReport;
  freshnessTest: FreshnessTestReport;
  generatedAt: string;
}

function wordBand(direction: StoryDirection): { min: number; max: number; hardMax: number } {
  return directionWordBand(direction);
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
  const pages = parseStoryPages(args.storyMarkdown);
  const warnings: string[] = [];
  const failures: string[] = [];
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
    const proseOnly = pageProseOnly(body);
    const wc = countPageWords(proseOnly);
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
    const { malformed, identical } = analyzeGenderChips(proseOnly);
    if (malformed.length) warnings.push(`Page ${page}: malformed chips — ${malformed.join(', ')}`);
    if (identical.length) {
      failures.push(`Page ${page}: identical gender chip options — ${identical.join(', ')}`);
    }

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

  const hasYaml = hasValidYamlFrontmatter(args.storyMarkdown);
  if (!hasYaml) warnings.push('Missing YAML frontmatter block (--- ... ---)');

  const wordCountLinePresent = /WORD_COUNT\s*:/i.test(args.storyMarkdown);
  const lineCounts = parseWordCountLine(args.storyMarkdown);
  const validatorCounts = pageRows.map((p) => p.wordCount);
  const wordCountMatchesValidator =
    lineCounts !== null &&
    lineCounts.length === validatorCounts.length &&
    lineCounts.every((n, i) => n === validatorCounts[i]);
  if (wordCountLinePresent && !wordCountMatchesValidator) {
    warnings.push(
      `WORD_COUNT line [${lineCounts?.join(', ') ?? '?'}] !== validator [${validatorCounts.join(', ')}]`
    );
  }

  const belowMinCount = pageRows.filter((p) => p.bandStatus === 'below').length;
  const wordBandThinFail =
    pageRows.length > 0 &&
    belowMinCount / pageRows.length > WORD_BAND_THIN_FAIL_MAJORITY;
  if (wordBandThinFail) {
    failures.push(
      `WORD_BAND thinness gate FAIL: ${belowMinCount}/${pageRows.length} pages below ${band.min} words (>25% threshold)`
    );
  }

  const identicalGenderChipFail = pageRows.some((p) => p.identicalChipPairs.length > 0);
  const advisoryResult = failures.length > 0 ? 'fail' : 'pass';

  return {
    status: 'advisory_deterministic',
    notARealGate: true,
    advisoryResult,
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
      wordCountMatchesValidator,
      wordBandThinFail,
      identicalGenderChipFail,
    },
    failures,
    warnings,
    hardMaxWarnings,
  };
}

function applyPostProcessValidatorFailures(
  report: Run1ValidatorReport,
  args: {
    enrichReport?: ThinPageEnrichReport;
    chipRepairReport?: GenderChipRepairReport;
    chipNormalizeReport?: ChipNormalizeReport;
    chipSafety?: ChipSafetyReport;
    hebrewSanity?: HebrewSanityReport;
    powerCardSanitizer?: PowerCardSanitizerReport;
  }
): Run1ValidatorReport {
  const failures = [...report.failures];

  if (args.enrichReport?.enrichOvershootFail) {
    const pages = args.enrichReport.enrichOvershoot.map((o) => `p${o.page}=${o.wordCount}`).join(', ');
    failures.push(`ENRICH_OVERSHOOT: ${pages} (limit ${args.enrichReport.enrichHardMax})`);
  }
  if (args.enrichReport?.underFloorAfterEnrichFail) {
    failures.push(
      `ENRICH_UNDER_FLOOR: pages ${args.enrichReport.underFloorAfterEnrich.join(', ')} still below ${args.enrichReport.floorWords} after one enrich pass`
    );
  }
  if (args.chipNormalizeReport?.advisoryFail) {
    for (const u of args.chipNormalizeReport.unrepaired) {
      failures.push(`CHIP_NORMALIZE unrepaired p${u.page}: ${u.token} (${u.reason})`);
    }
  }
  if (args.chipSafety?.advisoryFail) {
    for (const h of args.chipSafety.hits) {
      failures.push(`CHIP_SAFETY p${h.page} ${h.field}: ${h.token} (${h.reason})`);
    }
  }
  if (args.chipRepairReport?.unrepaired.length) {
    for (const u of args.chipRepairReport.unrepaired) {
      failures.push(`Page ${u.page}: unrepaired chip — ${u.chip}`);
    }
  }
  if (args.hebrewSanity?.advisoryFail) {
    const tokens = args.hebrewSanity.hits.map((h) => `p${h.page}:${h.token}`).join(', ');
    failures.push(`HEBREW_SANITY suspicious tokens: ${tokens}`);
  }
  if (args.powerCardSanitizer?.advisoryFail) {
    const items = args.powerCardSanitizer.hits
      .map((h) => `${h.field}${h.stepIndex != null ? `[${h.stepIndex}]` : ''}:${h.reason}`)
      .join(', ');
    failures.push(`POWERCARD_SANITIZER: ${items}`);
  }

  return {
    ...report,
    failures,
    advisoryResult: failures.length > 0 ? 'fail' : 'pass',
    formatChecks: {
      ...report.formatChecks,
      identicalGenderChipFail: report.pages.some((p) => p.identicalChipPairs.length > 0),
    },
  };
}

export async function buildRun1AdvisoryBundle(args: {
  scenario: Scenario;
  storyMarkdown: string;
  runLabel?: string;
  judgeModel?: string;
  enrichReport?: ThinPageEnrichReport;
  chipRepairReport?: GenderChipRepairReport;
  chipNormalizeReport?: ChipNormalizeReport;
  chipSafety?: ChipSafetyReport;
  proofreadReport?: ProofreadReport;
  hebrewSanity?: HebrewSanityReport;
  powerCardSanitizer?: PowerCardSanitizerReport;
}): Promise<Run1AdvisoryBundle> {
  const storyBody = extractStoryBodyFromMarkdown(args.storyMarkdown);
  const craftV21 = await runCraftRubricTestV21({
    storyBody,
    modelId: args.judgeModel,
  });

  const validators = applyPostProcessValidatorFailures(
    runDeterministicValidators({
      storyMarkdown: args.storyMarkdown,
      direction: args.scenario.direction,
      expectedPages: args.scenario.beatCount,
    }),
    {
      enrichReport: args.enrichReport,
      chipRepairReport: args.chipRepairReport,
      chipNormalizeReport: args.chipNormalizeReport,
      chipSafety: args.chipSafety,
      hebrewSanity: args.hebrewSanity,
      powerCardSanitizer: args.powerCardSanitizer,
    }
  );

  const [swapTest, freshnessTest] = await Promise.all([
    runSwapTest({
      storyMarkdown: args.storyMarkdown,
      companionId: args.scenario.companionId,
      modelId: args.judgeModel,
    }),
    runFreshnessTest({
      storyMarkdown: args.storyMarkdown,
      candidateId: args.scenario.id,
      companionId: args.scenario.companionId,
      modelId: args.judgeModel,
      excludeSelfFromCorpus: true,
    }),
  ]);

  return {
    runLabel: args.runLabel ?? 'phase-b-run-1-canary',
    scenarioId: args.scenario.id,
    companionId: args.scenario.companionId,
    direction: args.scenario.direction,
    craftV21,
    validators,
    swapTest,
    freshnessTest,
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
