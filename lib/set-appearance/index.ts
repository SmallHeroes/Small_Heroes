export type {
  AppearanceDriftFinding,
  AppearanceDriftReport,
  AppearanceDriftSeverity,
  AppearanceLightingTarget,
  SceneAppearanceMemory,
  SceneAppearanceSignature,
  SetAppearanceBoardManifest,
  SetAppearanceBoardOptions,
} from './types';

export {
  buildAppearanceDriftReport,
  appearanceReportHasHardFail,
  writeAppearanceDriftReportFile,
} from './analyze';
export {
  BOARD_MANIFEST_VERSION,
  BOARD_QUARANTINE_FORBIDDEN_LINES,
  buildFixedBoardAppearanceMemory,
  filterSignaturesForFixedBoard,
  isFixedBoardFactId,
} from './quarantine';
export { qaSetAppearanceBoardImage } from './board-qa';
export {
  filterStateCriticalIsolatedPaths,
  isStateCriticalIsolatedRefPath,
  pageNeedsStateObjectRef,
} from './ref-priority';
export { resolveStyle01SetRefBudget } from './ref-budget';
export type { Style01SetRefBudgetInput, Style01SetRefBudgetResult } from './ref-budget';
export {
  SET_APPEARANCE_BOARD_ROOT,
  SetAppearanceBoardReviewRequiredError,
  approveSetAppearanceBoardManifest,
  buildSetAppearanceBoardPrompt,
  isSetAppearanceBoardUsable,
  loadSetAppearanceBoardManifest,
  pageAllowsSetAppearanceBoardRef,
  saveSetAppearanceBoardManifest,
  setAppearanceBoardDir,
  setAppearanceBoardImagePath,
  setAppearanceBoardManifestPath,
} from './board';
export { buildSetAppearanceLockBlock, promptContainsSetAppearanceLock } from './compose';
export { ensureSetAppearanceBoard, generateSetAppearanceBoard } from './generate-board';
export { seedSceneAppearanceMemory } from './seed';
