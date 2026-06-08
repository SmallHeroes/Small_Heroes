/**
 * Writer's Room bounded advisory loop — gates + taste judge + single rewrite max.
 *
 * Flow: draft → deterministic validators → proofread/sanitizer/chip safety/bare-child-gender
 *       → swapTest → freshnessTest → craft-v2.1 → taste-judge-v2 → route.
 */

import { runAuthorRewritePass, type AuthorRewriteReport } from './author-rewrite-pass';
import type { BareChildGenderReport } from './bare-child-gender';
import type { ChipNormalizeReport } from './chip-normalize';
import type { ChipSafetyReport } from './chip-safety';
import type { CraftRubricV21Report } from './craft-rubric-v2.1';
import type { FreshnessTestReport } from './freshness-test';
import type { GenderChipRepairReport } from './gender-chip-repair';
import type { HebrewSanityReport } from './hebrew-sanity';
import type { PowerCardSanitizerReport } from './powercard-metadata-sanitizer';
import {
  runPostRewritePipeline,
  runRevalidateOnlyPipeline,
} from './post-rewrite-pipeline';
import type { ProofreadReport } from './proofread-pass';
import type { Run1AdvisoryBundle } from './run1-advisory';
import type { SwapTestReport } from './swap-test';
import type { ThinPageEnrichReport } from './thin-page-enrich';
import {
  runRewritePreservationValidator,
  preservationBlocksShip,
  type RewritePreservationReport,
} from './rewrite-preservation-validator';
import {
  buildTasteContext,
  extractTasteProseFromMarkdown,
  runTasteJudge,
  type TasteJudgeReport,
  type TasteVerdict,
} from './taste-judge';
import {
  applyLexicalTerminalCap,
  lexicalRoutingSummary,
  type LexicalRoutingState,
} from './hebrew-lexical-routing';
import {
  runHebrewLexicalProofread,
  type HebrewLexicalProofreadReport,
} from './hebrew-lexical-proofread';
import type { Scenario, StoryOutline } from './story-generation-types';
import { DEFAULT_STORY_GEN_MODELS } from './story-generation-types';

export type WritersRoomTerminal =
  | 'bank_ready_candidate'
  | 'post_rewrite_bank_ready_candidate_needs_human_review'
  | 'strong_draft_needs_light_human_polish'
  | 'needs_human_review'
  | 'needs_human_review_or_reroll';

export interface WritersRoomStageReport {
  stage: string;
  pass: boolean;
  summary: string;
}

export interface WritersRoomGatePassResult {
  storyMarkdown: string;
  advisory: Run1AdvisoryBundle;
  taste: TasteJudgeReport;
  technicalFailures: string[];
  technicalPass: boolean;
  stages: WritersRoomStageReport[];
  chipNormalize: ChipNormalizeReport;
  chipRepair: GenderChipRepairReport;
  chipSafety: ChipSafetyReport;
  bareChildGender: BareChildGenderReport;
  hebrewSanity: HebrewSanityReport;
  powerCardSanitizer: PowerCardSanitizerReport;
  proofread?: ProofreadReport;
  thinPageEnrich?: ThinPageEnrichReport;
  hebrewLexical?: HebrewLexicalProofreadReport;
}

export interface WritersRoomBoundedLoopReport {
  scenarioId: string;
  companionId: string;
  direction: Scenario['direction'];
  terminal: WritersRoomTerminal;
  technicalPass: boolean;
  technicalFailures: string[];
  authorRewriteUsed: boolean;
  authorRewriteReport?: AuthorRewriteReport;
  tasteBefore?: TasteJudgeReport;
  tasteAfter?: TasteJudgeReport;
  finalTaste: TasteJudgeReport;
  craftV21: CraftRubricV21Report;
  swapTest: SwapTestReport;
  freshnessTest: FreshnessTestReport;
  stages: WritersRoomStageReport[];
  passLabel: 'initial' | 'post_rewrite';
  preservation?: RewritePreservationReport;
  /** Final story text after loop (post-rewrite if rewrite ran). */
  finalStoryMarkdown: string;
  generatedAt: string;
  /** Taste-based terminal before lexical routing cap. */
  tasteTerminal?: WritersRoomTerminal;
  /** Lexical routing applied to terminal (Step 4.4). */
  lexicalRouting?: LexicalRoutingState;
  hebrewLexical?: HebrewLexicalProofreadReport;
}

type PipelineResult = Awaited<ReturnType<typeof runPostRewritePipeline>>;

