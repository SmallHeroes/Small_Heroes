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
import { repairPageLengthSpikes } from './page-level-repair';
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
  /**
   * v0.4.2 — the validation report from AFTER editorial repair, if repair ran.
   * Orchestrate uses this as the final validationReport instead of the stale
   * pre-editorial one. Critical: if this has BLOCKING (e.g. instructionLeakage
   * introduced by the repair), finalStatus is FAILED_TECHNICAL.
   */
  postRepairTechReport?: ValidationReport;
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
  reviewRequired: boolean,
  postRepairTechReport?: ValidationReport
): FinalStoryStatus {
  // v0.4.2 — INVARIANT: post-repair BLOCKING findings (e.g. instructionLeakage,
  // pageLengthSpike, narrativeVoiceConsistency) MUST escalate to FAILED_TECHNICAL.
  // These are not "review me" issues — they are "story is broken" issues that
  // a paying customer should never see.
  //
  // Previously they fell to REVIEW_REQUIRED because the only escalation path
  // here was editorial-side. Now structural BLOCKING wins.
  if (
    postRepairTechReport &&
    postRepairTechReport.findings.some((f) => f.severity === 'BLOCKING')
  ) {
    return 'FAILED_TECHNICAL';
  }
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
  let postRepairTechReport: ValidationReport | undefined;

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
    // v0.4.7 — Save pre-repair markdown so we can revert if repair regressed.
    // The story arrived here with tech.verdict === 'PASS' (orchestrate gate).
    // If post-repair tech fails AND page-level repair can't recover, we revert
    // to this clean pre-editorial state and ship REVIEW_REQUIRED (Y-lite WEAK).
    // Better than FAILED_TECHNICAL on a story whose Author output was clean.
    const preEditorialMarkdown = storyMarkdown;

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
    // v0.4.2 — capture post-repair tech for upstream FAILED_TECHNICAL escalation.
    postRepairTechReport = tech;
    args.log.recordValidation(100 + editorialRepairAttempts, tech);

    if (tech.verdict !== 'PASS') {
      // v0.4.4 — PAGE-LEVEL REPAIR.
      // Before escalating to FAILED_TECHNICAL, try regenerating just the
      // offending page(s) for pageLengthSpike findings. Adventure p12 / Fantasy
      // p20 batches showed: editorial repair occasionally dumps onto ONE page;
      // the rest of the story is correct. Page-level repair is the surgical fix.
      const spikeFindings = tech.findings
        .filter(
          (f) =>
            f.validator === 'pageLengthSpike' &&
            f.severity === 'BLOCKING' &&
            typeof f.page === 'number'
        )
        .map((f) => ({ page: f.page, message: f.message }));

      if (spikeFindings.length > 0 && args.llm) {
        console.log(
          `[page-level-repair] attempting on ${spikeFindings.length} page(s): ${spikeFindings.map((f) => f.page).join(', ')}`
        );
        const pageRepair = await repairPageLengthSpikes({
          storyMarkdown,
          spikeFindings,
          plan: args.plan,
          input: args.input,
          llm: args.llm,
        });
        editorialRepairCostUsd += pageRepair.costUsd;
        if (pageRepair.regeneratedPages.length > 0) {
          storyMarkdown = pageRepair.storyMarkdown;
          // Re-validate. If now PASS, the v0.4.1 Y-lite re-run downstream
          // will give us the final verdict on the repaired markdown.
          const techAfterPageRepair = validateStory({
            storyMarkdown,
            mode: 'production',
            context,
          });
          postRepairTechReport = techAfterPageRepair;
          args.log.recordValidation(200 + editorialRepairAttempts, techAfterPageRepair);
          console.log(
            `[page-level-repair] recovered ${pageRepair.regeneratedPages.length} page(s); post-repair tech verdict: ${techAfterPageRepair.verdict}`
          );
          if (techAfterPageRepair.verdict !== 'PASS') {
            reviewRequired = true;
          }
          // If PASS: don't set reviewRequired here. The v0.4.1 Y-lite re-run
          // block below will run on the new markdown and produce the final
          // verdict. No double-call to Y-lite.
        } else {
          reviewRequired = true;
        }
      } else {
        reviewRequired = true;
      }

      // Check if this is a repair scope violation (modeCompliance/repairRegression only)
      const stillTechReport = postRepairTechReport ?? tech;
      const repairScopeOnly = stillTechReport.findings.every(
        (f) =>
          f.severity !== 'BLOCKING' ||
          f.validator === 'modeCompliance' ||
          f.validator === 'repairRegression'
      );
      if (repairScopeOnly && reviewReason === 'none') {
        reviewReason = 'repair_scope_violation';
      } else if (stillTechReport.verdict !== 'PASS' && reviewReason === 'none') {
        reviewReason = 'post_repair_not_ready';
      }

      // v0.4.7 — REVERT-ON-REGRESSION.
      // If post-repair tech is STILL failing after page-level repair attempt,
      // the repair has clearly made things worse. Revert to the pre-editorial
      // markdown (which was clean — entered editorial with tech.verdict='PASS').
      // The story ships as REVIEW_REQUIRED with Y-lite WEAK signal, instead of
      // FAILED_TECHNICAL with corrupted content.
      //
      // Bedtime case (v0.4.6+ batch): editorial repair created bolly-with-wings,
      // 73-word page 3, hook-as-dialogue. Draft was clean. Better to ship the
      // clean draft for review than the corrupted output for trash.
      if (stillTechReport.verdict !== 'PASS' && preEditorialMarkdown) {
        console.warn(
          `[run-editorial-pipeline] v0.4.7 revert: post-repair tech failed after recovery attempts. Reverting to pre-editorial markdown.`
        );
        storyMarkdown = preEditorialMarkdown;
        // Re-validate the reverted markdown to confirm it's clean.
        const techAfterRevert = validateStory({
          storyMarkdown,
          mode: 'production',
          context,
        });
        postRepairTechReport = techAfterRevert;
        args.log.recordValidation(300 + editorialRepairAttempts, techAfterRevert);
        // Force REVIEW_REQUIRED (story is clean but Y-lite said WEAK pre-repair).
        reviewRequired = true;
        reviewReason = 'post_repair_not_ready';
      }
    }

    // v0.4.1 — POST-REPAIR Y-LITE RE-RUN.
    // Previously we only ran runEditorialRevalidate here, which re-checks
    // quote positions against the (stale, pre-repair) scores. That meant a
    // repair could ADD new poetic / anatomy-bleed / wrong-page-length content
    // and never get re-scored. Y-lite would say "WEAK" pre-repair, repair
    // would rewrite, and we'd ship READY using the stale pre-repair scores.
    //
    // Fix: run the FULL editorial QA again on the repaired markdown. This
    // dispatches to Y-lite if EDITORIAL_MODE=y-lite, so the two reviewers
    // re-score the post-repair text. finalStatus=READY is only earned if
    // the post-repair QA returns READY.
    const postRepairQA = await runEditorialQA(storyMarkdown, args.plan, args.input, args.llm);
    editorialQaCostUsd += postRepairQA.llmCostUsd;
    report = postRepairQA.report;
    if (postRepairQA.reviewRequired) {
      reviewRequired = true;
      if (reviewReason === 'none') reviewReason = 'unmatched_quote';
    }

    if (needsEditorialRepair(report) && repair.phase1Fixed === 0 && !repair.phase2Used) {
      reviewRequired = true;
      if (reviewReason === 'none') reviewReason = 'post_repair_not_ready';
    }
    if (report.verdict !== 'READY') {
      // v0.4.1 — explicit reason when post-repair reviewers still flag issues.
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

  const finalStatus = resolveFinalStatus(report, reviewRequired, postRepairTechReport);

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
    postRepairTechReport,
  };
}
