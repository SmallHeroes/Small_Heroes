import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MVP_WIZARD_CATALOG_CONTRACT,
  MVP_STORY_MATRIX,
  allMatrixMvpStorySlots,
  allMvpCategories,
  categoryForTopicId,
  companionForCategory,
  configuredSlotStatus,
  evaluateMvpWizardCatalogContract,
  isCompleteMvpWizardStoryInventory,
  isSlotSellable,
  isV3SlotRuntimeReady,
  sellableDirectionsFor,
} from '../../backend/config/mvp-story-matrix';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;
const originalQaFlag = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
const temporaryRoots: string[] = [];

function productLineageRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'product-lineage-matrix-'));
  temporaryRoots.push(root);
  const relative = path.join(
    'story-pipeline',
    '04_approved_story_sources',
    'accepted',
    'chameleon_koko_bedtime',
  );
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(process.cwd(), relative), target, { recursive: true });
  return root;
}

describe('MVP_STORY_MATRIX helpers', () => {
  beforeEach(() => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
    if (originalQaFlag === undefined) {
      delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    } else {
      process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = originalQaFlag;
    }
    for (const root of temporaryRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('defines exactly 6 MVP categories with companions', () => {
    expect(allMvpCategories()).toHaveLength(6);
    expect(companionForCategory('NIGHT_FEAR')).toBe('fox_uri');
    expect(companionForCategory('MEDICAL_PROCEDURE')).toBe('bunny_ometz');
    expect(companionForCategory('not_real')).toBeNull();
  });

  it('pins the runtime Wizard catalog to six categories by three directions', () => {
    const matrixSlots = allMatrixMvpStorySlots();
    expect(MVP_WIZARD_CATALOG_CONTRACT).toEqual({
      categoryCount: 6,
      directionCount: 3,
      storySlotCount: 18,
    });
    expect(evaluateMvpWizardCatalogContract()).toEqual({
      categoryCount: 6,
      directionCount: 3,
      structuralSlotCount: 18,
      distinctStoryKeyCount: 18,
      nominalSlotCount: 18,
      complete: true,
    });
    expect(
      isCompleteMvpWizardStoryInventory({
        declaredSlotCount: 18,
        storyKeys: matrixSlots.map((slot) => slot.storyKey),
      }),
    ).toBe(true);
    expect(
      isCompleteMvpWizardStoryInventory({
        declaredSlotCount: 17,
        storyKeys: matrixSlots.slice(0, -1).map((slot) => slot.storyKey),
      }),
    ).toBe(false);
  });

  it('maps wizard topic ids to MVP categories', () => {
    expect(categoryForTopicId('night')).toBe('NIGHT_FEAR');
    expect(categoryForTopicId('anger')).toBe('ANGER_FRUSTRATION');
    expect(categoryForTopicId('unknown')).toBeNull();
  });

  it('sellableDirectionsFor returns only runtime-ready approved slots', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;

    const nightDirs = sellableDirectionsFor('NIGHT_FEAR');
    expect(nightDirs).not.toContain('bedtime');
    expect(nightDirs).not.toContain('fantasy');

    const medicalDirs = sellableDirectionsFor('MEDICAL_PROCEDURE');
    expect(medicalDirs).not.toContain('adventure');
    // bedtime is approved_v3 — flag off → not sellable
    expect(medicalDirs).not.toContain('bedtime');
  });

  it('approved_v3 slot requires flag + file + valid import sidecar', () => {
    const bedtimeConfigured = configuredSlotStatus('MEDICAL_PROCEDURE', 'bedtime');
    expect(bedtimeConfigured).toBe('approved_v3');

    delete process.env.ENABLE_V3_APPROVED_BANK;
    expect(isV3SlotRuntimeReady('bunny_ometz', 'bedtime')).toBe(false);
    expect(isSlotSellable('MEDICAL_PROCEDURE', 'bedtime')).toBe(false);

    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    const sidecar = path.join(V3_APPROVED_DIR, 'bunny_ometz_bedtime.import.json');
    const md = path.join(V3_APPROVED_DIR, 'bunny_ometz_bedtime.md');
    const sidecarExists = fs.existsSync(sidecar);
    const mdExists = fs.existsSync(md);
    if (sidecarExists && mdExists) {
      expect(isV3SlotRuntimeReady('bunny_ometz', 'bedtime')).toBe(true);
      expect(isSlotSellable('MEDICAL_PROCEDURE', 'bedtime')).toBe(true);
    }
  });

  it('rejects non-sellable category/direction combos', () => {
    expect(isSlotSellable('NIGHT_FEAR', 'fantasy')).toBe(false);
    expect(isSlotSellable('SOCIAL', 'bedtime')).toBe(false);
    expect(isSlotSellable('HIDDEN_CATEGORY', 'bedtime')).toBe(false);
  });

  it('keeps legacy slots sellable but requires a package for each accepted source lineage', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    for (const category of allMvpCategories()) {
      const companionId = companionForCategory(category)!;
      for (const direction of ['bedtime', 'adventure', 'fantasy'] as const) {
        expect(configuredSlotStatus(category, direction)).toBe('approved_v3');
        expect(fs.existsSync(path.join(V3_APPROVED_DIR, `${companionId}_${direction}.md`))).toBe(true);
        expect(fs.existsSync(path.join(V3_APPROVED_DIR, `${companionId}_${direction}.import.json`))).toBe(true);
        const acceptedSourceWithoutPackage =
          companionId === 'dragon_dini' && direction === 'adventure';
        expect(isSlotSellable(category, direction)).toBe(
          !acceptedSourceWithoutPackage,
        );
      }
    }
  });

  it('does not let the approved-v3 flag reopen a package-required product lineage', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    expect(
      isSlotSellable('TRANSITION', 'bedtime', {
        repoRoot: productLineageRoot(),
      }),
    ).toBe(false);
    expect(isSlotSellable('TRANSITION', 'adventure')).toBe(true);
  });

  it('uses the explicit repository root for legacy readiness instead of the process cwd', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'true';
    const emptyRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'legacy-matrix-root-'),
    );
    temporaryRoots.push(emptyRoot);
    expect(
      isV3SlotRuntimeReady('bunny_ometz', 'bedtime', {
        repoRoot: emptyRoot,
      }),
    ).toBe(false);
    expect(
      isSlotSellable('MEDICAL_PROCEDURE', 'bedtime', {
        repoRoot: emptyRoot,
      }),
    ).toBe(false);
  });
});
