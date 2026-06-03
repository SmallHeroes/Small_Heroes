import { describe, expect, it } from 'vitest';
import {
  parseStoryTimeOfDayFromFrontmatter,
  resolveEffectivePageTimeOfDay,
  resolveStoryTimeOfDay,
} from '../story-time-of-day';

describe('story-time-of-day', () => {
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
