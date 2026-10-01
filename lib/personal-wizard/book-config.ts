import 'server-only';
import { STORY_PRICES, storyReservationUsd, type StoryModel } from './story-config';
import { STORYBOARD_BOOK_CHECKS, STORYBOARD_FRAME_CHECKS } from './storyboard';
import { storyEditorReservationUsd } from './story-editor';

export const BOOK_LIMITS = { inputBytesPerCall: 128_000, maxBudgetUsd: 10, maxJobs: 10 } as const;
export const BOOK_SPREAD_COUNTS = [8, 12, 16] as const;
/** Initial headroom, NOT live adequacy proof. Caps include reasoning, not only JSON.
 * Keep reservation, runner and SDK on this one policy; never shrink it to fit money.
 */
export function personalBookOutputLimits(narrativeSpreads: number) {
  if (!(BOOK_SPREAD_COUNTS as readonly number[]).includes(narrativeSpreads)) throw Error('book_length_invalid');
  const frames = narrativeSpreads + 1;
  const checks = STORYBOARD_BOOK_CHECKS.length + STORYBOARD_FRAME_CHECKS.length * frames;
  return { storyboardOutputTokens: Math.max(32_000, 3_000 * frames),
    reviewOutputTokens: Math.ceil(Math.max(32_000, 16_000 + 512 * checks) / 1_000) * 1_000 };
}
export type PersonalBookSettings = { model: StoryModel; budgetUsd: number; maxJobs: number; operators: Set<string> };
export function personalBookReservationUsd(model: StoryModel, narrativeSpreads: number) {
  const price = STORY_PRICES[model];
  const limits = personalBookOutputLimits(narrativeSpreads);
  return storyReservationUsd(model, narrativeSpreads) + storyEditorReservationUsd(model, narrativeSpreads) + (2 * BOOK_LIMITS.inputBytesPerCall * price.input +
    (limits.storyboardOutputTokens + limits.reviewOutputTokens) * price.output) / 1_000_000 * 1.1;
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
