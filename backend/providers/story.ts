/**
 * Story Provider — re-export shim
 *
 * All generation logic has moved to pipeline.ts (4-stage architecture).
 * This file exists only to preserve import paths used by:
 *   - backend/api/generate.ts  → generateStory, StoryInput
 *   - any other consumers      → GeneratedStory, FamilyContext, etc.
 *
 * Do not add generation logic here. Edit pipeline.ts.
 */

export type {
  FamilyContext,
  StoryInput,
  VisualBible,      // renamed from StoryBible in pipeline.ts
  HeroVisualLock,
  StyleLock,
  EntityVisualLock,
  PageIntent,
  PageOutline,
  PageProse,
  IllustrationShot,
  ShotVisualDirection,
  StoryConcept,
  CharacterSheet,
  StoryPage,
  QualityResult,
  GeneratedStory,
} from './pipeline';

export { STYLE_TOKENS, validateStoryQuality, runStoryPipeline } from './pipeline';

import { runStoryPipeline, type StoryInput, type GeneratedStory } from './pipeline';

/**
 * Public entry point — called by the orchestrator (generate.ts).
 * Delegates entirely to the 4-stage pipeline.
 */
export async function generateStory(input: StoryInput): Promise<GeneratedStory> {
  return runStoryPipeline(input);
}
