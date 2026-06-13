import { validateStory } from '@/lib/story-validators';
import { resolvePageCount } from '../data/direction-dna';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';
import { startQALog } from '../qa-logger';
import {
  FALLBACK_ENABLED,
  GeneratorError,
  type FinalStoryStatus,
  type GenerateInput,
  type GenerateOutput,
  type GeneratorDependencies,
} from '../types';
import { GENERATOR_VERSION, PROMPT_VERSION, VALIDATOR_VERSION } from '../versions';
import {
  autoFixCompanionMutations,
  enforceCanonicalFrontmatter,
  fixEnglishLeaks,
  stripBeatLabels,
  tryAutoNameFixFromReport,
} from './auto-fixes';
import { runDraft } from './draft';
import { runPlan } from './plan';
import { runRepair } from './repair';
import { runEditorialPipeline } from './run-editorial-pipeline';
import { validatePlan } from './validatePlan';
import { buildValidationContext } from './validation-context';
import { isEditorialQaEnabled } from '../editorial/config';
import { generateStoryFromRecipe } from './orchestrate-recipe';
import { isRecipeModeEnabled } from '../recipes';

/**
 * DEV-ONLY orchestrator for lib/story-generator — see index.ts golden-path note.
 * Production story serve path: story-bank-loader + chunk-runner (not this module).
 *
 * v0.4.5 — Plan fallback injection.
 * When the plan-level companion-gate fails twice, inject a deterministic
 * companion action so the Author has explicit guidance on where to place
 * the companion. Avoids losing a story to plan-retry failure when the
 * issue is just "model didn't put Bolly in slot N".
 */
function inferCompanionInjection(companionId: string): string {
  switch (companionId) {
    case 'bolly_armadillo':
      return 'בּוֹלִי התגלגל אל קצה השמיכה. טוּמְפּ קטן נשמע.';
    case 'bat_lily':
      return 'לִילִי תלויה על קצה המדף. ששש קטן.';
    case 'chameleon_koko':
      return 'קִים על הקיר ליד נועה. התיק הקטן בכתף נשאר.';
    default:
      return 'המלווה נכנס לסיפור.';
  }
}

