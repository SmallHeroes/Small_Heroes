import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MVP_STORY_MATRIX,
  allMvpCategories,
  categoryForTopicId,
  companionForCategory,
  configuredSlotStatus,
  isSlotSellable,
  isV3SlotRuntimeReady,
  sellableDirectionsFor,
} from '../../backend/config/mvp-story-matrix';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
const V5_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);
const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;

describe('MVP_STORY_MATRIX helpers', () => {
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
  });

  it('defines exactly 6 MVP categories with companions', () => {
    expect(allMvpCategories()).toHaveLength(6);
    expect(companionForCategory('NIGHT_FEAR')).toBe('fox_uri');
    expect(companionForCategory('MEDICAL_PROCEDURE')).toBe('bunny_ometz');
    expect(companionForCategory('not_real')).toBeNull();
  });

  it('maps wizard topic ids to MVP categories', () => {
    expect(categoryForTopicId('night')).toBe('NIGHT_FEAR');
    expect(categoryForTopicId('anger')).toBe('ANGER_FRUSTRATION');
    expect(categoryForTopicId('unknown')).toBeNull();
  });

  it('sellableDirectionsFor returns only runtime-ready approved slots', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;

    const nightDirs = sellableDirectionsFor('NIGHT_FEAR');
    expect(nightDirs).toContain('bedtime');
    expect(nightDirs).not.toContain('fantasy');

    const medicalDirs = sellableDirectionsFor('MEDICAL_PROCEDURE');
    expect(medicalDirs).toContain('adventure');
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

  it('golden approved slots resolve when v5 file exists', () => {
    const foxBedtime = path.join(V5_DIR, 'fox_uri_bedtime.md');
    if (fs.existsSync(foxBedtime)) {
      expect(isSlotSellable('NIGHT_FEAR', 'bedtime')).toBe(true);
    }
    expect(MVP_STORY_MATRIX.NIGHT_FEAR.directions.bedtime).toBe('approved');
  });
});
