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
import { runDraft } from './draft';
import { runPlan } from './plan';
import { buildChangeOnly, buildPreserveList, runRepair } from './repair';
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

  while (report.verdict === 'FAIL' && repairAttempts < 2) {
    repairAttempts++;
    const repaired = await runRepair(previousForRepair, report, plan, repairAttempts, llm);
    costUsd += repaired.llmCostUsd;
    llmCalls++;
    modelVersion = repaired.modelVersion;
    log.recordRepair(repairAttempts, repaired.storyMarkdown);

    previousForRepair = storyMarkdown;
    storyMarkdown = repaired.storyMarkdown;

    report = validateStory({
      storyMarkdown,
      mode: 'repair',
      context,
      previousVersion: {
        storyMarkdown: previousForRepair,
        preserveList: buildPreserveList(plan),
        changeOnly: buildChangeOnly(report),
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
