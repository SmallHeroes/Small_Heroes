/**
 * Story-level SETTING LOCK derived from the challenge category.
 *
 * Principle: `direction` (bedtime/adventure/fantasy) controls FORMAT — length and
 * tone — NEVER location. bedtime ≠ bedroom. The story's location comes from the
 * scenario category and is injected into EVERY page prompt + cover, using the
 * same injection point/pattern as the story time-of-day lock.
 *
 * Extensible map: add categories as scenarios are launched. Categories without
 * an entry get no setting lock (location stays scene-driven).
 */

const SETTING_LOCK_BY_CATEGORY: Record<string, string> = {
  MEDICAL_PROCEDURE:
    'The entire story takes place in a calm pediatric clinic exam/waiting room. ' +
    'Subtle clinic cues: exam table, nurse, thermometer, clinic chair, soft wall posters. ' +
    'NOT a bedroom. NOT a home nursery. NOT a fantasy bedroom.',
};

export function resolveScenarioSettingLock(
  challengeCategory: string | null | undefined
): string | null {
  const key = challengeCategory?.trim().toUpperCase();
  if (!key) return null;
  return SETTING_LOCK_BY_CATEGORY[key] ?? null;
}

export function buildScenarioSettingLockBlock(
  challengeCategory: string | null | undefined
): string {
  const lock = resolveScenarioSettingLock(challengeCategory);
  if (!lock) return '';
  return `SCENARIO SETTING LOCK (story-level — every page and cover):\n${lock}`;
}
