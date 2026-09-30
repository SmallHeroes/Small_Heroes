import 'server-only';
import { STORY_PRICES, storyReservationUsd, type StoryModel } from './story-config';

export const BOOK_LIMITS = { inputBytesPerCall: 128_000, storyboardOutputTokens: 12_000,
  reviewOutputTokens: 6_000, timeoutMs: 180_000, maxBudgetUsd: 10, maxJobs: 10 } as const;
export type PersonalBookSettings = { model: StoryModel; budgetUsd: number; maxJobs: number; operators: Set<string> };
export function personalBookReservationUsd(model: StoryModel) {
  const price = STORY_PRICES[model];
  return storyReservationUsd(model) + (2 * BOOK_LIMITS.inputBytesPerCall * price.input +
    (BOOK_LIMITS.storyboardOutputTokens + BOOK_LIMITS.reviewOutputTokens) * price.output) / 1_000_000 * 1.1;
}
export function assertPersonalBookSettings(settings: PersonalBookSettings) {
  if (!settings || !Object.prototype.hasOwnProperty.call(STORY_PRICES, settings.model) || !Number.isFinite(settings.budgetUsd) ||
      settings.budgetUsd <= 0 || settings.budgetUsd > BOOK_LIMITS.maxBudgetUsd ||
      !Number.isInteger(settings.maxJobs) || settings.maxJobs < 1 || settings.maxJobs > BOOK_LIMITS.maxJobs ||
      !(settings.operators instanceof Set) || !settings.operators.size ||
      [...settings.operators].some(email => typeof email !== 'string' || email !== email.toLowerCase().trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    throw Error('book_settings_invalid');
  }
}
/** Separate, default-off operator pilot. No public endpoint is enabled by these settings. */
export function resolvePersonalBookSettings(env: Readonly<Record<string, string | undefined>> = process.env): PersonalBookSettings | null {
  if (env.PERSONAL_WIZARD_PREVIEW !== 'true' || env.PERSONAL_WIZARD_BOOK_RUNNER !== 'true') return null;
  const settings = { model: env.PERSONAL_WIZARD_BOOK_MODEL as StoryModel,
    budgetUsd: Number(env.PERSONAL_WIZARD_BOOK_BUDGET_USD), maxJobs: Number(env.PERSONAL_WIZARD_BOOK_MAX_JOBS),
    operators: new Set((env.PERSONAL_WIZARD_BOOK_OPERATORS ?? '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean)) };
  try { assertPersonalBookSettings(settings); return settings; } catch { return null; }
}
