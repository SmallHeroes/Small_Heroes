export type {
  ObservedSceneFact,
  ObservedSceneFacts,
  SceneMemory,
  SceneMemoryDriftFactStatus,
  SceneMemoryDriftPerFact,
  SceneMemoryDriftReport,
  SceneMemoryFactKind,
  SceneMemoryLockLevel,
  SceneMemoryLockOptions,
  SceneMemoryObservedState,
  SceneMemoryPlan,
  SceneMemoryProvenance,
  SceneMemorySceneType,
  SceneMemorySeedSource,
  SceneMemoryStableFact,
  SceneMemoryStatefulObject,
  SceneMemoryStatefulTimelineEntry,
} from './types';

export { analyzeSceneMemoryImage, VISION_CONFIDENCE_THRESHOLD } from './analyze';
export { buildSceneMemoryLockBlock, promptContainsSceneMemoryLock } from './compose';
export {
  appearanceCompatible,
  deriveFactKind,
  fortFormStateIsDrift,
  getExpectedStateForPage,
  isFortFormPrimaryFact,
  isStandingCanopy,
  isWithinLockedPalette,
  normalizeObservedState,
  positionsCompatible,
  shouldEnforceStatefulDrift,
  statesCompatible,
} from './fact-compare';
export {
  buildSceneMemoryDriftReport,
  writeSceneMemoryDriftReportFile,
} from './drift-report';
export { resolveSceneMemoryFromPlan, resolveSceneMemoryPlan } from './resolve';
export { seedSceneMemoryPlan } from './seed';
