import { validateStory } from '@/lib/story-validators';
import type { ValidationReport } from '@/lib/story-validators';
import { formatEditorialSummary } from '../editorial/summary';
import { isEditorialQaEnabled, MAX_EDITORIAL_REPAIR_ATTEMPTS } from '../editorial/config';
import type { EditorialReportRuntime } from '../editorial/schemas';
import type { StoryGeneratorLLM } from '../llm';
import type { QALogHandle } from '../qa-logger';
import type { FinalStoryStatus, GenerateInput, Plan, ReviewReason } from '../types';
import { runEditorialQA, runEditorialRevalidate } from './editorial-qa';
import { runEditorialRepair } from './editorial-repair';
import { buildValidationContext } from './validation-context';

export interface EditorialPipelineResult {
  storyMarkdown: string;
  editorialReport: EditorialReportRuntime;
  finalStatus: FinalStoryStatus;
  reviewReason: ReviewReason;
  editorialQaCostUsd: number;
  editorialRepairCostUsd: number;
  editorialQaModel: string;
  editorialRepairModel: string;
  editorialRepairAttempts: number;
  reviewRequired: boolean;
}

function needsEditorialRepair(report: EditorialReportRuntime): boolean {
  if (report.verdict === 'NEEDS_REPAIR') return true;
  return report.issues.some(
    (i) =>
      !i._repairedDeterministically &&
      !i._unmatchedQuote &&
      (i.severity === 'BLOCKING' || i.severity === 'MAJOR')
  );
}

function resolveFinalStatus(
  report: EditorialReportRuntime,
  reviewRequired: boolean
): FinalStoryStatus {
  if (report.verdict === 'REJECT') return 'REJECTED_EDITORIAL';
  if (reviewRequired || report.verdict === 'NEEDS_REPAIR') return 'REVIEW_REQUIRED';
  return 'READY';
}

