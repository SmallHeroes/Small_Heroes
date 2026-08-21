import { describe, expect, it } from 'vitest';
import {
  STORY_TIME_OF_DAY_VALUES,
  canonicalizeStoryTimeOfDayAuthority,
  parseStoryTimeOfDayFromFrontmatter,
  resolveEffectivePageTimeOfDay,
  resolveStoryTimeOfDay,
} from '../story-time-of-day';

describe('story-time-of-day', () => {
  it('preserves every exact closed authority value', () => {
    for (const value of STORY_TIME_OF_DAY_VALUES) {
      expect(canonicalizeStoryTimeOfDayAuthority(value)).toBe(value);
    }
  });

  it.each([
    ['starlit night', 'night'],
    ['bright blue sky at midday', 'day'],
    ['quiet evening light', 'dusk'],
    ['golden hour at sunset', 'dusk'],
    ['early morning light at dawn', 'dawn'],
    ['לילה שקט עם ירח', 'night'],
  ] as const)('canonicalizes one unambiguous cue family: %s', (raw, expected) => {
    expect(canonicalizeStoryTimeOfDayAuthority(raw)).toBe(expected);
  });

  it.each([
    'evening into night',
    'sunrise after a starlit night',
    'bright blue sky at sunset',
  ])('canonicalizes multiple time families to mixed: %s', (raw) => {
    expect(canonicalizeStoryTimeOfDayAuthority(raw)).toBe('mixed');
  });

  it.each([undefined, null, '', '   ', 'cozy interior light'])
    ('does not guess an unmappable authority: %s', (raw) => {
      expect(canonicalizeStoryTimeOfDayAuthority(raw)).toBeNull();
    });

  it('reads frontmatter timeOfDay', () => {
    const raw = 'timeOfDay: night\ncategory: NIGHT_FEAR\n';
    expect(parseStoryTimeOfDayFromFrontmatter(raw)).toBe('night');
  });

  it('defaults NIGHT_FEAR category to night', () => {
    expect(
      resolveStoryTimeOfDay({
        category: 'NIGHT_FEAR',
        pages: [{ text: 'יום שמש', imagePrompt: 'sunny afternoon' }],
      })
    ).toBe('night');
  });

  it('frontmatter overrides category', () => {
    expect(
      resolveStoryTimeOfDay({
        frontmatterTimeOfDay: 'day',
        category: 'NIGHT_FEAR',
        pages: [{ text: 'לילה', imagePrompt: 'starry night' }],
      })
    ).toBe('day');
  });

  it('inherits story night on pages without override', () => {
    expect(
      resolveEffectivePageTimeOfDay({
        storyTimeOfDay: 'night',
        pageNumber: 3,
        imageDirection: 'child on porch',
        bookPageText: 'לילה',
      })
    ).toBe('night');
  });
});
