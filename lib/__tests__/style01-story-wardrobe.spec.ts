import { describe, expect, it } from 'vitest';

import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { buildStyle01WardrobeLock } from '../style01-gptimage';
import {
  DRAGON_DINI_FANTASY_WARDROBE_LOCK,
  LION_SHAKET_BEDTIME_WARDROBE_LOCK,
  resolveStyle01StoryWardrobeLock,
} from '../style01-story-wardrobe';

describe('style01 story-aware wardrobe lock', () => {
  it('lion_shaket_bedtime resolves pajama lock by story file', () => {
    expect(resolveStyle01StoryWardrobeLock('lion_shaket', 'lion_shaket_bedtime')).toBe(
      LION_SHAKET_BEDTIME_WARDROBE_LOCK
    );
  });

  it('lion_shaket_adventure does not resolve a story wardrobe lock', () => {
    expect(resolveStyle01StoryWardrobeLock('lion_shaket', 'lion_shaket_adventure')).toBeUndefined();
  });

  it('dragon_dini still resolves companion wardrobe lock', () => {
    expect(resolveStyle01StoryWardrobeLock('dragon_dini')).toBe(DRAGON_DINI_FANTASY_WARDROBE_LOCK);
  });

  it('bedtime story assembly uses pajamas — not daytime default', () => {
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 1,
      pagePrompt: 'Night bedroom, child beside pillow fort.',
      bookPageText: 'כבר היה לילה.',
      childFirstName: 'עומר',
      childGender: 'boy',
      childAge: 6,
      childStructured: {
        face: 'Round face, warm skin, brown eyes.',
        hair: 'Short dark hair.',
        body: 'Build for a 6-year-old boy.',
        clothing: 'Wearing a light blue t-shirt, dark denim shorts, and red sneakers.',
        signature: '',
      },
      companion: { id: 'lion_shaket', name: 'ליאו' },
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
    });
    expect(prompt).toContain('two-piece pajamas');
    expect(prompt).not.toMatch(/plain solid sky-blue t-shirt with a small yellow sun/i);
    expect(prompt).not.toMatch(/Shoes: RED sneakers/i);
    const visualLockMatch = prompt.match(
      /CHILD VISUAL LOCK \(verbatim when child appears\):([\s\S]*?)(?:\n\n|$)/
    );
    expect(visualLockMatch?.[1] ?? '').not.toMatch(/t-shirt/i);
    expect(visualLockMatch?.[1] ?? '').not.toMatch(/denim/i);
    expect(visualLockMatch?.[1] ?? '').not.toMatch(/sneakers/i);
    expect(visualLockMatch?.[1] ?? '').not.toMatch(/Wearing/i);
  });

  it('adventure assembly keeps daytime default wardrobe', () => {
    const lock = buildStyle01WardrobeLock({
      companionId: 'lion_shaket',
      storyFile: 'lion_shaket_adventure',
    });
    expect(lock).toMatch(/sky-blue t-shirt/i);
    expect(lock).not.toMatch(/two-piece pajamas/i);
  });
});
