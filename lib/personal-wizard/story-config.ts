import 'server-only';

export const STORY_PRICES = {
  // Standard short-context prices, verified 2026-09-29 on the official model pages.
  // https://developers.openai.com/api/docs/models/compare?model=gpt-6-sol
  'gpt-6-sol': { input: 2, output: 10 },
  'gpt-6-astra': { input: 10, output: 50 },
} as const;
export type StoryModel = keyof typeof STORY_PRICES;
export const STORY_LIMITS = {
  inputBytesPerCall: 64_000,
  planOutputTokens: 5000,
  manuscriptOutputTokens: 12_000,
  timeoutMs: 180_000,
  budgetUsd: 5,
  maxJobs: 10,
} as const;
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
export function storyReservationUsd(model: StoryModel): number {
  const price = STORY_PRICES[model];
  return (2 * STORY_LIMITS.inputBytesPerCall * price.input + (STORY_LIMITS.planOutputTokens + STORY_LIMITS.manuscriptOutputTokens) * price.output) / 1_000_000 * 1.1;
}
