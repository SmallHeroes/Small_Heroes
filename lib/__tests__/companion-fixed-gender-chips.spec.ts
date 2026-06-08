import { describe, expect, it } from 'vitest';
import { scanCompanionFixedGenderChips } from '../story-gen/companion-fixed-gender-chips';

const S6_P4_BEFORE = `--- Page 4 ---
טוּבִּי {מניח|מניחה} כפות על הרצפה ו{אומר|אומרת} בקול חָגִיגִי־לַחַשׁ:
״אני מודיע בשקט: נתחיל מחדש.״
הוא {מדגים|מדגימה} — כפות על הרצפה, נשיפה קטנה דרך החדק, אוזניים באמצע.

WORD_COUNT: [10] = 10`;

describe('scanCompanionFixedGenderChips', () => {
  it('flags S6 page-4 companion verb chips (fixed male Tubi)', () => {
    const md = `---
companionId: baby_elephant
---
${S6_P4_BEFORE}`;
    const report = scanCompanionFixedGenderChips(md);
    expect(report.registeredGender).toBe('male');
    expect(report.hitCount).toBeGreaterThanOrEqual(3);
    expect(report.hits.some((h) => h.page === 4 && h.token.includes('מניח'))).toBe(true);
    expect(report.hits.some((h) => h.page === 4 && h.token.includes('אומר'))).toBe(true);
    expect(report.hits.some((h) => h.page === 4 && h.token.includes('מדגים'))).toBe(true);
    expect(report.advisoryWarn).toBe(true);
    expect(report.advisoryFail).toBe(false);
  });

  it('does not flag child gender chips', () => {
    const md = `---
companionId: baby_elephant
---
--- Page 1 ---
{{childName}} {שוכב|שוכבת} במיטה. טוּבִּי מציץ מהפינה.

WORD_COUNT: [5] = 5`;
    const report = scanCompanionFixedGenderChips(md);
    expect(report.hits.filter((h) => h.context.includes('שוכב'))).toHaveLength(0);
  });
});
