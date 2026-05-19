/**
 * v0.5 Recipe-mode orchestrator.
 *
 * This is a SEPARATE entry point that runs only when STORY_RECIPE_MODE=on
 * AND a matching Recipe is registered. The default (legacy) pipeline in
 * orchestrate.ts is untouched.
 *
 * Scope of this file (#168):
 *   - Skip Plan LLM (use synthPlanFromRecipe instead).
 *   - Run Draft → tech validate → Y-lite, all via existing functions.
 *   - NO Editorial Repair LLM calls (neither runRepair nor runEditorialPipeline).
 *   - NO automatic reroll yet — that's #172.
 *
 * Behavior:
 *   - Tech FAIL after deterministic auto-fixes  → FAILED_TECHNICAL.
 *   - Y-lite NEEDS_REPAIR or REJECT             → REVIEW_REQUIRED.
 *   - Scores below qualityTarget thresholds     → REVIEW_REQUIRED.
 *   - All gates pass                            → READY.
 */

import { validateStory } from '@/lib/story-validators';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';
import { startQALog } from '../qa-logger';
import type {
  FinalStoryStatus,
  GenerateInput,
  GenerateOutput,
  ReviewReason,
} from '../types';
import {
  GENERATOR_VERSION,
  PROMPT_VERSION,
  VALIDATOR_VERSION,
} from '../versions';
import {
  autoFixCompanionMutations,
  enforceCanonicalFrontmatter,
  fixEnglishLeaks,
  stripBeatLabels,
} from './auto-fixes';
import { runStructuredDraft } from './structured-draft';
import { runYLiteQA } from './y-lite-qa';
import { buildValidationContext } from './validation-context';
import {
  ageToTier,
  loadRecipe,
  pickVariations,
  synthPlanFromRecipe,
} from '../recipes';
import type { ProductionRecipe } from '../recipes/recipe-types';

/**
 * Try to run a story through the recipe-mode pipeline.
 *
 * Returns null if no Recipe matches the input — the caller (orchestrate.ts)
 * is expected to fall through to the legacy pipeline in that case.
 *
 * Returns a GenerateOutput on success or controlled failure (FAILED_TECHNICAL
 * / REVIEW_REQUIRED). Only throws on infrastructure-level errors.
 */
export async function generateStoryFromRecipe(
  input: GenerateInput,
  llm?: StoryGeneratorLLM
): Promise<GenerateOutput | null> {
  const tier = ageToTier(input.childAge);
  if (!tier) {
    console.log(
      `[recipe-mode] childAge ${input.childAge} out of MVP tier range — falling through to legacy pipeline`
    );
    return null;
  }

  const recipe = loadRecipe({
    companionId: input.companionId,
    direction: input.direction,
    ageTier: tier,
  });
  if (!recipe) {
    console.log(
      `[recipe-mode] no Recipe for (${input.companionId}, ${input.direction}, age ${tier}) — falling through`
    );
    return null;
  }

  return runRecipeStory(recipe, input, llm ?? getDefaultLLM());
}

