import { describe, expect, it } from 'vitest';
import path from 'path';

import { resolveGPTImageEditMaxReferences } from '../generate-image';
import { loadStoryLocationPlanOverride } from '../story-location-bible/resolve';
import { enrichStoryLocationPlanWithReferenceSheets } from '../story-location-bible/zone-sheets';
import {
  filterStateCriticalIsolatedPaths,
  isStateCriticalIsolatedRefPath,
  pageNeedsStateObjectRef,
  resolveStyle01SetRefBudget,
} from '../set-appearance';
import type { SetAppearanceBoardManifest } from '../set-appearance/types';

const LION_STORY = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

function lionP6Plan() {
  const raw = loadStoryLocationPlanOverride(LION_STORY)!;
  const bundle = enrichStoryLocationPlanWithReferenceSheets(raw, LION_STORY);
  return {
    bundle,
    p6: bundle.pagePlans.find((p) => p.page === 6)!,
    p2: bundle.pagePlans.find((p) => p.page === 2)!,
  };
}

function approvedBoardManifest(boardPath: string): SetAppearanceBoardManifest {
  return {
    sceneId: 'fixed_interior_night_bedroom_night',
    boardPath,
    approved: true,
    humanApprovedAt: '2026-06-16T00:00:00.000Z',
    qaPassed: true,
    boardVersion: 'fixed-objects-only-r2',
    generatedAt: '2026-06-16T00:00:00.000Z',
    quality: 'low',
  };
}

describe('Style01 set ref budget (J2.5-R2 invariant)', () => {
  it('keeps both pillow-cave and blanket-fold state refs on p6 when budget allows', () => {
    const { bundle, p6 } = lionP6Plan();
    const isolated = p6.referenceSheets?.isolatedObjectPaths ?? [];
    expect(isolated.length).toBeGreaterThanOrEqual(2);
    expect(
      pageNeedsStateObjectRef({
        pageNumber: 6,
        pageLocationPlan: p6,
        isolatedObjectPaths: isolated,
      })
    ).toBe(true);

    const maxRefs = resolveGPTImageEditMaxReferences();
    const budget = resolveStyle01SetRefBudget({
      pageNumber: 6,
      pageLocationPlan: p6,
      pageShot: { page: 6, shot: 'intimate', angle: 'eye', rationale: 'p6' },
      locationBible: bundle.bible,
      refConfig: 'A',
      childSlotsUsed: 1,
      companionSlotsUsed: 1,
      otherSlotsUsed: 0,
      useMultiCompanionSheets: false,
      maxRefs,
    });

    const stateSelected = budget.setRefSelection.selected.filter((p) =>
      isStateCriticalIsolatedRefPath(p)
    );
    expect(stateSelected.map((p) => path.basename(p))).toEqual(
      expect.arrayContaining(['pillow-cave-object.png', 'blanket-fold-object.png'])
    );
    expect(budget.appearanceBoardPath).toBeNull();
    expect(budget.styleRefCount).toBe(0);
  });

  it('drops style before state-critical refs under budget pressure; board yields to state', () => {
    const { bundle, p6, p2 } = lionP6Plan();
    const isolated = p6.referenceSheets?.isolatedObjectPaths ?? [];
    const boardPath = path.join(
      process.cwd(),
      'outputs',
      'set-appearance-boards',
      'fixed_interior_night_bedroom_night',
      'set-appearance-board.png'
    );

    const tightState = resolveStyle01SetRefBudget({
      pageNumber: 6,
      pageLocationPlan: p6,
      pageShot: { page: 6, shot: 'intimate', angle: 'eye', rationale: 'p6' },
      locationBible: bundle.bible,
      setAppearanceBoardPath: boardPath,
      boardManifest: approvedBoardManifest(boardPath),
      refConfig: 'A',
      childSlotsUsed: 1,
      companionSlotsUsed: 1,
      otherSlotsUsed: 1,
      useMultiCompanionSheets: false,
      maxRefs: 4,
    });

    const stateDropped = tightState.setRefSelection.dropped.filter((p) =>
      isStateCriticalIsolatedRefPath(p)
    );
    if (stateDropped.length > 0) {
      expect(tightState.styleRefCount).toBe(0);
    } else {
      expect(tightState.setRefSelection.selected.length).toBe(
        filterStateCriticalIsolatedPaths(isolated).length
      );
      expect(tightState.styleRefCount).toBe(0);
    }
    expect(tightState.appearanceBoardPath).toBeNull();

    const nonStateWithBoard = resolveStyle01SetRefBudget({
      pageNumber: 2,
      pageLocationPlan: p2,
      pageShot: { page: 2, shot: 'medium_wide', angle: 'eye', rationale: 'p2' },
      locationBible: bundle.bible,
      setAppearanceBoardPath: boardPath,
      boardManifest: approvedBoardManifest(boardPath),
      refConfig: 'A',
      childSlotsUsed: 1,
      companionSlotsUsed: 1,
      otherSlotsUsed: 0,
      useMultiCompanionSheets: false,
      maxRefs: 4,
    });
    expect(nonStateWithBoard.appearanceBoardPath).toBe(boardPath);
    expect(nonStateWithBoard.setRefSelection.selected).toEqual([]);
  });

  it('never attaches board without humanApprovedAt (GUY-7)', () => {
    const { bundle, p2 } = lionP6Plan();
    const boardPath = '/tmp/board.png';
    const qaOnlyManifest: SetAppearanceBoardManifest = {
      ...approvedBoardManifest(boardPath),
      humanApprovedAt: null,
      approved: false,
    };
    const budget = resolveStyle01SetRefBudget({
      pageNumber: 2,
      pageLocationPlan: p2,
      pageShot: { page: 2, shot: 'medium_wide', angle: 'eye', rationale: 'p2' },
      locationBible: bundle.bible,
      setAppearanceBoardPath: boardPath,
      boardManifest: qaOnlyManifest,
      refConfig: 'A',
      childSlotsUsed: 1,
      companionSlotsUsed: 1,
      otherSlotsUsed: 0,
      useMultiCompanionSheets: false,
    });
    expect(budget.appearanceBoardPath).toBeNull();
  });
});
