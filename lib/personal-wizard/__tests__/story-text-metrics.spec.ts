import { describe, expect, it } from 'vitest';
import { countStoryWords, measureStoryText } from '../story-text-metrics';
import type { PersonalManuscript } from '../story-contract';
const text = (counts: number[]): PersonalManuscript => ({ requestId: 'not_counted', planDigest: 'not_counted', title: 'title is not counted',
  pages: counts.map((count, i) => ({ pageNumber: i + 1, text: Array(count).fill('מילה').join(' ') })) });
describe('deterministic advisory prose measurements, never model grading', () => {
  it.each([
    ['שלום, עולם! 12', 3], ['שָׁלוֹם עוֹלָם', 2], ['ל׳ ג׳ירפה צה״ל', 3],
    ["don't child's”,", 2], ['— … !!!', 0], ['אב\nגד\tהו', 3], ['cafe\u0301 café', 2],
  ])('counts lexical tokens in %s', (input, expected) => expect(countStoryWords(input)).toBe(expected));
  it('uses actual spread prose, excludes title/metadata and does not mutate it', () => {
    const manuscript = text([34, 35, 65, 66]); const before = structuredClone(manuscript);
    expect(measureStoryText(manuscript, 5)).toMatchObject({ kind: 'soft_length_targets_not_literary_verdict', unit: 'narrative_spread',
      totalWords: 200, minWords: 34, medianWords: 50, maxWords: 66, belowTarget: [1], aboveTarget: [4] });
    expect(manuscript).toEqual(before);
  });
  it.each([3, 4, 5, 6, 7, 8])('uses age %i targets, not display-page count', age => {
    expect(measureStoryText(text([44, 45, 85, 86]), age).target).toEqual(age <= 5 ? { min: 35, max: 65 } : { min: 45, max: 85 });
  });
  it.each([0, 2, 9, NaN, 4.5])('refuses unsupported age %s', age => expect(() => measureStoryText(text([35]), age)).toThrow('story_metrics_age'));
});
