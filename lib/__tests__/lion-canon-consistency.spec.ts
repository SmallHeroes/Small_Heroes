import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { MVP_WIZARD_CARD_COPY } from '../../backend/config/mvp-story-matrix';
import { buildCompanionAccessoryLockBlock, COMPANION_ACCESSORY_PROFILES } from '../companion-accessory';
import { COMPANIONS_BY_CATEGORY, getCompanionById } from '../companions';

const LION_ID = 'lion_shaket';
const STORY_BANK_DIR = path.join(process.cwd(), 'story-bank', 'v5-fixed-v2');

const SELF_CONFIDENCE_MARKERS = ['ביישן', 'הקול שלך קיים', 'שתקרא לו'] as const;
/** Legacy nikud spelling — must not appear in canon (built without literal for drift-grep hygiene). */
const OLD_NIKUD_NAME = ['ל', '\u05B5', 'יו', '\u05B9'].join('');
const STANDALONE_SHAKET_NAME = 'שָׁקֵט';

function lionGoldenStoryPaths(): string[] {
  return fs
    .readdirSync(STORY_BANK_DIR)
    .filter((name) => name.startsWith('lion_shaket_') && name.endsWith('.md'))
    .map((name) => path.join(STORY_BANK_DIR, name));
}

describe('Lion (lion_shaket) ANGER canon consistency', () => {
  it('registry image path is under ANGER_FRUSTRATION — not SELF_CONFIDENCE', () => {
    const lion = getCompanionById(LION_ID);
    expect(lion?.image).toBeDefined();
    expect(lion!.image).not.toContain('/SELF_CONFIDENCE/');
    expect(lion!.image).toContain('/ANGER_FRUSTRATION/');
  });

  it('registry tagline and narrativeHook use anger canon — not self-confidence framing', () => {
    const lion = getCompanionById(LION_ID)!;
    const copy = `${lion.tagline} ${lion.narrativeHook}`;
    for (const marker of SELF_CONFIDENCE_MARKERS) {
      expect(copy, `must not contain "${marker}"`).not.toContain(marker);
    }
  });

  it('lion_shaket lives in the ANGER_FRUSTRATION category bucket', () => {
    const angerIds = COMPANIONS_BY_CATEGORY.ANGER_FRUSTRATION.map((c) => c.id);
    expect(angerIds).toContain(LION_ID);
    expect(COMPANIONS_BY_CATEGORY.SELF_CONFIDENCE?.some((c) => c.id === LION_ID) ?? false).toBe(false);
  });

  it('wizard ANGER card one-liner uses anger canon — not stale confidence copy', () => {
    const oneLiner = MVP_WIZARD_CARD_COPY.ANGER_FRUSTRATION.oneLiner;
    expect(oneLiner).not.toContain('הקול שלך קיים');
    expect(oneLiner).toContain('כשהכעס ממלא את כל הגוף');
  });

  it('registry name is canonical ליאו — not legacy nikud spelling', () => {
    const name = getCompanionById(LION_ID)?.name ?? '';
    expect(name).toContain('ליאו');
    expect(name).not.toContain(OLD_NIKUD_NAME);
  });

  it('registry visualDescription is soft lion cub with signature drum — no scarf/cape/shy/brave-roar', () => {
    const desc = getCompanionById(LION_ID)?.visualDescription ?? '';
    const positiveOnly = desc.replace(/\bNO\s+\w+/gi, '');
    expect(desc).toMatch(/gentle lion cub/i);
    expect(desc).toMatch(/hand-drum|drum/i);
    expect(desc).toMatch(/warm wood frame/i);
    expect(desc).toMatch(/NO cape/i);
    expect(desc).toMatch(/NO scarf/i);
    expect(positiveOnly).not.toMatch(/scarf/i);
    expect(positiveOnly).not.toMatch(/cape/i);
    expect(desc).not.toMatch(/\bshy\b/i);
    expect(desc).not.toMatch(/brave roar/i);
  });

  it('accessory profile locks small side-strap drum and forbids scarf/cape', () => {
    const profile = COMPANION_ACCESSORY_PROFILES[LION_ID];
    expect(profile?.accessoryForbiddenOnly).toBeUndefined();
    expect(profile?.canonicalAccessory).toMatch(/drum/i);
    expect(profile?.forbiddenAlternatives).toEqual(
      expect.arrayContaining(['scarf', 'cape', 'cape-like scarf', 'bow', 'necklace'])
    );
    const lock = buildCompanionAccessoryLockBlock({
      companionId: LION_ID,
      companionName: 'האריה ליאו',
      companionPresence: 'present',
      context: 'character_sheet',
    });
    expect(lock).toBeDefined();
    expect(lock).toMatch(/ALWAYS small round frame hand-drum/i);
    expect(lock).toMatch(/soft strap across the body/i);
    expect(lock).toMatch(/NEVER scarf/i);
    expect(lock).toMatch(/NEVER cape/i);
    expect(lock).not.toMatch(/plain soft lion cub only/i);
  });

  it('lion golden stories use ליאו — no standalone Shaket name token or legacy nikud spelling', () => {
    const paths = lionGoldenStoryPaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const filePath of paths) {
      const text = fs.readFileSync(filePath, 'utf8');
      expect(text, path.basename(filePath)).not.toContain(OLD_NIKUD_NAME);
      expect(text, path.basename(filePath)).not.toContain(STANDALONE_SHAKET_NAME);
    }
  });
});