export async function runEditorialPipeline(args: {
  storyMarkdown: string;
  plan: Plan;
  input: GenerateInput;
  validationReport: ValidationReport;
  log: QALogHandle;
  llm?: StoryGeneratorLLM;
  storyId?: string;
}): Promise<EditorialPipelineResult> {
  let storyMarkdown = args.storyMarkdown;
  let editorialQaCostUsd = 0;
  let editorialRepairCostUsd = 0;
  let editorialRepairAttempts = 0;
  let editorialQaModel = 'disabled';
  let editorialRepairModel = '';
  let reviewRequired = false;
  let reviewReason: ReviewReason = 'none';

  if (!isEditorialQaEnabled()) {
    const revalidate = runEditorialRevalidate(storyMarkdown, args.input.companionId, {
      naturalHebrew: 5,
      directionFit: 5,
      motifConsistency: 5,
      continuity: 5,
      readAloud: 5,
      ageFit: 5,
    });
    const report = revalidate.report;
    reviewRequired = revalidate.reviewRequired;
    const finalStatus = resolveFinalStatus(report, reviewRequired);

    args.log.recordEditorialQA(report, {
      zodParseFailed: false,
      reviewRequired,
      prescanCount: report.issues.length,
      model: 'disabled',
      costUsd: 0,
    });
    args.log.recordEditorialSummary(
      formatEditorialSummary({
        storyId: args.storyId ?? 'story',
        report,
        editorialQaCostUsd: 0,
        editorialRepairCostUsd: 0,
        editorialQaModel: 'disabled',
        editorialRepairModel: '',
        orchestrationStatus: finalStatus,
      })
    );

    return {
      storyMarkdown,
      editorialReport: report,
      finalStatus,
      reviewReason: finalStatus === 'READY' ? 'none' : 'unmatched_quote',
      editorialQaCostUsd: 0,
      editorialRepairCostUsd: 0,
      editorialQaModel: 'disabled',
      editorialRepairModel: '',
      editorialRepairAttempts: 0,
      reviewRequired,
    };
  }

  let qa = await runEditorialQA(storyMarkdown, args.plan, args.input, args.llm);
  editorialQaCostUsd += qa.llmCostUsd;
  editorialQaModel = qa.model;
  reviewRequired = qa.reviewRequired;
  let report = qa.report;

  // v0.2.7: track reason for any non-READY status
  if (qa.zodParseFailed) reviewReason = 'zod_parse_failed';
  else if (qa.reviewRequired) reviewReason = 'unmatched_quote';

  if (report.verdict === 'REJECT') {
    reviewReason = 'editor_rejected';
    const finalStatus = 'REJECTED_EDITORIAL';
    args.log.recordEditorialQA(report, {
      zodParseFailed: qa.zodParseFailed,
      reviewRequired: true,
      prescanCount: qa.prescanIssues.length,
      model: qa.model,
      costUsd: qa.llmCostUsd,
    });
    args.log.recordEditorialSummary(
      formatEditorialSummary({
        storyId: args.storyId ?? 'story',
        report,
        editorialQaCostUsd,
        editorialRepairCostUsd,
        editorialQaModel,
        editorialRepairModel,
        orchestrationStatus: finalStatus,
      })
    );
    return {
      storyMarkdown,
      editorialReport: report,
      finalStatus,
      reviewReason,
      editorialQaCostUsd,
      editorialRepairCostUsd,
      editorialQaModel,
      editorialRepairModel,
      editorialRepairAttempts,
      reviewRequired: true,
    };
  }

  if (needsEditorialRepair(report) && editorialRepairAttempts < MAX_EDITORIAL_REPAIR_ATTEMPTS) {
    editorialRepairAttempts++;
    const repair = await runEditorialRepair(
      storyMarkdown,
      report.issues,
      args.plan,
      args.input,
      editorialRepairAttempts,
      args.llm
    );
    editorialRepairCostUsd += repair.llmCostUsd;
    editorialRepairModel = repair.model;
    storyMarkdown = repair.storyMarkdown;

    args.log.recordEditorialRepair(editorialRepairAttempts, storyMarkdown, {
      phase1Fixed: repair.phase1Fixed,
      phase2Used: repair.phase2Used,
      diffRatioExceeded: repair.diffRatioExceeded,
      costUsd: repair.llmCostUsd,
    });

    // v0.2.8: After a repair attempt, RESET reviewRequired/reason so we evaluate based
    // on the post-repair state, NOT the pre-repair issues. Otherwise we get stuck:
    // initial QA had unmatched_quote → Phase 1 cleaned everything → revalidate clean → but
    // the old reviewRequired flag was sticky → story marked REVIEW_REQUIRED with 0 issues.
    // Only persistent reasons (diff_ratio, repair_scope, post_repair) should re-fire below.
    reviewRequired = false;
    reviewReason = 'none';

    if (repair.diffRatioExceeded) {
      reviewRequired = true;
      reviewReason = 'diff_ratio_exceeded';
    }

    const context = buildValidationContext(args.plan, args.input);
    const tech = validateStory({
      storyMarkdown,
      mode: 'production',
      context,
    });
    args.log.recordValidation(100 + editorialRepairAttempts, tech);

    if (tech.verdict !== 'PASS') {
      reviewRequired = true;
      // Check if this is a repair scope violation (modeCompliance/repairRegression only)
      const repairScopeOnly = tech.findings.every(
        (f) =>
          f.severity !== 'BLOCKING' ||
          f.validator === 'modeCompliance' ||
          f.validator === 'repairRegression'
      );
      if (repairScopeOnly && reviewReason === 'none') {
        reviewReason = 'repair_scope_violation';
      } else if (reviewReason === 'none') {
        reviewReason = 'post_repair_not_ready';
      }
    }

    const revalidate = runEditorialRevalidate(storyMarkdown, args.input.companionId, report.scores);
    report = revalidate.report;
    if (revalidate.reviewRequired) {
      reviewRequired = true;
      if (reviewReason === 'none') reviewReason = 'unmatched_quote';
    }

    if (needsEditorialRepair(report) && repair.phase1Fixed === 0 && !repair.phase2Used) {
      reviewRequired = true;
      if (reviewReason === 'none') reviewReason = 'post_repair_not_ready';
    }
  }

  // v0.2.8 — FINAL CONSISTENCY CHECK
  // Prevents the impossible state "reviewReason=unmatched_quote AND unmatched=0".
  // Initial qa.reviewRequired may have set reviewReason early; if final state is clean,
  // clear the flag. This is the post-state authority.
  const finalUnmatchedCount = report.issues.filter((i) => i._unmatchedQuote).length;
  if (reviewReason === 'unmatched_quote' && finalUnmatchedCount === 0) {
    reviewRequired = false;
    reviewReason = 'none';
  }
  // Invariant: a non-'none' reviewReason MUST have an observable cause in the final report.
  // If we set unmatched_quote but no unmatched issues remain, that's a stale flag.

  const finalStatus = resolveFinalStatus(report, reviewRequired);

  args.log.recordEditorialQA(report, {
    zodParseFailed: qa.zodParseFailed,
    reviewRequired,
    prescanCount: qa.prescanIssues.length,
    model: editorialQaModel,
    costUsd: editorialQaCostUsd,
  });
  args.log.recordEditorialSummary(
    formatEditorialSummary({
      storyId: args.storyId ?? 'story',
      report,
      editorialQaCostUsd,
      editorialRepairCostUsd,
      editorialQaModel,
      editorialRepairModel,
      orchestrationStatus: finalStatus,
    })
  );

  return {
    storyMarkdown,
    editorialReport: report,
    finalStatus,
    reviewReason: finalStatus === 'READY' ? 'none' : reviewReason,
    editorialQaCostUsd,
    editorialRepairCostUsd,
    editorialQaModel,
    editorialRepairModel,
    editorialRepairAttempts,
    reviewRequired,
  };
}
