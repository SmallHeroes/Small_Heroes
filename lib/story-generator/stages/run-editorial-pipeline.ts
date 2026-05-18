import { validateStory } from '@/lib/story-validators';
import type { ValidationReport } from '@/lib/story-validators';
import { formatEditorialSummary } from '../editorial/summary';
import { isEditorialQaEnabled, MAX_EDITORIAL_REPAIR_ATTEMPTS } from '../editorial/config';
import type { EditorialReportRuntime } from '../editorial/schemas';
import type { StoryGeneratorLLM } from '../llm';
import type { QALogHandle } from '../qa-logger';
import type { FinalStoryStatus, GenerateInput, Plan } from '../types';
import { runEditorialQA, runEditorialRevalidate } from './editorial-qa';
import { runEditorialRepair } from './editorial-repair';
import { buildValidationContext } from './validation-context';

export interface EditorialPipelineResult {
  storyMarkdown: string;
  editorialReport: EditorialReportRuntime;
  finalStatus: FinalStoryStatus;
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

  if (report.verdict === 'REJECT') {
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

    if (repair.diffRatioExceeded) {
      reviewRequired = true;
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
    }

    const revalidate = runEditorialRevalidate(storyMarkdown, args.input.companionId, report.scores);
    report = revalidate.report;
    reviewRequired = reviewRequired || revalidate.reviewRequired;

    if (needsEditorialRepair(report) && repair.phase1Fixed === 0 && !repair.phase2Used) {
      reviewRequired = true;
    }
  }

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
    editorialQaCostUsd,
    editorialRepairCostUsd,
    editorialQaModel,
    editorialRepairModel,
    editorialRepairAttempts,
    reviewRequired,
  };
}