function collectTechnicalFailures(
  pipeline: PipelineResult,
  options?: { ignoreWordBandThinness?: boolean }
): string[] {
  let failures = [...pipeline.advisory.validators.failures];
  if (options?.ignoreWordBandThinness) {
    failures = failures.filter((f) => !f.startsWith('WORD_BAND thinness gate FAIL'));
  }
  if (pipeline.chipSafety.advisoryFail) {
    for (const h of pipeline.chipSafety.hits) {
      failures.push(`CHIP_SAFETY p${h.page} ${h.field}: ${h.token} (${h.reason})`);
    }
  }
  if (pipeline.bareChildGender.advisoryFail) {
    for (const h of pipeline.bareChildGender.failHits) {
      failures.push(`BARE_CHILD_GENDER p${h.page}: ${h.token} (${h.reason})`);
    }
  }
  if (pipeline.hebrewSanity.advisoryFail) {
    const tokens = pipeline.hebrewSanity.hits.map((h) => `p${h.page}:${h.token}`).join(', ');
    failures.push(`HEBREW_SANITY: ${tokens}`);
  }
  if (pipeline.powerCardSanitizer.advisoryFail) {
    for (const h of pipeline.powerCardSanitizer.hits) {
      failures.push(
        `POWERCARD_SANITIZER ${h.field}${h.stepIndex != null ? `[${h.stepIndex}]` : ''}: ${h.reason}`
      );
    }
  }
  if (pipeline.chipNormalize.advisoryFail) {
    for (const u of pipeline.chipNormalize.unrepaired) {
      failures.push(`CHIP_NORMALIZE unrepaired p${u.page}: ${u.token} (${u.reason})`);
    }
  }
  if (pipeline.chipRepair.unrepaired.length) {
    for (const u of pipeline.chipRepair.unrepaired) {
      failures.push(`CHIP_REPAIR unrepaired p${u.page}: ${u.chip}`);
    }
  }
  if (pipeline.thinPageEnrich?.enrichOvershootFail) {
    const pages = pipeline.thinPageEnrich.enrichOvershoot
      .map((o) => `p${o.page}=${o.wordCount}`)
      .join(', ');
    failures.push(`ENRICH_OVERSHOOT: ${pages}`);
  }
  if (pipeline.thinPageEnrich?.underFloorAfterEnrichFail) {
    failures.push(
      `ENRICH_UNDER_FLOOR: pages ${pipeline.thinPageEnrich.underFloorAfterEnrich.join(', ')}`
    );
  }
  return [...new Set(failures)];
}

function buildStageReports(
  pipeline: PipelineResult,
  taste: TasteJudgeReport,
  options?: { ignoreWordBandThinness?: boolean; hebrewLexical?: HebrewLexicalProofreadReport }
): WritersRoomStageReport[] {
  const technicalFailures = collectTechnicalFailures(pipeline, options);
  const stages: WritersRoomStageReport[] = [
    {
      stage: 'chip-normalize',
      pass: !pipeline.chipNormalize.advisoryFail,
      summary: `${pipeline.chipNormalize.fixCount} fixes, ${pipeline.chipNormalize.unrepaired.length} unrepaired`,
    },
    {
      stage: 'chip-repair',
      pass: pipeline.chipRepair.unrepaired.length === 0,
      summary: `${pipeline.chipRepair.totalRepaired} repaired, ${pipeline.chipRepair.unrepaired.length} unrepaired`,
    },
  ];

  if (pipeline.proofread) {
    stages.push({
      stage: 'proofread',
      pass: true,
      summary: `${pipeline.proofread.pagesTouched.length} pages touched`,
    });
  }

  stages.push(
    {
      stage: 'adventure-density',
      pass: !pipeline.adventureDensity.needsEnrich || Boolean(pipeline.thinPageEnrich),
      summary: `needsEnrich=${pipeline.adventureDensity.needsEnrich}, belowMin=${pipeline.adventureDensity.belowMinCount}/${pipeline.adventureDensity.totalPages}`,
    },
    {
      stage: 'powercard-sanitizer',
      pass: !pipeline.powerCardSanitizer.advisoryFail,
      summary: `${pipeline.powerCardSanitizer.hits.length} hits`,
    },
    {
      stage: 'hebrew-sanity',
      pass: !pipeline.hebrewSanity.advisoryFail,
      summary: `${pipeline.hebrewSanity.hitCount} suspicious tokens`,
    },
    {
      stage: 'chip-safety',
      pass: !pipeline.chipSafety.advisoryFail,
      summary: `${pipeline.chipSafety.hits.length} hits`,
    },
    {
      stage: 'bare-child-gender',
      pass: !pipeline.bareChildGender.advisoryFail,
      summary: `${pipeline.bareChildGender.failHits.length} fail, ${pipeline.bareChildGender.warningHits.length} warn`,
    },
    {
      stage: 'deterministic-validators',
      pass: pipeline.advisory.validators.advisoryResult === 'pass',
      summary:
        pipeline.advisory.validators.advisoryResult === 'pass'
          ? 'PASS'
          : `${technicalFailures.length} failure(s)`,
    },
    {
      stage: 'swap-test',
      pass: pipeline.advisory.swapTest.verdict !== 'fail',
      summary: `${pipeline.advisory.swapTest.verdict} (binding=${pipeline.advisory.swapTest.bindingScore})`,
    },
    {
      stage: 'freshness-test',
      pass: !['reroll', 'revise'].includes(pipeline.advisory.freshnessTest.recommendation),
      summary: `${pipeline.advisory.freshnessTest.recommendation} (shapeMax=${pipeline.advisory.freshnessTest.shapeOverlapMax})`,
    },
    {
      stage: 'craft-rubric-v2.1',
      pass: pipeline.advisory.craftV21.verdict !== 'fail',
      summary: `overall=${pipeline.advisory.craftV21.overall} ladder=${pipeline.advisory.craftV21.ladderPlacement} verdict=${pipeline.advisory.craftV21.verdict}`,
    },
    {
      stage: 'taste-judge-v2',
      pass: taste.verdict === 'BANK_READY' || taste.verdict === 'STRONG_DRAFT',
      summary: `${taste.verdict} (confidence=${taste.confidence})`,
    }
  );

  if (options?.hebrewLexical) {
    stages.push({
      stage: 'hebrew-lexical-routing',
      pass:
        options.hebrewLexical.routing.blockerCount === 0 &&
        options.hebrewLexical.routing.highSeverityProseReviewCount === 0,
      summary: lexicalRoutingSummary(options.hebrewLexical.routing),
    });
  }

  return stages;
}

