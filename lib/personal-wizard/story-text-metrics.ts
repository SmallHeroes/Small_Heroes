import type { PersonalManuscript } from './story-contract';

/** NFC lexical tokens, niqqud retained within words; standalone punctuation is not a word. */
export function countStoryWords(text: string): number {
  return text.normalize('NFC').match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[׳״'’"][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu)?.length ?? 0;
}

/** Soft targets for narrative SPREADS, not display pages or literary acceptance. */
export function measureStoryText(manuscript: PersonalManuscript, age: number) {
  if (!Number.isInteger(age) || age < 3 || age > 8) throw Error('story_metrics_age');
  const target = age <= 5 ? { min: 35, max: 65 } : { min: 45, max: 85 };
  const pages = manuscript.pages.map(page => ({ pageNumber: page.pageNumber, words: countStoryWords(page.text) }));
  const sorted = pages.map(page => page.words).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    version: 'personal-story-lexical-words/v1' as const, kind: 'soft_length_targets_not_literary_verdict' as const,
    unit: 'narrative_spread' as const, age, target, pages,
    totalWords: sorted.reduce((sum, n) => sum + n, 0), minWords: sorted[0] ?? 0, maxWords: sorted[sorted.length - 1] ?? 0,
    medianWords: sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0,
    belowTarget: pages.filter(page => page.words < target.min).map(page => page.pageNumber),
    aboveTarget: pages.filter(page => page.words > target.max).map(page => page.pageNumber),
  };
}
