/**
 * DEV-ONLY — Legacy MVP story generator (Plan → Draft → Validate → Repair).
 * NOT on the production golden path. Production orders use:
 * wizard matrix → POST /api/orders → chunked generation (chunk-runner) → story-bank-loader.
 * Entry point invoked only from app/api/debug/* and scripts/ — never from customer generate flow.
 */
export { generateStory, normalizeGenerateInput } from './stages/orchestrate';
export { runPlan } from './stages/plan';
export { validatePlan } from './stages/validatePlan';
export { runDraft } from './stages/draft';
export { runRepair, buildPreserveList, buildChangeOnly } from './stages/repair';
export { buildValidationContext } from './stages/validation-context';
export { OpenAIResponsesLLM, getDefaultLLM, setDefaultLLM, parseJsonFromLLM } from './llm';
export type { StoryGeneratorLLM, LLMCallOptions, LLMCallResult } from './llm';
export {
  GeneratorError,
  FALLBACK_ENABLED,
  type GenerateInput,
  type GenerateOutput,
  type Plan,
  type MvpCompanionId,
  type PlanQualityWarning,
  type PlanValidationResult,
  type GeneratorDependencies,
} from './types';
export { PAGE_COUNT_BY_DIRECTION, MOMENT_WINDOWS, getDirectionDNA } from './data/direction-dna';
export { MVP_MATRIX } from './data/mvp-matrix';
export { GENERATOR_VERSION, PROMPT_VERSION, VALIDATOR_VERSION } from './versions';
