import type { SceneMemory } from '../scene-memory/types';
import { buildScenarioSettingLockBlock } from '../scenario-setting-lock';
import type { PageShot } from '../book-shot-plan/types';
import { buildLocationContinuityPromptBlock } from './compose';
import type { BookLocationBible, PageLocationPlan } from './types';
import { buildVisualSpoilerPromptBlock } from './zone-sheets';

/**
 * Single resolved location truth for prompt assembly.
 * When a LocationBible is present, SCENARIO SETTING LOCK is absorbed — never both.
 */
export function buildResolvedLocationEnvironmentBlock(args: {
  challengeCategory?: string | null;
  storyWorldOverride?: string | null;
  locationBible?: BookLocationBible | null;
  pageLocationPlan?: PageLocationPlan | null;
  pageShot?: PageShot | null;
  isCover?: boolean;
  sceneMemory?: SceneMemory | null;
}): string {
  const bible = args.locationBible;
  const plan = args.pageLocationPlan;

  if (bible && plan) {
    const locationBlock = buildLocationContinuityPromptBlock(bible, plan, {
      pageShot: args.pageShot,
      isCover: args.isCover,
      sceneMemory: args.sceneMemory,
    });
    const spoilerBlock = buildVisualSpoilerPromptBlock(plan);
    const parts = [locationBlock, spoilerBlock].filter(Boolean);
    return parts.join('\n\n');
  }

  return buildScenarioSettingLockBlock(args.challengeCategory, {
    storyWorldOverride: args.storyWorldOverride,
  });
}

export {
  buildLocationContinuityPromptBlock,
  formatPageLocationManifestLine,
} from './compose';
export { deriveBookLocationBible, derivePageLocationPlans } from './derive';
export {
  formatLocationPlanTable,
  isStoryLocationPlanValid,
  loadStoryLocationPlanOverride,
  resolvePageLocationPlan,
  resolveStoryLocationPlan,
} from './resolve';
export {
  assembleStyle01BookReferencesWithZoneSheets,
  buildIsolatedObjectReferencePromptBlock,
  buildPageActionPromptBlock,
  buildVisualSpoilerPromptBlock,
  buildZoneObjectReferencePromptBlock,
  enrichStoryLocationPlanWithReferenceSheets,
  loadApprovedZoneSheetManifest,
  loadZoneSheetManifest,
  ISOLATED_OBJECT_REFERENCE_INSTRUCTION,
  pageAllowsIsolatedObjectRef,
  parseLocationZoneReferenceSheet,
  resolveApprovedZoneSheetsDir,
  resolvePageReferenceSheets,
  resolveZoneForAssetSheets,
  resolveZoneSheetCandidatesDir,
  storyKeyFromStoryFilePath,
  validateZoneSheetManifest,
  ZONE_OBJECT_REFERENCE_INSTRUCTION,
  ZONE_SHEET_ASSET_PARENT,
} from './zone-sheets';
export {
  buildSetTopologyLockBlock,
  buildSetRefManifestFields,
  computeMaxSetElementRefSlots,
  parseSetElementFiles,
  parseSetTopology,
  promptContainsSetTopologyLock,
  selectPageSetElementRefs,
} from './set-topology';
export type { PageSetElementRefSelection } from './set-topology';
export type {
  BookLocationBible,
  ExpectedBucketVisibility,
  FixedAnchor,
  LocationBibleSource,
  LocationContinuityMode,
  LocationZone,
  LocationZoneReferenceSheet,
  PageLocationPlan,
  PageReferenceSheets,
  SetTopology,
  SetTopologyElement,
  StoryLocationPlanBundle,
  VisualSpoilerPolicy,
  ZoneSheetManifest,
} from './types';
