import { describe, expect, it } from 'vitest';
import {
  normalizePartialGenderChips,
  safeConvertSlashGender,
} from '../story-gen/chip-normalize';

function page(prose: string): string {
  return `--- Page 1 ---\n${prose}\n\nWORD_COUNT: [5] = 5`;
}

const SHOULD_CONVERT: Array<[string, string]> = [
  ['הולך/ת', '{הולך|הולכת}'],
  ['מחייך/ת', '{מחייך|מחייכת}'],
  ['מצליח/ה', '{מצליח|מצליחה}'],
  ['בא/ה', '{בא|באה}'],
  ['שבא/ה', '{שבא|שבאה}'],
  ['בחר/ה', '{בחר|בחרה}'],
  ['שבחר/ה', '{שבחר|שבחרה}'],
  ['נבהל/ת', '{נבהל|נבהלת}'],
  ['עוקב/ת', '{עוקב|עוקבת}'],
  ['שומר/ת', '{שומר|שומרת}'],
  ['מאבד/ת', '{מאבד|מאבדת}'],
  ['עצמו/ה', '{עצמו|עצמה}'],
  ['שלו/ה', '{שלו|שלה}'],
  ['צריך/ה', '{צריך|צריכה}'],
  ['מוצף/ת', '{מוצף|מוצפת}'],
  ['עייף/ה', '{עייף|עייפה}'],
  ['קטן/ה', '{קטן|קטנה}'],
  ['רץ/ה', '{רץ|רצה}'],
];

describe('safeConvertSlashGender', () => {
  for (const [input, expected] of SHOULD_CONVERT) {
    it(`converts ${input} → ${expected}`, () => {
      const result = safeConvertSlashGender(input);
      expect(result).not.toBeNull();
      expect(`{${result!.male}|${result!.female}}`).toBe(expected);
    });
  }

  it('does not produce broken forms', () => {
    const broken = ['מחייךת', 'הולךת', 'שלוה', 'עצמוה', 'מושךת'];
    for (const [input] of SHOULD_CONVERT) {
      const result = safeConvertSlashGender(input)!;
      const chip = `${result.male}|${result.female}`;
      for (const b of broken) {
        expect(chip).not.toContain(b);
      }
    }
  });

  it('fails closed on unknown irregular slash form', () => {
    expect(safeConvertSlashGender('שלום/ה')).toBeNull();
    const { markdown, report } = normalizePartialGenderChips(page('טקסט עם שלום/ה.'));
    expect(markdown).toContain('שלום/ה');
    expect(report.unrepaired.some((u) => u.reason === 'unrepaired_slash_gender')).toBe(true);
    expect(report.advisoryFail).toBe(true);
  });
});

describe('normalizePartialGenderChips slash batch', () => {
  it('converts S1-like slash cluster in metadata and prose', () => {
    const md = `---
stakes: לא מצליח/ה להגיע; שבחר/ה קול; והולך/ת בעקבותיו
--- Page 8 ---
{{childName}} עוקב/ת אחרי עצמו/ה.

--- Page 9 ---
כמעט מאבד/ת את הצליל.

--- Page 10 ---
שומר/ת על החוט.

WORD_COUNT: [10, 8, 6] = 24`;
    const { markdown, report } = normalizePartialGenderChips(md);
    expect(markdown).toContain('{מצליח|מצליחה}');
    expect(markdown).toContain('{שבחר|שבחרה}');
    expect(markdown).toContain('{הולך|הולכת}');
    expect(markdown).toContain('{עוקב|עוקבת}');
    expect(markdown).toContain('{עצמו|עצמה}');
    expect(markdown).toContain('{מאבד|מאבדת}');
    expect(markdown).toContain('{שומר|שומרת}');
    expect(report.unrepaired).toHaveLength(0);
    expect(report.advisoryFail).toBe(false);
    expect(report.convertedRegularCount).toBeGreaterThan(0);
  });
});