async function runGatePass(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  runLabel: string;
  skipProofread?: boolean;
  skipAdventureEnrich?: boolean;
  ignoreWordBandThinness?: boolean;
  judgeModel?: string;
  draftModel?: string;
  skipLexical?: boolean;
}): Promise<WritersRoomGatePassResult> {
  let pipeline: PipelineResult;
  if (args.skipProofread) {
    pipeline = await runRevalidateOnlyPipeline({
      storyMarkdown: args.storyMarkdown,
      scenario: args.scenario,
      outline: args.outline,
      runLabel: args.runLabel,
      draftModel: args.draftModel,
      skipAdventureEnrich: args.skipAdventureEnrich,
    });
  } else {
    pipeline = await runPostRewritePipeline({
      storyMarkdown: args.storyMarkdown,
      scenario: args.scenario,
      outline: args.outline,
      runLabel: args.runLabel,
      judgeModel: args.judgeModel,
      draftModel: args.draftModel,
      skipAdventureEnrich: args.skipAdventureEnrich,
      skipProofread: false,
    });
  }

  const prose = extractTasteProseFromMarkdown(pipeline.storyMarkdown);
  const taste = await runTasteJudge({
    prose,
    context: buildTasteContext({
      companionId: args.scenario.companionId,
      direction: args.scenario.direction,
    }),
    modelId: args.judgeModel,
  });

  const hebrewLexical = args.skipLexical
    ? undefined
    : await runHebrewLexicalProofread({
        storyMarkdown: pipeline.storyMarkdown,
        mode: 'report_only',
        modelId: args.judgeModel,
      });

  const technicalFailures = collectTechnicalFailures(pipeline, {
    ignoreWordBandThinness: args.ignoreWordBandThinness,
  });
  const technicalPass = technicalFailures.length === 0;

  return {
    storyMarkdown: pipeline.storyMarkdown,
    advisory: pipeline.advisory,
    taste,
    technicalFailures,
    technicalPass,
    stages: buildStageReports(pipeline, taste, {
      ignoreWordBandThinness: args.ignoreWordBandThinness,
      hebrewLexical,
    }),
    chipNormalize: pipeline.chipNormalize,
    chipRepair: pipeline.chipRepair,
    chipSafety: pipeline.chipSafety,
    bareChildGender: pipeline.bareChildGender,
    hebrewSanity: pipeline.hebrewSanity,
    powerCardSanitizer: pipeline.powerCardSanitizer,
    proofread: args.skipProofread ? undefined : pipeline.proofread,
    thinPageEnrich: pipeline.thinPageEnrich,
    hebrewLexical,
  };
}

