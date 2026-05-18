import { describe, expect, it } from 'vitest';
import {
  buildStoryMarkdown,
  defaultBollyPages,
} from '@/lib/story-validators/__tests__/helpers';
import { KNOWN_BAD_PHRASES } from '../editorial/known-bad-hebrew';
import { runEditorialPrescan } from '../editorial/prescan';

function injectIntoSamplePage(phrase: string, page: number): string {
  const pages = defaultBollyPages(10);
  const target = pages.find((p) => p.pageNumber === page)!;
  target.text = `${target.text} ${phrase}`;
  return buildStoryMarkdown(
    { title: 'בדיקה', companion: 'bolly_armadillo', direction: 'bedtime' },
    pages
  );
}

describe('Editorial pre-scanner', () => {
  for (const bad of KNOWN_BAD_PHRASES) {
    it(`catches "${bad.phrase}" with severity ${bad.severity}`, () => {
      const story = injectIntoSamplePage(bad.phrase, 3);
      const issues = runEditorialPrescan(story, 'bolly_armadillo');
      const match = issues.find((i) => i.quote.includes(bad.phrase));
      expect(match).toBeDefined();
      expect(match!.severity).toBe(bad.severity);
      expect(match!.reason).toBe(bad.reason);
      expect(match!.suggestion).toMatch(/^[֐-׿]/);
    });
  }

  it('catches companion name repeated in same clause', () => {
    const story = injectIntoSamplePage(
      'נועה ראתה את בּוֹלִי. בּוֹלִי טוּמְפּ מתגלגל בּוֹלִי שוב.',
      4
    );
    const issues = runEditorialPrescan(story, 'bolly_armadillo');
    expect(issues.some((i) => i.reason === 'companion_name_repeat')).toBe(true);
  });
});
