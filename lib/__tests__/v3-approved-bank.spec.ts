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
// fantasy variant is not expected to be imported for real — safe temp fixture name
const TEMP_FILE = path.join(V3_APPROVED_DIR, 'bunny_ometz_fantasy.md');
const V5_DIR = path.join(
  process.cwd(),
  'story-bank',
  (process.env.STORY_BANK_V3_DIR || 'v5-fixed-v2').trim()
);

const originalFlag = process.env.ENABLE_V3_APPROVED_BANK;

describe('v3-approved bank selection (flag-gated, additive)', () => {
  beforeEach(() => {
    fs.mkdirSync(V3_APPROVED_DIR, { recursive: true });
    fs.writeFileSync(TEMP_FILE, '---\ntitle: "temp"\n---\n--- Page 1 ---\nimageDirection: x\nשלום\n', 'utf8');
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
    if (originalFlag === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalFlag;
  });

  it('flag OFF: v3-approved files are completely ignored', () => {
    delete process.env.ENABLE_V3_APPROVED_BANK;

    const fantasySelection = selectCompanionStory('bunny_ometz', 'fantasy');
    const v5FantasyExists = fs.existsSync(path.join(V5_DIR, 'bunny_ometz_fantasy.md'));
    if (v5FantasyExists) {
      // default-path selection, untouched by the v3-approved file
      expect(fantasySelection?.dirName).toBeUndefined();
    } else {
      // no v5 file → null, exactly as before the bridge existed
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
});
