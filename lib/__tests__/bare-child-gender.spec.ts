import { describe, expect, it } from 'vitest';
import { normalizePartialGenderChips } from '../story-gen/chip-normalize';
import { scanBareChildGender } from '../story-gen/bare-child-gender';

const page = (prose: string) => `--- Page 1 ---\n${prose}\n\nWORD_COUNT: [5] = 5`;

describe('bare child gender detector', () => {
  const failCases = [
    '{{childName}} מוריד ראש ומאזין',
    '{{childName}} מחליט לעמוד',
    '{{childName}} מצטרף למשחק',
    '{{childName}} פותח את הדלת',
  ];

  for (const prose of failCases) {
    it(`FAIL: ${prose.slice(0, 40)}…`, () => {
      const report = scanBareChildGender(page(prose));
      expect(report.advisoryFail).toBe(true);
      expect(report.failHits.length).toBeGreaterThan(0);
    });
  }

  const passCases = [
    '{{childName}} {מוריד|מורידה} ראש ו{מאזין|מאזינה}',
    'הילד קדימה, והרוח נושבת רכה.',
  ];

  for (const prose of passCases) {
    it(`PASS: ${prose.slice(0, 40)}…`, () => {
      const report = scanBareChildGender(page(prose));
      expect(report.advisoryFail).toBe(false);
      expect(report.failHits).toHaveLength(0);
    });
  }

  it('slash form עומד/ת normalizes via allowlist chip-normalize', () => {
    const { markdown, report } = normalizePartialGenderChips(page('{{childName}} עומד/ת כאן.'));
    expect(markdown).toContain('{עומד|עומדת}');
    expect(report.unrepaired).toHaveLength(0);
  });
});