async function runRecipeStory(
  recipe: ProductionRecipe,
  input: GenerateInput,
  llm: StoryGeneratorLLM
): Promise<GenerateOutput> {
  const started = Date.now();
  const log = startQALog(input);
  log.recordInput(input);

  console.log(`[recipe-mode] using ${recipe.id} (v${recipe.meta.version})`);
  console.log(`[recipe-mode] skipped Plan LLM`);

  let costUsd = 0;
  let llmCalls = 0;
  let modelVersion = '';
  const modelName =
    process.env.GENERATOR_LLM_MODEL?.trim() || 'gpt-5-chat-latest';

  // ─── Stage A (replaces Plan LLM): variation pick + synth plan ───
  const variations = pickVariations(recipe, input);
  console.log(
    `[recipe-mode] variations: ${JSON.stringify(variations, null, 0)}`
  );
  const plan = synthPlanFromRecipe(recipe, variations);
  log.recordPlan(plan, []);
  log.recordPlanValidation(true, undefined);

  // ─── Stage B: Draft — structured Author with Recipe-aware prompt (#169) ───
  // We bypass runDraft (which would dispatch by DRAFT_MODE) and call
  // runStructuredDraft directly with a recipeContext. The Author then sees
  // the full PageCard contract per page (dramaticRole, requiredEvent,
  // childBodyState, companionAction, mustInclude, mustNotInclude, critical).
  const draftResult = await runStructuredDraft(plan, input, llm, {
    recipe,
    variations,
  });
  let storyMarkdown = draftResult.storyMarkdown;
  const autoInjections = draftResult.autoInjections;
  costUsd += draftResult.llmCostUsd;
  llmCalls++;
  modelVersion = draftResult.modelVersion;

  // ─── Stage C: Deterministic post-draft fixes (same as legacy) ───
  storyMarkdown = applyDeterministicFixes(storyMarkdown, input, '[recipe-mode]');
  log.recordDraft(storyMarkdown);

  // ─── Stage D: Tech validation ───
  const context = buildValidationContext(plan, input);
  const report = validateStory({
    storyMarkdown,
    mode: 'production',
    context,
  });
  log.recordValidation(1, report);

  // In recipe mode: NO LLM repair on tech fail. #172 will add reroll.
  if (report.verdict === 'FAIL') {
    console.warn(
      `[recipe-mode] tech FAIL — no LLM repair in recipe mode. Marking FAILED_TECHNICAL.`
    );
    log.recordFinalStory(storyMarkdown);
    const qaLogPath = log.markFailure('Tech validation failed (recipe mode)', report);
    return {
      storyMarkdown,
      plan,
      validationReport: report,
      repairAttempts: 0,
      fallbackUsed: false,
      costUsd,
      qaLogPath,
      llmCalls,
      durationMs: Date.now() - started,
      finalStatus: 'FAILED_TECHNICAL',
      reviewReason: 'none',
      editorialReport: undefined,
      editorialQaCostUsd: 0,
      editorialRepairCostUsd: 0,
      editorialRepairAttempts: 0,
    };
  }

  // ─── Stage E: Y-lite QA (no editorial repair — just scores) ───
  let editorialReport: GenerateOutput['editorialReport'];
  let editorialQaCostUsd = 0;
  let bookEditorAvg = 0;
  let resilienceAvg = 0;
  let yliteReviewRequired = false;
  let yliteReviewReason: ReviewReason = 'none';

  try {
    const ylite = await runYLiteQA(storyMarkdown, plan, input, llm);
    editorialReport = ylite.report;
    editorialQaCostUsd = ylite.llmCostUsd;
    costUsd += ylite.llmCostUsd;
    llmCalls += 2; // book editor + resilience reviewer
    if (ylite.modelVersion) modelVersion = ylite.modelVersion;
    bookEditorAvg = ylite.bookEditorAvg ?? 0;
    resilienceAvg = ylite.resilienceAvg ?? 0;

    if (ylite.reviewRequired) {
      yliteReviewRequired = true;
      yliteReviewReason = 'post_repair_not_ready';
    }
    if (ylite.report.verdict === 'REJECT') {
      yliteReviewRequired = true;
      yliteReviewReason = 'editor_rejected';
    }
  } catch (err) {
    console.error(`[recipe-mode] Y-lite QA threw — marking REVIEW_REQUIRED`, err);
    yliteReviewRequired = true;
    yliteReviewReason = 'exception';
  }

  // ─── Stage F: qualityTarget gate ───
  const { minBookScore, minResilienceScore } = recipe.qualityTarget;
  const bookScoreLow = bookEditorAvg > 0 && bookEditorAvg < minBookScore;
  const resScoreLow = resilienceAvg > 0 && resilienceAvg < minResilienceScore;

  let finalStatus: FinalStoryStatus = 'READY';
  let reviewReason: ReviewReason = 'none';

  if (yliteReviewRequired) {
    finalStatus = 'REVIEW_REQUIRED';
    reviewReason = yliteReviewReason;
  } else if (bookScoreLow || resScoreLow) {
    finalStatus = 'REVIEW_REQUIRED';
    reviewReason = 'editorial_qa_weak';
    console.warn(
      `[recipe-mode] qualityTarget miss — book=${bookEditorAvg} (min ${minBookScore}), ` +
        `resilience=${resilienceAvg} (min ${minResilienceScore})`
    );
  } else {
    console.log(
      `[recipe-mode] READY — book=${bookEditorAvg}, resilience=${resilienceAvg}`
    );
  }

  // ─── Stage G: finalize + log ───
  log.recordFinalStory(storyMarkdown);
  const qaLogPath = log.markPassed({
    repairAttempts: 0,
    fallbackUsed: false,
    costUsd,
    durationMs: Date.now() - started,
    llmCalls,
    modelName,
    modelVersion,
    promptVersion: PROMPT_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    generatorVersion: GENERATOR_VERSION,
    planQualityWarnings: [],
    timestamp: new Date().toISOString(),
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
    repairAttempts: 0,
    fallbackUsed: false,
    costUsd,
    qaLogPath,
    llmCalls,
    durationMs: Date.now() - started,
    finalStatus,
    reviewReason,
    editorialReport,
    editorialQaCostUsd,
    editorialRepairCostUsd: 0,
    editorialRepairAttempts: 0,
  };
}

/**
 * Apply the same deterministic post-Draft fixes the legacy pipeline applies.
 * This is allowed in recipe mode because they are CODE patches, not LLM
 * prose rewriting.
 */
function applyDeterministicFixes(
  storyMarkdown: string,
  input: GenerateInput,
  logPrefix: string
): string {
  let md = storyMarkdown;

  const fm = enforceCanonicalFrontmatter(md, input);
  if (fm.changedFields.length > 0) {
    md = fm.storyMarkdown;
    console.log(`${logPrefix} frontmatter normalized: ${fm.changedFields.join(', ')}`);
  }

  const mut = autoFixCompanionMutations(md, input.companionId);
  if (mut.replacementCount > 0) {
    md = mut.storyMarkdown;
    console.log(
      `${logPrefix} preemptive name fix: ${mut.replacementCount} replacement(s) — ${mut.replacedTokens.join(', ')}`
    );
  }

  const eng = fixEnglishLeaks(md);
  if (eng.replacementCount > 0) {
    md = eng.storyMarkdown;
    console.log(
      `${logPrefix} English leak fix: ${eng.replacementCount} replacement(s) — ${eng.replacedTokens.join(', ')}`
    );
  }

  const labels = stripBeatLabels(md);
  if (labels.strippedCount > 0) {
    md = labels.storyMarkdown;
    console.log(`${logPrefix} stripped ${labels.strippedCount} leaked beat label(s)`);
  }

  return md;
}
