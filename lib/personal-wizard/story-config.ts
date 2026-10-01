import 'server-only';

export const STORY_PRICES = {
  // Standard short-context prices, verified 2026-09-29 on the official model pages.
  // https://developers.openai.com/api/docs/models/compare?model=gpt-6-sol
  'gpt-6-sol': { input: 2, output: 10 },
  // Standard short-context prices verified 2026-10-01; no automatic model fallback.
  // https://developers.openai.com/api/docs/models/gpt-6.1-sol
  'gpt-6.1-sol': { input: 2, output: 10 },
  'gpt-6-astra': { input: 10, output: 50 },
} as const;
export type StoryModel = keyof typeof STORY_PRICES;
export const STORY_LIMITS = {
  inputBytesPerCall: 64_000,
  budgetUsd: 5,
  maxJobs: 10,
} as const;
/** Reasoning-inclusive headroom, not live adequacy proof. */
export function personalStoryOutputLimits(narrativeSpreads: number) {
  if (![8, 12, 16].includes(narrativeSpreads)) throw Error('story_length_invalid');
  const outputTokens = 4_000 + 500 * narrativeSpreads;
  return { planOutputTokens: outputTokens, manuscriptOutputTokens: outputTokens };
}
/** Conservative local ceiling, not a throughput SLA or cloud duration promise. */
export function generationTimeoutMs(outputTokens: number): number {
  if (!Number.isInteger(outputTokens) || outputTokens < 1 || outputTokens > 55_000) throw Error('generation_cap_invalid');
  return 60_000 + Math.ceil(outputTokens / 25) * 1_000;
}
export type StorySettings = { model: StoryModel; budgetUsd: number; maxJobs: number; operators: Set<string> };
export function resolveStorySettings(env: Readonly<Record<string, string | undefined>> = process.env): StorySettings | null {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true' || env.PERSONAL_WIZARD_STORY_WRITER !== 'true') return null;
  const model = env.PERSONAL_WIZARD_STORY_MODEL ?? '';
  if (!Object.prototype.hasOwnProperty.call(STORY_PRICES, model)) return null;
  const budgetUsd = Number(env.PERSONAL_WIZARD_STORY_BUDGET_USD);
  const maxJobs = Number(env.PERSONAL_WIZARD_STORY_MAX_JOBS);
  const operators = new Set((env.PERSONAL_WIZARD_STORY_OPERATORS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)));
  if (!operators.size || !Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > STORY_LIMITS.budgetUsd || !Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > STORY_LIMITS.maxJobs) return null;
  return { model: model as StoryModel, budgetUsd, maxJobs, operators };
}
export function storyReservationUsd(model: StoryModel, narrativeSpreads = 16): number {
  const price = STORY_PRICES[model];
  const limits = personalStoryOutputLimits(narrativeSpreads);
  return (2 * STORY_LIMITS.inputBytesPerCall * price.input + (limits.planOutputTokens + limits.manuscriptOutputTokens) * price.output) / 1_000_000 * 1.1;
}
