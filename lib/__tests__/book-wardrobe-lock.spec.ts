import { describe, expect, it } from 'vitest';
import {
  applyWardrobeToChildStructured,
  bookWardrobeVerificationToken,
  buildBookWardrobePromptSection,
  resolveBookWardrobeLock,
} from '../book-wardrobe-lock';

describe('book-wardrobe-lock', () => {
  it('bedtime lock overrides clothing and hairstyle in childStructured', () => {
    const lock = resolveBookWardrobeLock('bedtime')!;
    const applied = applyWardrobeToChildStructured(
      {
        face: 'round face',
        hair: 'random hair from DNA',
        body: 'small child',
        clothing: 'beige tee from photo',
        signature: '',
      },
      lock
    );
    expect(applied.clothing).toContain('lavender pajama');
    expect(applied.hair).toContain('center part');
    expect(applied.clothing).not.toContain('beige');
  });

  it('adventure lock uses daytime outfit distinct from bedtime', () => {
    const lock = resolveBookWardrobeLock('adventure')!;
    expect(lock.outfit).toContain('coral-pink');
    expect(lock.outfit).not.toContain('pajama');
  });

  it('prompt section includes verification token and override language', () => {
    const lock = resolveBookWardrobeLock('adventure')!;
    const section = buildBookWardrobePromptSection(lock);
    expect(section).toContain(bookWardrobeVerificationToken(lock));
    expect(section).toContain('IGNORE any clothing');
    expect(section).toContain(lock.outfit);
    expect(section).toContain(lock.hairstyle);
  });
});
