/**
 * sceneCount is the product unit; pageCount remains in legacy surfaces.
 * pageCount === sceneCount for illustrated story beats in the current model.
 */

import type { StoryDirection } from './types';

const SCENES_BY_DIRECTION: Record<StoryDirection, number> = {
  bedtime: 10,
  adventure: 15,
  fantasy: 20,
};

export function sceneCountForDirection(direction: StoryDirection | string | null | undefined): number {
  const d = (direction ?? 'adventure').toLowerCase();
  if (d === 'bedtime') return SCENES_BY_DIRECTION.bedtime;
  if (d === 'fantasy') return SCENES_BY_DIRECTION.fantasy;
  return SCENES_BY_DIRECTION.adventure;
}

/** Derive sceneCount from an array length (e.g. interior illustrated scenes). */
export function sceneCountFromScenes(scenes: { kind: string }[]): number {
  return scenes.filter((s) => s.kind === 'story').length;
}

/**
 * Alias: legacy pageCount for interior story beats equals sceneCount.
 * Cover/dedication are not counted as product scenes.
 */
export function pageCountAsSceneCount(interiorStoryBeatCount: number): number {
  return interiorStoryBeatCount;
}
