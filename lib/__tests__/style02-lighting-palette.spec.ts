import { describe, expect, it } from 'vitest';
import {
  buildStyle02BookPagePrompt,
  buildStyle02DayLightingBlock,
  buildStyle02SceneLightingBlock,
  isStyle02DayEffectiveTime,
  STYLE_02_ANTI_GLOBAL_DARK,
  STYLE_02_REF_SUBSETS,
  STYLE_02_SHARED,
} from '../style02-gptimage';
import { STYLE_REGISTRY, STYLE_IDS } from '../styles';

describe('Style02 cinematic-not-dark palette', () => {
  it('STYLE_02_SHARED requires brightness to match time of day', () => {
    expect(STYLE_02_SHARED).toMatch(/brightness matches the scene time of day/i);
    expect(STYLE_02_SHARED).not.toMatch(/desaturated vintage/i);
  });

  it('DETAILED_WHIMSICAL_WORLD drops desaturated default and adds anti-dark negative', () => {
    const contract = STYLE_REGISTRY[STYLE_IDS.DETAILED_WHIMSICAL_WORLD];
    expect(contract.colorRules.join(' ')).not.toMatch(/desaturated vintage/i);
    expect(contract.lightingRules.join(' ')).toMatch(/brightness matches scene time of day/i);
    expect(contract.negativeConstraints.join(' ')).toMatch(/globally dark, underexposed, or murky/i);
    expect(contract.optionBlock).toMatch(/NOT globally desaturated/i);
  });

  it('classroom-day subset leads with bright daylight ref file', () => {
    expect(STYLE_02_REF_SUBSETS['classroom-day'].filenames[0]).toContain('02_24_45 PM');
    expect(STYLE_02_REF_SUBSETS['classroom-day'].reason).toMatch(/Bright daytime/i);
  });
});

describe('buildStyle02SceneLightingBlock', () => {
  it('day effective time → bright daylight lock', () => {
    const block = buildStyle02SceneLightingBlock({ effectivePageTimeOfDay: 'day' });
    expect(block).toContain('SCENE TIME-OF-DAY LOCK — DAY');
    expect(block).toMatch(/bright/i);
    expect(block).not.toContain('NIGHT');
  });

  it('night effective time → night lock', () => {
    const block = buildStyle02SceneLightingBlock({
      effectivePageTimeOfDay: 'night',
      imageDirection: 'bedroom at night',
    });
    expect(block).toContain('SCENE TIME-OF-DAY LOCK — NIGHT');
  });

  it('strict retry adds regeneration line for day scenes', () => {
    expect(buildStyle02DayLightingBlock(true)).toContain('REGENERATION — BRIGHTNESS');
  });

  it('buildStyle02BookPagePrompt injects lighting block and anti-global-dark guard', () => {
    const prompt = buildStyle02BookPagePrompt({
      sceneDescription: 'Child on a sunny porch with companion.',
      sceneLightingBlock: buildStyle02SceneLightingBlock({ effectivePageTimeOfDay: 'day' }),
      wardrobeLock: 'BOOK WARDROBE LOCK: test outfit',
    });
    expect(prompt).toContain('SCENE TIME-OF-DAY LOCK — DAY');
    expect(prompt).toContain(STYLE_02_ANTI_GLOBAL_DARK);
    expect(prompt).toContain('BOOK WARDROBE LOCK: test outfit');
  });

  it('isStyle02DayEffectiveTime identifies day and dawn only', () => {
    expect(isStyle02DayEffectiveTime('day')).toBe(true);
    expect(isStyle02DayEffectiveTime('dawn')).toBe(true);
    expect(isStyle02DayEffectiveTime('night')).toBe(false);
    expect(isStyle02DayEffectiveTime('dusk')).toBe(false);
  });
});
