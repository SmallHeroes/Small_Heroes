import type { BookShotPlan } from '../book-shot-plan/types';
import type { StoryLocationPlanBundle } from '../story-location-bible/types';
import { seedSceneMemoryPlan } from './seed';
import type { SceneMemoryPlan } from './types';

export function resolveSceneMemoryPlan(args: {
  storyLocationPlan: StoryLocationPlanBundle | null | undefined;
  bookShotPlan?: BookShotPlan | null;
}): SceneMemoryPlan | null {
  if (!args.storyLocationPlan?.bible) return null;
  return seedSceneMemoryPlan({
    storyLocationPlan: args.storyLocationPlan,
    bookShotPlan: args.bookShotPlan ?? null,
  });
}

export function resolveSceneMemoryFromPlan(
  plan: SceneMemoryPlan | null | undefined
): SceneMemoryPlan['memory'] | null {
  return plan?.memory ?? null;
}