export function terminalFromPostRewrite(args: {
  tasteVerdict: TasteVerdict;
  technicalPass: boolean;
  preservation: RewritePreservationReport;
}): WritersRoomTerminal {
  if (!args.technicalPass || preservationBlocksShip(args.preservation)) {
    return 'needs_human_review';
  }

  switch (args.tasteVerdict) {
    case 'BANK_READY':
      return 'post_rewrite_bank_ready_candidate_needs_human_review';
    case 'STRONG_DRAFT':
      return 'strong_draft_needs_light_human_polish';
    case 'REWRITE':
    case 'HUMAN_REVIEW':
    case 'FAIL':
    default:
      return 'needs_human_review';
  }
}

export function terminalFromTaste(args: {
  tasteVerdict: TasteVerdict;
  technicalPass: boolean;
}): WritersRoomTerminal | 'needs_rewrite_pass' {
  if (!args.technicalPass) {
    if (args.tasteVerdict === 'FAIL') return 'needs_human_review_or_reroll';
    return 'needs_human_review';
  }

  switch (args.tasteVerdict) {
    case 'BANK_READY':
      return 'bank_ready_candidate';
    case 'STRONG_DRAFT':
      return 'strong_draft_needs_light_human_polish';
    case 'REWRITE':
      return 'needs_rewrite_pass';
    case 'HUMAN_REVIEW':
      return 'needs_human_review';
    case 'FAIL':
      return 'needs_human_review_or_reroll';
    default:
      return 'needs_human_review';
  }
}

function rewriteNotesFromTaste(taste: TasteJudgeReport): string[] {
  const notes: string[] = [];
  if (taste.rewriteInstruction?.length) notes.push(...taste.rewriteInstruction);
  if (taste.weakestPage.page) {
    notes.push(
      `Weakest page p${taste.weakestPage.page}: ${taste.weakestPage.reason}. Weakest line: "${taste.weakestLine}".`
    );
  }
  if (taste.reasons.length) notes.push(...taste.reasons.slice(0, 3));
  return [...new Set(notes.filter(Boolean))];
}

