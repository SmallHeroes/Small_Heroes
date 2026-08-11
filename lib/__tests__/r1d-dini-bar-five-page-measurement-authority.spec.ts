import { describe, expect, it } from 'vitest';

import { validateBookShotPlan } from '@/lib/book-shot-plan';
import {
  requiredPropIdsForPage,
  validateBookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';
import { buildBlueprintFixture } from '@/lib/visual-package/__tests__/pre-render-book-visual-blueprint.fixtures';
import {
  applyDiniBarFivePageMeasurementOverlay,
  DINI_BAR_MEASUREMENT_PAGES,
  DINI_BAR_SHOT_PLAN,
} from '@/scripts/lib/r1d-dini-bar-five-page-measurement-authority';

describe('Dini + Bar five-page measurement authority', () => {
  it('keeps a valid 16-page shot plan with five distinct opening frames', () => {
    expect(validateBookShotPlan(DINI_BAR_SHOT_PLAN)).toEqual([]);
    expect(DINI_BAR_SHOT_PLAN.pages.slice(0, 5).map(({ shot, angle }) => `${shot}:${angle}`))
      .toEqual([
        'medium_wide:eye',
        'close_up:high',
        'establishing_wide:low',
        'dynamic_angle:eye',
        'intimate:high',
      ]);
  });

  it('projects explicit story props into typed placement authority without mutating the source', () => {
    const migrated = buildBlueprintFixture('wizard_runtime_qualification', {
      pageCount: 16,
    }).context.template;
    migrated.recurringProps = [
      'prop_yellow_blanket',
      'prop_baby_things_cluster',
      'prop_toy_chest_portal',
      'prop_green_speckled_egg',
      'prop_soft_nest',
      'prop_small_stone',
      'prop_silver_cloth_ribbon',
    ].map((id) => ({ id, name: id, description: `measurement prop ${id}` }));
    const nestPage = migrated.pageContracts.find((page) => page.pageNumber === 5)!;
    nestPage.zoneId = 'zone:clinic';
    migrated.coverContract.zoneId = undefined;
    migrated.coverContract.castIds = undefined;
    const openingLocation = migrated.locations.find(
      (location) => location.id === migrated.pageContracts[0]!.locationId,
    )!;
    openingLocation.timeOfDay = undefined;
    for (const page of migrated.pageContracts) delete page.propConstraints;
    const before = structuredClone(migrated);

    applyDiniBarFivePageMeasurementOverlay(migrated);

    expect(validateBookVisualContractTemplate(migrated).ok).toBe(true);
    expect(migrated.coverContract.zoneId).toBe(nestPage.zoneId);
    expect(migrated.coverContract.castIds).toEqual(nestPage.castIds);
    expect(openingLocation.timeOfDay).toBe('mixed');
    expect(DINI_BAR_MEASUREMENT_PAGES.map((pageNumber) =>
      requiredPropIdsForPage(migrated as never, pageNumber),
    )).toEqual([
      ['prop_baby_things_cluster', 'prop_yellow_blanket'],
      ['prop_toy_chest_portal'],
      [],
      ['prop_small_stone'],
      ['prop_green_speckled_egg', 'prop_soft_nest'],
    ]);
    expect(before.pageContracts.every((page) => page.propConstraints == null)).toBe(true);
  });
});
