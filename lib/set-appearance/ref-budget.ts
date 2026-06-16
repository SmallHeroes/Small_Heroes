import type { PageShot } from '../book-shot-plan/types';
import { resolveGPTImageEditMaxReferences } from '../generate-image';
import type { Style02RefBudgetConfig } from '../style02-gptimage';
import {
  computeMaxSetElementRefSlots,
  selectPageSetElementRefs,
  type PageSetElementRefSelection,
} from '../story-location-bible/set-topology';
import type { BookLocationBible, PageLocationPlan } from '../story-location-bible/types';
import type { SceneMemory } from '../scene-memory/types';
import type { SetAppearanceBoardManifest } from './types';
import {
  filterStateCriticalIsolatedPaths,
  isStateCriticalIsolatedRefPath,
  pageNeedsStateObjectRef,
} from './ref-priority';
import { isSetAppearanceBoardUsable, pageAllowsSetAppearanceBoardRef } from './board';

export type Style01SetRefBudgetInput = {
  pageNumber?: number | null;
  pageLocationPlan?: PageLocationPlan | null;
  pageShot?: PageShot | null;
  sceneMemory?: SceneMemory | null;
  locationBible?: BookLocationBible | null;
  setAppearanceBoardPath?: string | null;
  boardManifest?: SetAppearanceBoardManifest | null;
  refConfig: Style02RefBudgetConfig;
  childSlotsUsed: number;
  companionSlotsUsed: number;
  otherSlotsUsed: number;
  useMultiCompanionSheets: boolean;
  maxRefs?: number;
};

export type Style01SetRefBudgetResult = {
  statePage: boolean;
  appearanceBoardPath: string | null;
  setRefSelection: PageSetElementRefSelection;
  setRefSlotCount: number;
  styleRefCount: number;
  styleSlots: number;
  availableSetSlots: number;
  maxSetSlots: number;
};

function resolveConfigStyleCap(
  refConfig: Style02RefBudgetConfig,
  useMultiCompanionSheets: boolean,
  appearanceBoardPath: string | null,
  styleSlots: number
): number {
  if (appearanceBoardPath) return Math.min(1, styleSlots);
  if (useMultiCompanionSheets) return Math.min(1, styleSlots);
  if (refConfig === 'A') return Math.min(2, styleSlots);
  return Math.min(3, styleSlots);
}

/** Identity > state-critical refs > board > style. Style never survives a dropped state ref. */
export function resolveStyle01SetRefBudget(input: Style01SetRefBudgetInput): Style01SetRefBudgetResult {
  const maxRefs = input.maxRefs ?? resolveGPTImageEditMaxReferences();
  const candidateSetRefPaths = (
    input.pageLocationPlan?.referenceSheets?.isolatedObjectPaths ?? []
  ).filter(Boolean);
  const availableSetSlots = Math.max(
    0,
    maxRefs - input.childSlotsUsed - input.companionSlotsUsed - input.otherSlotsUsed
  );
  const statePage = pageNeedsStateObjectRef({
    pageNumber: input.pageNumber,
    pageLocationPlan: input.pageLocationPlan,
    sceneMemory: input.sceneMemory,
    isolatedObjectPaths: candidateSetRefPaths,
  });
  const boardApproved =
    Boolean(input.setAppearanceBoardPath) &&
    isSetAppearanceBoardUsable(input.boardManifest ?? null) &&
    input.boardManifest?.boardPath === input.setAppearanceBoardPath;
  const appearanceBoardPath =
    !statePage &&
    availableSetSlots >= 1 &&
    boardApproved &&
    pageAllowsSetAppearanceBoardRef(input.pageShot)
      ? input.setAppearanceBoardPath!
      : null;
  const stateRefCandidates = statePage
    ? filterStateCriticalIsolatedPaths(candidateSetRefPaths)
    : candidateSetRefPaths;
  const maxSetSlots = appearanceBoardPath
    ? 0
    : statePage
      ? availableSetSlots
      : computeMaxSetElementRefSlots(
          input.childSlotsUsed + input.companionSlotsUsed + input.otherSlotsUsed
        );
  const setRefSelection = appearanceBoardPath
    ? { selected: [] as string[], requested: candidateSetRefPaths, dropped: candidateSetRefPaths }
    : selectPageSetElementRefs({
        pagePlan: input.pageLocationPlan,
        pageShot: input.pageShot,
        candidatePaths: stateRefCandidates,
        setElementFiles: input.locationBible?.setElementFiles,
        maxSlots: maxSetSlots,
      });
  const setRefSlotCount = appearanceBoardPath ? 1 : setRefSelection.selected.length;
  const styleSlots = Math.max(
    0,
    maxRefs - input.childSlotsUsed - input.companionSlotsUsed - input.otherSlotsUsed - setRefSlotCount
  );
  const stateRefDroppedWhileStylePossible =
    statePage &&
    setRefSelection.dropped.some((p) => isStateCriticalIsolatedRefPath(p)) &&
    styleSlots > 0;
  const styleRefCount = stateRefDroppedWhileStylePossible
    ? 0
    : resolveConfigStyleCap(
        input.refConfig,
        input.useMultiCompanionSheets,
        appearanceBoardPath,
        styleSlots
      );

  return {
    statePage,
    appearanceBoardPath,
    setRefSelection,
    setRefSlotCount,
    styleRefCount,
    styleSlots,
    availableSetSlots,
    maxSetSlots,
  };
}
