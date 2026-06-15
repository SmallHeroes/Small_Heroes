import path from 'path';
import { describe, expect, it } from 'vitest';

import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { getCompanionById } from '../companions';
import {
  assertQaRenderWardrobeParity,
  buildQaImageGenerationLockFields,
  resolveQaBookLockContext,
  resolveQaPageLocationPlan,
  resolveQaPageShot,
} from '../qa-console-book-lock-context';

const LION_BEDTIME_PATH = path.join(
  process.cwd(),
  'story-bank',
  'v5-fixed-v2',
  'lion_shaket_bedtime.md'
);

const MOCK_PAGES = [
  { pageNumber: 2, text: 'ליאו הגיע.', imagePrompt: 'Night bedroom, Leo arrives.', rawScenePrompt: '' },
  { pageNumber: 4, text: 'מתחת לשמיכה.', imagePrompt: 'Child hides under blanket.', rawScenePrompt: '' },
];

describe('QA console book lock-context parity', () => {
  it('buildQaImageGenerationLockFields passes storyFile and book pipeline locks', () => {
    const lockContext = resolveQaBookLockContext({
      storyPath: LION_BEDTIME_PATH,
      storyFileKey: 'lion_shaket_bedtime',
      direction: 'bedtime',
      challengeCategory: 'ANGER_FRUSTRATION',
      pages: MOCK_PAGES,
      storyTimeOfDay: 'night',
    });
    const fields = buildQaImageGenerationLockFields(lockContext);

    expect(fields.storyFile).toBe('lion_shaket_bedtime');
    expect(fields.direction).toBe('bedtime');
    expect(fields.storyTimeOfDay).toBe('night');
    expect(fields.bookShotPlan.pages.length).toBeGreaterThan(0);
    expect(fields.storyLocationPlan.pagePlans.length).toBeGreaterThan(0);
  });

  it('lion_shaket_bedtime render prompt has pajama lock and not day-default wardrobe', () => {
    const companion = getCompanionById('lion_shaket');
    expect(companion).toBeTruthy();

    const lockContext = resolveQaBookLockContext({
      storyPath: LION_BEDTIME_PATH,
      storyFileKey: 'lion_shaket_bedtime',
      direction: 'bedtime',
      challengeCategory: 'ANGER_FRUSTRATION',
      pages: MOCK_PAGES,
      storyTimeOfDay: 'night',
    });

    for (const page of MOCK_PAGES) {
      const { prompt } = assembleStyle01Phase2Prompt({
        pageNumber: page.pageNumber,
        pagePrompt: page.imagePrompt,
        bookPageText: page.text,
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
        companion: companion!,
        storyFile: 'lion_shaket_bedtime',
        direction: 'bedtime',
        storyTimeOfDay: 'night',
        pageShot: resolveQaPageShot(lockContext.bookShotPlan, page.pageNumber),
        pageLocationPlan: resolveQaPageLocationPlan(lockContext.storyLocationPlan, page.pageNumber),
        locationBible: lockContext.storyLocationPlan.bible,
        challengeCategory: 'ANGER_FRUSTRATION',
      });

      expect(prompt).toContain('two-piece pajamas');
      expect(prompt).toMatch(/moons-and-dots/i);
      expect(prompt).not.toMatch(/plain solid sky-blue t-shirt with a small yellow sun/i);
      expect(prompt).not.toMatch(/Shoes: RED sneakers/i);

      assertQaRenderWardrobeParity(prompt, {
        companionId: 'lion_shaket',
        storyFile: 'lion_shaket_bedtime',
        pageNumber: page.pageNumber,
      });
    }
  });

  it('species-aware silhouette lock uses lion wording — not fox', () => {
    const companion = getCompanionById('lion_shaket');
    const { prompt } = assembleStyle01Phase2Prompt({
      pageNumber: 2,
      pagePrompt: 'Leo beside child.',
      bookPageText: 'ליאו.',
      childFirstName: 'עומר',
      childGender: 'boy',
      childAge: 6,
      companion: companion!,
      storyFile: 'lion_shaket_bedtime',
      direction: 'bedtime',
      storyTimeOfDay: 'night',
    });
    const silhouetteBlock =
      prompt.match(/COMPANION SILHOUETTE LOCK[\s\S]*?(?:\n\n[A-Z]|\n\n$|$)/)?.[0] ?? '';
    expect(silhouetteBlock).toMatch(/lion cub/i);
    expect(silhouetteBlock).not.toMatch(/fox\/creature/i);
    expect(silhouetteBlock).not.toMatch(/\bfox\b/i);
  });
});