export async function runWritersRoomBoundedLoop(args: {
  storyMarkdown: string;
  scenario: Scenario;
  outline: StoryOutline;
  /** Override scenarioId in the report (e.g. probe routing ids). */
  reportId?: string;
  runLabel?: string;
  skipProofread?: boolean;
  skipAdventureEnrich?: boolean;
  /** Probe routing validation: thin craft-calibration bodies fail word-band only. */
  ignoreWordBandThinness?: boolean;
  /** Do not spend author rewrite (e.g. beautiful-but-wrong / engine-age risk). */
  blockAuthorRewrite?: boolean;
  judgeModel?: string;
  draftModel?: string;
}): Promise<WritersRoomBoundedLoopReport> {
  const runLabel = args.runLabel ?? 'writers-room-bounded-loop';
  const judgeModel = args.judgeModel ?? DEFAULT_STORY_GEN_MODELS.judgeModel;
  const draftModel = args.draftModel ?? DEFAULT_STORY_GEN_MODELS.draftModel;

  const initial = await runGatePass({
    storyMarkdown: args.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
    runLabel: `${runLabel}-initial`,
    skipProofread: args.skipProofread,
    skipAdventureEnrich: args.skipAdventureEnrich,
    ignoreWordBandThinness: args.ignoreWordBandThinness,
    judgeModel,
    draftModel,
  });

  const initialRoute = terminalFromTaste({
    tasteVerdict: initial.taste.verdict,
    technicalPass: initial.technicalPass,
  });

  const reportId = args.reportId ?? args.scenario.id;

  if (initialRoute !== 'needs_rewrite_pass' || args.blockAuthorRewrite) {
    const blockedRewrite =
      initialRoute === 'needs_rewrite_pass' && args.blockAuthorRewrite;
    const tasteTerminal: WritersRoomTerminal = blockedRewrite
      ? initial.taste.verdict === 'FAIL'
        ? 'needs_human_review_or_reroll'
        : 'needs_human_review'
      : (initialRoute as WritersRoomTerminal);
    const terminal = initial.hebrewLexical
      ? applyLexicalTerminalCap(tasteTerminal, initial.hebrewLexical.routing)
      : tasteTerminal;
    return {
      scenarioId: reportId,
      companionId: args.scenario.companionId,
      direction: args.scenario.direction,
      terminal,
      technicalPass: initial.technicalPass,
      technicalFailures: initial.technicalFailures,
      authorRewriteUsed: false,
      tasteBefore: blockedRewrite ? initial.taste : undefined,
      finalTaste: initial.taste,
      craftV21: initial.advisory.craftV21,
      swapTest: initial.advisory.swapTest,
      freshnessTest: initial.advisory.freshnessTest,
      stages: initial.stages,
      passLabel: 'initial',
      finalStoryMarkdown: initial.storyMarkdown,
      generatedAt: new Date().toISOString(),
      tasteTerminal,
      lexicalRouting: initial.hebrewLexical?.routing,
      hebrewLexical: initial.hebrewLexical,
    };
  }

  const { markdown: rewrittenMarkdown, report: authorRewriteReport } =
    await runAuthorRewritePass({
      storyMarkdown: initial.storyMarkdown,
      companionId: args.scenario.companionId,
      direction: args.scenario.direction,
      scenarioId: args.scenario.id,
      scenario: args.scenario,
      outline: args.outline,
      knownHumanNotes: rewriteNotesFromTaste(initial.taste),
      modelId: draftModel,
    });

  const postRewrite = await runGatePass({
    storyMarkdown: rewrittenMarkdown,
    scenario: args.scenario,
    outline: args.outline,
    runLabel: `${runLabel}-post-rewrite`,
    skipProofread: args.skipProofread,
    skipAdventureEnrich: args.skipAdventureEnrich,
    ignoreWordBandThinness: args.ignoreWordBandThinness,
    judgeModel,
    draftModel,
  });

  const preservation = await runRewritePreservationValidator({
    beforeMarkdown: initial.storyMarkdown,
    afterMarkdown: postRewrite.storyMarkdown,
    scenario: args.scenario,
    outline: args.outline,
    modelId: judgeModel,
  });

  const tasteTerminal = terminalFromPostRewrite({
    tasteVerdict: postRewrite.taste.verdict,
    technicalPass: postRewrite.technicalPass,
    preservation,
  });
  const terminal = postRewrite.hebrewLexical
    ? applyLexicalTerminalCap(tasteTerminal, postRewrite.hebrewLexical.routing)
    : tasteTerminal;

  return {
    scenarioId: reportId,
    companionId: args.scenario.companionId,
    direction: args.scenario.direction,
    terminal,
    technicalPass: postRewrite.technicalPass,
    technicalFailures: postRewrite.technicalFailures,
    authorRewriteUsed: true,
    authorRewriteReport,
    tasteBefore: initial.taste,
    tasteAfter: postRewrite.taste,
    finalTaste: postRewrite.taste,
    craftV21: postRewrite.advisory.craftV21,
    swapTest: postRewrite.advisory.swapTest,
    freshnessTest: postRewrite.advisory.freshnessTest,
    stages: [
      ...initial.stages.map((s) => ({
        ...s,
        stage: `initial/${s.stage}`,
      })),
      {
        stage: 'author-rewrite',
        pass: true,
        summary: `${authorRewriteReport.changedPages.length} pages changed`,
      },
      ...postRewrite.stages.map((s) => ({
        ...s,
        stage: `post-rewrite/${s.stage}`,
      })),
      {
        stage: 'rewrite-preservation-v1',
        pass: preservation.verdict === 'pass',
        summary: `${preservation.verdict} (${preservation.failureCodes.join(', ') || 'none'})`,
      },
    ],
    passLabel: 'post_rewrite',
    preservation,
    finalStoryMarkdown: postRewrite.storyMarkdown,
    generatedAt: new Date().toISOString(),
    tasteTerminal,
    lexicalRouting: postRewrite.hebrewLexical?.routing,
    hebrewLexical: postRewrite.hebrewLexical,
  };
}

export function formatWritersRoomRoutingRow(report: WritersRoomBoundedLoopReport): string {
  const taste = report.finalTaste;
  const quotable =
    taste.verdict === 'BANK_READY' && taste.quotableLines?.length
      ? taste.quotableLines.slice(0, 2).join(' / ')
      : '—';
  const rewrite =
    report.authorRewriteUsed && report.tasteBefore
      ? `${report.tasteBefore.verdict}→${taste.verdict}`
      : '—';
  return `| ${report.scenarioId} | ${report.terminal} | ${taste.verdict} | ${taste.confidence} | ${quotable} | ${rewrite} | tech=${report.technicalPass ? 'PASS' : 'FAIL'} |`;
}

export function formatWritersRoomRoutingTable(
  reports: WritersRoomBoundedLoopReport[]
): string {
  const header =
    '| story | terminal | taste | confidence | quotableLines | rewrite before→after | technical |';
  const sep =
    '| --- | --- | --- | --- | --- | --- | --- |';
  return [header, sep, ...reports.map(formatWritersRoomRoutingRow)].join('\n');
}
