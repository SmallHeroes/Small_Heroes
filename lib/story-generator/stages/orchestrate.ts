import { validateStory } from '@/lib/story-validators';
import { resolvePageCount } from '../data/direction-dna';
import { getDefaultLLM, type StoryGeneratorLLM } from '../llm';
import { startQALog } from '../qa-logger';
import {
  FALLBACK_ENABLED,
  GeneratorError,
  type GenerateInput,
  type GenerateOutput,
  type GeneratorDependencies,
} from '../types';
import { GENERATOR_VERSION, PROMPT_VERSION, VALIDATOR_VERSION } from '../versions';
import { autoFixCompanionMutations, tryAutoNameFixFromReport } from './auto-fixes';
import { runDraft } from './draft';
import { runPlan } from './plan';
import { runRepair } from './repair';
import { validatePlan } from './validatePlan';
import { buildValidationContext } from './validation-context';

/** Stage F: Plan → Draft → Validate → Repair (max 2) → ship or throw. */
export async function generateStory(
  input: GenerateInput,
  deps: GeneratorDependencies = {}
): Promise<GenerateOutput> {
  input = normalizeGenerateInput(input);
  const llm = deps.llm ?? getDefaultLLM();
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
      log.markFailure('Plan invalid after retry', undefined);
      throw new GeneratorError('PLAN_INVALID', planValidation.reason ?? 'unknown');
    }
  }

  // Stage C
  let { storyMarkdown, llmCostUsd: draftCost, modelVersion: draftMv } = await runDraft(plan, input, llm);
  costUsd += draftCost;
  llmCalls++;
  modelVersion = draftMv;

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

  log.recordFinalStory(storyMarkdown);

  if (report.verdict === 'PASS') {
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
