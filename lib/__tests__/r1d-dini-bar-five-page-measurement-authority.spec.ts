import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateBookShotPlan } from '@/lib/book-shot-plan';
import {
  requiredPropIdsForPage,
  migrateLegacyBookVisualContractTemplateV1,
  validateBookVisualContractTemplate,
} from '@/lib/visual-contract-compiler';
import { buildBlueprintFixture } from '@/lib/visual-package/__tests__/pre-render-book-visual-blueprint.fixtures';
import {
  applyDiniBarFivePageMeasurementOverlay,
  DINI_BAR_MEASUREMENT_PAGES,
  DINI_BAR_SHOT_PLAN,
} from '@/scripts/lib/r1d-dini-bar-five-page-measurement-authority';
import {
  applyBunnyBarFivePageMeasurementOverlay,
  BUNNY_BAR_MEASUREMENT_PAGES,
  BUNNY_BAR_SHOT_PLAN,
} from '@/scripts/lib/r1d-bunny-bar-five-page-measurement-authority';

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

describe('Bunny + Bar five-page expression generalization authority', () => {
  it('keeps a valid 12-page plan with five materially distinct opening frames', () => {
    expect(validateBookShotPlan(BUNNY_BAR_SHOT_PLAN)).toEqual([]);
    expect(BUNNY_BAR_SHOT_PLAN.pages.slice(0, 5).map(({ shot, angle }) => `${shot}:${angle}`))
      .toEqual([
        'establishing_wide:eye',
        'close_up:high',
        'medium:eye',
        'medium_wide:low',
        'dynamic_angle:low',
      ]);
  });

  it('normalizes the approved Bunny authority without changing production code', () => {
    const source = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          'story-bank',
          'v3-approved',
          'bunny_ometz_adventure.visual-contract-template.json',
        ),
        'utf8',
      ),
    );
    const migrated = migrateLegacyBookVisualContractTemplateV1(source);

    applyBunnyBarFivePageMeasurementOverlay(migrated);

    expect(validateBookVisualContractTemplate(migrated).ok).toBe(true);
    expect(BUNNY_BAR_MEASUREMENT_PAGES).toEqual([1, 2, 3, 4, 5]);
    expect(migrated.coverContract.zoneId).toBe(
      migrated.pageContracts.find((page) => page.pageNumber === 1)?.zoneId,
    );
    expect(migrated.locations.every((location) => (location.anchors?.length ?? 0) > 0)).toBe(true);
  });

  it('routes the new profile through canonical-anchor Bar treatment and local storage', () => {
    const runner = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'run-r1d-wizard-low-full-book-measurement.ts'),
      'utf8',
    );
    expect(runner).toContain("MEASUREMENT === 'bunny-bar-five-page'");
    expect(runner).toContain("childReferenceKind: 'canonical_anchor'");
    expect(runner).toContain("clientCompanionId: IS_DINI_BAR");
    expect(runner).toContain("? 'bunny_ometz'");
    expect(runner).toContain('remoteDatabaseAccess: false');
    expect(runner).toContain('remoteStorageAccess: false');
  });
});
