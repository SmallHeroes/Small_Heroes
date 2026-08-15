import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  assertStoryPersonalizationGate,
  normalizeWizardChildGender,
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

  it('does not mistake the common Hebrew preposition "איתי" for a bank protagonist', () => {
    const failures = runStoryPersonalizationGate({
      wizard: { childName: 'נועה', childGender: 'girl', companionName: 'בוני' },
      pages: [{ pageNumber: 1, text: 'נועה שאלה: "מי יהיה איתי?"', imagePrompt: '' }],
    });
    expect(failures.filter((failure) => failure.includes('leftover bank protagonist'))).toEqual([]);

    const englishName = runStoryPersonalizationGate({
      wizard: { childName: 'נועה', childGender: 'girl', companionName: 'בוני' },
      pages: [{ pageNumber: 1, text: 'Itai waited by the door. נועה נכנסה.', imagePrompt: '' }],
    });
    expect(englishName.some((failure) => failure.includes('Itai'))).toBe(true);
  });

  // (Codex) The Hebrew gender-marker gate: V8 `\b` never matched Hebrew, so wrong-gender Hebrew passed the pre-spend
  // gate. These prove the fix DIRECTLY (not via a stale bank name), and that it does not false-block real books.
  const gate = (childGender: 'boy' | 'girl' | 'other', text: string, childName = 'איתן') =>
    runStoryPersonalizationGate({
      wizard: { childName, childGender, companionName: 'בולי' },
      pages: [{ pageNumber: 1, text, imagePrompt: '' }],
    });
  const markerFailures = (fs: string[]) => fs.filter((f) => f.includes('gendered marker'));

  it('boy story: the CHILD in female Hebrew forms FAILS directly via markers (not a denylist name)', () => {
    const fs = gate('boy', 'איתן היא מחזיקה את הדובי.');
    expect(markerFailures(fs).length).toBeGreaterThan(0);
    expect(fs.some((f) => f.includes('leftover bank protagonist'))).toBe(false);
  });

  it('girl story: the CHILD in male Hebrew forms FAILS', () => {
    expect(markerFailures(gate('girl', 'לאה הוא מחזיק את הדובי.', 'לאה')).length).toBeGreaterThan(0);
  });

  it('the V8 \\b bug itself: /\\bהיא\\b/u never matches Hebrew — but the gate now catches it', () => {
    expect(/\bהיא\b/u.test('היא מחזיקה')).toBe(false); // the bug Codex found
    expect(markerFailures(gate('boy', 'איתן היא מחזיקה.')).length).toBeGreaterThan(0);
  });

  it("does NOT false-block a legit multi-character book: a mother's female forms in a boy story PASS", () => {
    // the mother's female forms follow "אמא", not the child name → not attributed to the child → no failure.
    expect(markerFailures(gate('boy', 'איתן מחזיק את הדובי. אמא היא מחזיקה את התיק שלה.'))).toEqual([]);
  });

  it('regression (koko_fantasy shape): "{child} התכופף אליה" — אליה = toward a female friend, not the boy → PASS', () => {
    // the exact false positive that same-sentence matching hit: the female marker אליה is NOT adjacent to the name.
    expect(markerFailures(gate('boy', 'נועם התכופף אליה. "את באה לגן החדש?" שאל.', 'נועם'))).toEqual([]);
  });

  it('regression (fox_uri shape): a male companion/light "הוא" not adjacent to a GIRL child name → PASS', () => {
    expect(markerFailures(gate('girl', 'לאה הביטה בו. הוא ניסה להנהן בחשיבות.', 'לאה'))).toEqual([]);
  });

  it('genitive guard: "אמא של {child} מחזיקה" — the mother is the subject (child is the possessor) → PASS', () => {
    expect(markerFailures(gate('boy', 'אמא של איתן מחזיקה את התיק.'))).toEqual([]);
  });

  it('regression (dragon_dini shape): a male baby-dragon "הוא" in its own sentence of a GIRL story does NOT fire', () => {
    expect(
      markerFailures(gate('girl', 'נועה נותנת מקום. מתוך הביצה הציץ דרקון תינוק. הוא היה קטן.', 'נועה'))
    ).toEqual([]);
  });

  it('standalone boundary distinguishes מחזיקה (female) from מחזיק (male) — no substring false-positive', () => {
    expect(markerFailures(gate('girl', 'לאה מחזיקה את הדובי.', 'לאה'))).toEqual([]);
  });

  it("gender 'other' applies NEITHER marker check (explicit)", () => {
    expect(markerFailures(gate('other', 'עדן היא מחזיקה, והוא מחזיק.', 'עדן'))).toEqual([]);
  });

  it('normalizeWizardChildGender: Hebrew נקבה/זכר + בת/בן consistently; unknown → other', () => {
    expect(normalizeWizardChildGender('נקבה')).toBe('girl');
    expect(normalizeWizardChildGender('זכר')).toBe('boy');
    expect(normalizeWizardChildGender('בת')).toBe('girl');
    expect(normalizeWizardChildGender('בן')).toBe('boy');
    expect(normalizeWizardChildGender('female')).toBe('girl');
    expect(normalizeWizardChildGender('BOY')).toBe('boy');
    expect(normalizeWizardChildGender('robot')).toBe('other');
    expect(normalizeWizardChildGender('')).toBe('other');
    expect(normalizeWizardChildGender(null)).toBe('other');
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
    expect(pages.length).toBe(16);
    const failures = runStoryPersonalizationGate({
      wizard: { childName, childGender: 'girl', companionName: 'דיני' },
      pages,
    });
    expect(failures).toEqual([]);
  });
});
