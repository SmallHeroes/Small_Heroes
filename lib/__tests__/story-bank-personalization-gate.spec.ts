import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
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

  it('resolves /ת and /ה slash forms in power-card copy', () => {
    expect(
      resolveStoryBankPlaceholders('אני נותן/ת ונושם/ת', {
        childName: 'נועה',
        childGender: 'girl',
        companionName: 'לילי',
      })
    ).toBe('אני נותנת ונושמת');
  });

  it('denylist matches only standalone tokens, not substrings (regression: דניאל must not hit דני)', () => {
    // Substring false-positives that the old gate would have wrongly blocked:
    const safeNames = ['דניאל', 'תומר', 'מיכאלה', 'יעלי'];
    for (const name of safeNames) {
      const failures = runStoryPersonalizationGate({
        wizard: { childName: name, childGender: 'boy', companionName: 'בולי' },
        pages: [{ pageNumber: 1, text: `${name} הלך לטייל.`, imagePrompt: '' }],
      });
      const leftover = failures.filter((f) => f.includes('leftover bank protagonist'));
      expect(leftover, `unexpected denylist match for ${name}`).toEqual([]);
    }

    // True leftover names must still trigger:
    const actualLeftovers: Array<[string, string]> = [
      ['דני וחברו טיילו ביער.', 'דני'],
      ['מיכל אמרה שלום.', 'מיכל'],
      ['Mia ran fast.', 'Mia'],
    ];
    for (const [text, expected] of actualLeftovers) {
      const failures = runStoryPersonalizationGate({
        wizard: { childName: 'בר', childGender: 'boy', companionName: 'בולי' },
        pages: [{ pageNumber: 1, text, imagePrompt: '' }],
      });
      const leftover = failures.filter((f) => f.includes(expected));
      expect(leftover.length, `expected denylist hit for "${expected}"`).toBeGreaterThan(0);
    }
  });

  it('passes dragon_dini_fantasy offline (chips only, no LLM swap)', () => {
    const fp = path.join(process.cwd(), 'story-bank/v5-fixed-v2/dragon_dini_fantasy.md');
    const md = fs.readFileSync(fp, 'utf8');
    const childName = 'נועה';
    const pages = [...md.matchAll(/--- Page (\d+) ---\n([\s\S]*?)(?=\n--- Page |\nWORD_COUNT:)/g)].map(
      (m) => ({
        pageNumber: Number(m[1]),
        text: resolveStoryBankPlaceholders(m[2].trim(), {
          childName,
          childGender: 'girl',
          companionName: 'דיני',
        }),
      })
    );
    expect(pages.length).toBe(20);
    const failures = runStoryPersonalizationGate({
      wizard: { childName, childGender: 'girl', companionName: 'דיני' },
      pages,
    });
    expect(failures).toEqual([]);
  });
});
