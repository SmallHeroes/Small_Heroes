import { describe, expect, it } from 'vitest';
import {
  assertStoryPersonalizationGate,
  resolveGenderAlternationChips,
  resolveStoryBankPlaceholders,
  runStoryPersonalizationGate,
  StoryPersonalizationGateError,
} from '../story-bank-personalization';

const BROKEN_MICHAL_PAGE = `מיכל שוכבת במיטה, האור העמום מהמסדרון משאיר פס רך על הקיר.
עיניה גולשות אל המדחום שעל המדף.
היא מחזיקה את המבט רגע.`;

describe('story-bank personalization gate', () => {
  it('fails known-bad Michal/female story for boy Baboo wizard', () => {
    const failures = runStoryPersonalizationGate({
      wizard: {
        childName: 'Baboo',
        childGender: 'boy',
        companionName: 'בּוֹלִי',
      },
      pages: [{ pageNumber: 1, text: BROKEN_MICHAL_PAGE, imagePrompt: 'bedroom night' }],
    });
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some((f) => f.includes('מיכל') || f.includes('Michal'))).toBe(true);
    expect(() =>
      assertStoryPersonalizationGate({
        wizard: { childName: 'Baboo', childGender: 'boy', companionName: 'בּוֹלִי' },
        pages: [{ pageNumber: 1, text: BROKEN_MICHAL_PAGE }],
      })
    ).toThrow(StoryPersonalizationGateError);
  });

  it('passes bolly bedtime placeholders resolved for boy Baboo', () => {
    const raw = `{{childName}} {שוכב|שוכבת} במיטה.
בּוֹלִי נח ליד הכרית.`;
    const text = resolveStoryBankPlaceholders(raw, {
      childName: 'Baboo',
      childGender: 'boy',
      companionName: 'בּוֹלִי',
    });
    expect(text).toContain('Baboo');
    expect(text).toContain('שוכב');
    expect(text).not.toContain('שוכבת');
    const failures = runStoryPersonalizationGate({
      wizard: { childName: 'Baboo', childGender: 'boy', companionName: 'בּוֹלִי' },
      pages: [{ pageNumber: 1, text, imagePrompt: 'evening bedroom soft night light' }],
    });
    expect(failures).toEqual([]);
  });

  it('resolves gender chips — male first, female second', () => {
    expect(resolveGenderAlternationChips('{הלך|הלכה}', 'boy')).toBe('הלך');
    expect(resolveGenderAlternationChips('{הלך|הלכה}', 'girl')).toBe('הלכה');
  });
});
