/**
 * Flag-off safety for the v3-approved bank bridge:
 * with ENABLE_V3_APPROVED_BANK unset, selection behavior is identical to before
 * even when files exist in story-bank/v3-approved/.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { selectCompanionStory } from '../../backend/providers/story-bank-index';

const V3_APPROVED_DIR = path.join(process.cwd(), 'story-bank', 'v3-approved');
// bunny_ometz_fantasy.md is a REAL imported sellable slot — never clobber; backup/restore in hooks.
const TEMP_FILE = path.join(V3_APPROVED_DIR, 'bunny_ometz_fantasy.md');
const V5_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;
let fixturePreexisted = false;
let savedContent: string | null = null;

describe('v3-approved bank selection (flag-gated, additive)', () => {
  beforeEach(() => {
    fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
    fixturePreexisted = fs.existsSync(TEMP_FILE);
    savedContent = fixturePreexisted ? fs.readFileSync(TEMP_FILE, 'utf8') : null;
    if (!fixturePreexisted) {
      fs.writeFileSync(
        TEMP_FILE,
        '---\ntitle: "temp"\n---\n--- Page 1 ---\nimageDirection: x\nשלום\n',
        'utf8'
      );
    }
  });

  afterEach(() => {
    if (fixturePreexisted) {
      fs.writeFileSync(TEMP_FILE, savedContent ?? '', 'utf8');
    } else if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
    }
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
  });

  it('flag OFF: v3-approved files are completely ignored', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;

    const fantasySelection = selectCompanionStory('bunny_ometz', 'fantasy');
    const v5FantasyExists = fs.existsSync(path.join(V5_DIR, 'bunny_ometz_fantasy.md'));
    if (v5FantasyExists) {
      expect(fantasySelection?.dirName).toBeUndefined();
    } else {
      expect(fantasySelection).toBeNull();
    }

    const bedtimeSelection = selectCompanionStory('bunny_ometz', 'bedtime');
    expect(bedtimeSelection?.dirName).toBeUndefined();
  });

  it('flag OFF explicit false: same as unset', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'false';
    const selection = selectCompanionStory('bunny_ometz', 'fantasy');
    expect(selection?.dirName).toBeUndefined();
  });

  it('flag ON: v3-approved entry takes precedence with dirName', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    const selection = selectCompanionStory('bunny_ometz', 'fantasy');
    expect(selection).not.toBeNull();
    expect(selection?.dirName).toBe('v3-approved');
    expect(selection?.filename).toBe('bunny_ometz_fantasy.md');
  });

  it('flag ON without an imported file: default path unchanged', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    fs.unlinkSync(TEMP_FILE);
    const selection = selectCompanionStory('bunny_ometz', 'fantasy');
    expect(selection?.dirName).toBeUndefined();
  });

  it('real bunny_ometz_fantasy slot survives the suite (no temp overwrite)', () => {
    expect(fs.existsSync(TEMP_FILE)).toBe(true);
    const content = fs.readFileSync(TEMP_FILE, 'utf8');
    expect(content).not.toContain('title: "temp"');
    expect(content).toContain('bunny_ometz');
    expect(content).toContain('MEDICAL_PROCEDURE');
  });

  it('flag OFF: superseded v5 koko bedtime/fantasy are not served from v5', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;
    expect(selectCompanionStory('chameleon_koko', 'bedtime')).toBeNull();
    expect(selectCompanionStory('chameleon_koko', 'fantasy')).toBeNull();
  });

  it('flag ON: v3-approved koko fantasy still served despite v5 supersede', () => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    const selection = selectCompanionStory('chameleon_koko', 'fantasy');
    expect(selection).not.toBeNull();
    expect(selection?.dirName).toBe('v3-approved');
    expect(selection?.filename).toBe('chameleon_koko_fantasy.md');
  });
});