/** Stage F: Plan → Draft → Validate → Repair (max 2) → ship or throw. */
export async function generateStory(
  input: GenerateInput,
  deps: GeneratorDependencies = {}
): Promise<GenerateOutput> {
  input = normalizeGenerateInput(input);
  const llm = deps.llm ?? getDefaultLLM();

  // v0.5 — Recipe-mode early branch. STORY_RECIPE_MODE=on activates a
  // separate pipeline that skips Plan LLM and Editorial Repair. Returns
  // null when no Recipe matches the input → fall through to legacy.
  if (isRecipeModeEnabled()) {
    const recipeOutput = await generateStoryFromRecipe(input, llm);
    if (recipeOutput) return recipeOutput;
  }

  const started = Date.now();
  const log = startQALog(input);
  log.recordInput(input);

  let costUsd = 0;
  let llmCalls = 0;
  let modelVersion = '';
  const modelName = process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest';

  // Stage A + B
  let { plan, llmCostUsd, modelVersion: mv } = await runPlan(input, undefined, llm);
  costUsd += llmCostUsd;
  llmCalls++;
  modelVersion = mv;
  log.recordPlan(plan, []);

  let planValidation = validatePlan(plan, input);
  log.recordPlan(plan, planValidation.warnings);
  log.recordPlanValidation(planValidation.ok, planValidation.reason);

  if (!planValidation.ok) {
    const retry = await runPlan(input, planValidation.reason, llm);
    costUsd += retry.llmCostUsd;
    llmCalls++;
    modelVersion = retry.modelVersion;
    plan = retry.plan;
    planValidation = validatePlan(plan, input);
    log.recordPlan(plan, planValidation.warnings);
    log.recordPlanValidation(planValidation.ok, planValidation.reason);
    if (!planValidation.ok) {
      // v0.4.5 — Plan fallback injection.
      // If the plan failed twice on the companion-by-page gate, inject a
      // deterministic companion line into the first eligible page instead
      // of throwing. The Author still owns the prose; we just guarantee
      // the planning beatMap has the companion as subject in time.
      const reasonStr = planValidation.reason ?? '';
      const isCompanionGate = /Companion must be the explicit subject/i.test(reasonStr);
      if (isCompanionGate && plan.beatMap.length > 0) {
        const targetPage = input.direction === 'fantasy' ? 1 : input.direction === 'adventure' ? 2 : 3;
        const beat = plan.beatMap.find((b) => b.pageNumber === targetPage) ?? plan.beatMap[0];
        const injection = inferCompanionInjection(input.companionId);
        beat.companionAction = injection;
        planValidation = validatePlan(plan, input);
        log.recordPlan(plan, planValidation.warnings);
        log.recordPlanValidation(planValidation.ok, planValidation.reason);
        console.log(
          `[orchestrate] Plan fallback: injected "${injection}" on page ${targetPage} (${input.direction})`
        );
      }
      if (!planValidation.ok) {
        log.markFailure('Plan invalid after retry', undefined);
        throw new GeneratorError('PLAN_INVALID', planValidation.reason ?? 'unknown');
      }
    }
  }

  // Stage C
  const draftResult = await runDraft(plan, input, llm);
  let storyMarkdown = draftResult.storyMarkdown;
  const autoInjections = draftResult.autoInjections;
  costUsd += draftResult.llmCostUsd;
  llmCalls++;
  modelVersion = draftResult.modelVersion;

  // v0.2.5: Canonical frontmatter enforcement.
  // Draft LLM kept inventing direction/companionId values. Replace deterministically.
  const fmFix = enforceCanonicalFrontmatter(storyMarkdown, input);
  if (fmFix.changedFields.length > 0) {
    storyMarkdown = fmFix.storyMarkdown;
    console.log(
      `[orchestrate] frontmatter normalized — fields fixed: ${fmFix.changedFields.join(', ')}`
    );
  }

  // v0.2.2: Deterministic post-draft mutation fix.
  // Known name typos (שולי → בּוֹלִי, etc.) are fixed in code BEFORE first validation.
  // Cheaper + safer than an LLM repair round.
  const preFix = autoFixCompanionMutations(storyMarkdown, input.companionId);
  if (preFix.replacementCount > 0) {
    storyMarkdown = preFix.storyMarkdown;
    console.log(
      `[orchestrate] preemptive auto-fix replaced ${preFix.replacementCount} mutation(s): ${preFix.replacedTokens.join(', ')}`
    );
  }

  // v0.2.5.1: English leak fixes (lashes → ריסים, etc.). Cheap, deterministic,
  // catches the common Draft slip of dropping English nouns into Hebrew prose.
  const engFix = fixEnglishLeaks(storyMarkdown);
  if (engFix.replacementCount > 0) {
    storyMarkdown = engFix.storyMarkdown;
    console.log(
      `[orchestrate] English leak fix: ${engFix.replacementCount} replacement(s) — ${engFix.replacedTokens.join(', ')}`
    );
  }

  // v0.3.5: Strip leaked [beat-id] planning labels from prose. Safety net for
  // the model copying procedureMoment bracket prefixes into the story text.
  const beatFix = stripBeatLabels(storyMarkdown);
  if (beatFix.strippedCount > 0) {
    storyMarkdown = beatFix.storyMarkdown;
    console.log(
      `[orchestrate] Stripped ${beatFix.strippedCount} leaked beat label(s) from prose`
    );
  }

  log.recordDraft(storyMarkdown);

  const context = buildValidationContext(plan, input);

  // Stage D + E
  let repairAttempts = 0;
  let previousForRepair = storyMarkdown;
  let report = validateStory({
    storyMarkdown,
    mode: 'production',
    context,
  });
  log.recordValidation(1, report);

  // v0.2.2: If first validation fails ONLY on companionName, try reactive auto-fix
  // (uses excerpts from the report — safer than blanket mutation list).
  // Re-validate. If now PASS, skip LLM repair entirely.
  if (report.verdict === 'FAIL') {
    const reactiveFix = tryAutoNameFixFromReport(storyMarkdown, report, input.companionId);
    if (reactiveFix.fixed) {
      storyMarkdown = reactiveFix.storyMarkdown;
      console.log(
        `[orchestrate] reactive auto-fix replaced suspicious tokens: ${reactiveFix.replacedTokens.join(', ')}`
      );
      log.recordDraft(storyMarkdown);
      report = validateStory({ storyMarkdown, mode: 'production', context });
      log.recordValidation(1, report);
    }
  }

  while (report.verdict === 'FAIL' && repairAttempts < 2) {
    repairAttempts++;
    // v0.2.1: pass companionId so preserveList can include canonical name as anchor
    const repaired = await runRepair(
      previousForRepair,
      report,
      plan,
      repairAttempts,
      llm,
      input.companionId
    );
    costUsd += repaired.llmCostUsd;
    llmCalls++;
    modelVersion = repaired.modelVersion;
    log.recordRepair(repairAttempts, repaired.storyMarkdown);

    previousForRepair = storyMarkdown;
    storyMarkdown = repaired.storyMarkdown;

    // v0.2.5.1: re-normalize frontmatter after each repair too (defensive).
    // Repair LLM occasionally re-serializes frontmatter incorrectly.
    const postRepairFmFix = enforceCanonicalFrontmatter(storyMarkdown, input);
    if (postRepairFmFix.changedFields.length > 0) {
      storyMarkdown = postRepairFmFix.storyMarkdown;
      console.log(
        `[orchestrate] post-repair frontmatter normalized: ${postRepairFmFix.changedFields.join(', ')}`
      );
    }

    // v0.2.1: use the SAME preserveList + changeOnly that runRepair computed.
    // Previously this recomputed using the new `report` (which didn't exist yet),
    // creating inconsistency between what repair was told and what validator checked.
    report = validateStory({
      storyMarkdown,
      mode: 'repair',
      context,
      previousVersion: {
        storyMarkdown: previousForRepair,
        preserveList: repaired.preserveList,
        changeOnly: repaired.changeOnly,
      },
    });
    log.recordValidation(repairAttempts + 1, report);
  }

  if (report.verdict === 'PASS') {
    let finalStatus: FinalStoryStatus = 'READY';
    let reviewReason: GenerateOutput['reviewReason'] = 'none';
    let editorialReport: GenerateOutput['editorialReport'];
    let editorialQaCostUsd = 0;
    let editorialRepairCostUsd = 0;
    let editorialRepairAttempts = 0;

    if (isEditorialQaEnabled()) {
      const editorial = await runEditorialPipeline({
        storyMarkdown,
        plan,
        input,
        validationReport: report,
        log,
        llm,
        storyId: `${input.companionId}_${input.direction}`,
      });
      storyMarkdown = editorial.storyMarkdown;
      editorialReport = editorial.editorialReport;
      finalStatus = editorial.finalStatus;
      reviewReason = editorial.reviewReason;
      editorialQaCostUsd = editorial.editorialQaCostUsd;
      editorialRepairCostUsd = editorial.editorialRepairCostUsd;
      editorialRepairAttempts = editorial.editorialRepairAttempts;
      costUsd += editorialQaCostUsd + editorialRepairCostUsd;
      if (editorialRepairAttempts > 0) llmCalls++;
      if (editorial.editorialQaModel !== 'disabled') llmCalls++;
      // v0.4.2 — adopt the post-repair tech report as the final validation
      // truth. The pre-editorial `report` is stale once repair has run.
      if (editorial.postRepairTechReport) {
        report = editorial.postRepairTechReport;
      }
    }

    log.recordFinalStory(storyMarkdown);
    const qaLogPath = log.markPassed({
      repairAttempts,
      fallbackUsed: false,
      costUsd,
      durationMs: Date.now() - started,
      llmCalls,
      modelName,
      modelVersion,
      promptVersion: PROMPT_VERSION,
      validatorVersion: VALIDATOR_VERSION,
      generatorVersion: GENERATOR_VERSION,
      planQualityWarnings: planValidation.warnings,
      timestamp: new Date().toISOString(),
      // v0.4.6+ — surface deterministic injections so we can audit them.
      autoInjections: autoInjections?.map((a) => ({
        page: a.page,
        line: a.line,
        context: a.context,
        reason: a.reason,
      })),
    });
    return {
      storyMarkdown,
      plan,
      validationReport: report,
      repairAttempts,
      fallbackUsed: false,
      costUsd,
      qaLogPath,
      llmCalls,
      durationMs: Date.now() - started,
      finalStatus,
      reviewReason,
      editorialReport,
      editorialQaCostUsd,
      editorialRepairCostUsd,
      editorialRepairAttempts,
    };
  }

  if (FALLBACK_ENABLED) {
    throw new GeneratorError('VALIDATION_FAILED_AFTER_REPAIR', 'Fallback enabled but not implemented in MVP');
  }

  log.markFailure('Validation failed after repair', report);
  throw new GeneratorError(
    'VALIDATION_FAILED_AFTER_REPAIR',
    JSON.stringify(report.findings.filter((f) => f.severity === 'BLOCKING').slice(0, 12))
  );
}

export function normalizeGenerateInput(input: GenerateInput): GenerateInput {
  const pageCount = resolvePageCount(input.direction, input.pageCount);
  return { ...input, pageCount };
}
