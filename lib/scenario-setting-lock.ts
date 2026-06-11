/**
 * Story-level SETTING LOCK derived from the challenge category.
 *
 * Principle: `direction` (bedtime/adventure/fantasy) controls FORMAT — length and
 * tone — NEVER location. The story's location comes from the scenario category and
 * is injected into EVERY page prompt + cover, using the same injection point/pattern
 * as the story time-of-day lock.
 *
 * Setting lock is a default world anchor, not a cage: when a story declares an
 * explicit fantasy/story world (frontmatter `world:` / `storyWorld:`), that world
 * OVERRIDES the category default for those pages.
 */

const SETTING_LOCK_BY_CATEGORY: Record<string, string> = {
  NIGHT_FEAR:
    "The story's real-world frame is the child's bedroom at night — soft lamp glow, " +
    'bed, blanket, window or garden edge visible. Night may extend into a calm ' +
    'outdoor edge (garden path, porch) but stays intimate and safe. NOT a clinic. ' +
    'NOT a playground daytime scene.',
  SOCIAL:
    'The story takes place in kindergarten or playground social spaces — ' +
    'classroom corner, sandbox, slide area, circle-time rug. Warm daytime or ' +
    'indoor group setting. NOT a bedroom night scene. NOT a medical clinic.',
  MEDICAL_PROCEDURE:
    'The entire story takes place in a calm pediatric clinic exam/waiting room. ' +
    'Subtle clinic cues: exam table, nurse, thermometer, clinic chair, soft wall posters. ' +
    'NOT a bedroom. NOT a home nursery. NOT a fantasy bedroom.',
  NEW_SIBLING:
    "The real-world frame is home with a nursery corner — living room, hallway, " +
    "baby's crib or bassinet area, family couch. Cozy domestic scale. " +
    'Fantasy-direction stories may declare their own fantasy world via storyWorld override; ' +
    'this lock applies only to the real-world frame pages where the story uses one.',
  TRANSITION:
    'The story moves through transition doorways — old home, new home, kindergarten ' +
    'entrance, moving boxes, hallway between rooms. Domestic and school threshold spaces. ' +
    'NOT a clinic. NOT deep fantasy wilderness unless storyWorld override is set.',
  ANGER_FRUSTRATION:
    'The story takes place in everyday home or kindergarten spaces — kitchen table, ' +
    'play corner, rug, blocks area, quiet nook. Familiar daily-life scale. ' +
    'NOT a clinic. NOT epic outdoor adventure unless storyWorld override is set.',
};

export type ScenarioSettingLockOptions = {
  /** When set (from story frontmatter/DNA), overrides category default entirely. */
  storyWorldOverride?: string | null;
};

/** Read optional story-level world anchor from YAML frontmatter text. */
export function readStoryWorldOverrideFromFrontmatter(rawMarkdown: string): string | null {
  const worldMatch = rawMarkdown.match(/^world:\s*(.+)\s*$/m);
  if (worldMatch?.[1]) {
    return worldMatch[1].replace(/^['"]|['"]$/g, '').trim() || null;
  }
  const storyWorldMatch = rawMarkdown.match(/^storyWorld:\s*(.+)\s*$/m);
  if (storyWorldMatch?.[1]) {
    return storyWorldMatch[1].replace(/^['"]|['"]$/g, '').trim() || null;
  }
  return null;
}

export function resolveScenarioSettingLock(
  challengeCategory: string | null | undefined,
  options?: ScenarioSettingLockOptions
): string | null {
  const override = options?.storyWorldOverride?.trim();
  if (override) return override;

  const key = challengeCategory?.trim().toUpperCase();
  if (!key) return null;
  return SETTING_LOCK_BY_CATEGORY[key] ?? null;
}

export function buildScenarioSettingLockBlock(
  challengeCategory: string | null | undefined,
  options?: ScenarioSettingLockOptions
): string {
  const lock = resolveScenarioSettingLock(challengeCategory, options);
  if (!lock) return '';
  return `SCENARIO SETTING LOCK (story-level — every page and cover):\n${lock}`;
}

/** MVP categories that must have a default setting anchor. */
export const MVP_SETTING_LOCK_CATEGORIES = [
  'NIGHT_FEAR',
  'SOCIAL',
  'MEDICAL_PROCEDURE',
  'NEW_SIBLING',
  'TRANSITION',
  'ANGER_FRUSTRATION',
] as const;
