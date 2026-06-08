import { describe, expect, it } from 'vitest';
import { normalizePartialGenderChips } from '../story-gen/chip-normalize';
import { scanChipSafety } from '../story-gen/chip-safety';

describe('chip normalization allowlist-only', () => {
  it('normalizes trusted partial suffix chips', () => {
    const input = '--- Page 1 ---\n{{childName}} מתיישב{ת} וילד{ה} אחד{ת}.\n\nWORD_COUNT: [3] = 3';
    const { markdown, report } = normalizePartialGenderChips(input);
    expect(markdown).toContain('{מתיישב|מתיישבת}');
    expect(markdown).toContain('{ילד|ילדה}');
    expect(markdown).toContain('{אחד|אחת}');
    expect(report.unrepaired).toHaveLength(0);
    expect(report.advisoryFail).toBe(false);
  });

  it('does not guess feminine for unrecognized slash forms', () => {
    const input = '--- Page 1 ---\nטקסט עם מַדְגִּים/ה ועוד.\n\nWORD_COUNT: [4] = 4';
    const { markdown, report } = normalizePartialGenderChips(input);
    expect(markdown).toContain('מַדְגִּים/ה');
    expect(report.unrepaired.some((u) => u.token.includes('מַדְגִּים/ה'))).toBe(true);
    expect(report.advisoryFail).toBe(true);
  });
});

describe('chip safety fail-closed scan', () => {
  it('flags blacklisted unsafe chips from regression set', () => {
    const samples = [
      '{מחייך|מחייךת}',
      '{מושך|מושךת}',
      '{שלו|שלוה}',
      '{מַדְגִּים|מַדְגִּיםה}',
      'מניח{ יד|ה}',
      '{יִסְגֹּר|יִסְגֹּרת}ִסְגֹּר',
    ];
    for (const sample of samples) {
      const report = scanChipSafety(`--- Page 1 ---\n${sample}\n\nWORD_COUNT: [1] = 1`);
      expect(report.advisoryFail, `expected fail for: ${sample}`).toBe(true);
      expect(report.hitCount).toBeGreaterThan(0);
    }
  });

  it('passes trusted normalized chips', () => {
    const report = scanChipSafety(
      '--- Page 1 ---\n{{childName}} {מתיישב|מתיישבת} ו{נוגע|נוגעת}.\n\nWORD_COUNT: [4] = 4'
    );
    expect(report.advisoryFail).toBe(false);
  });

  it('flags remaining slash gender in metadata', () => {
    const md = `---
stakes: הילד/ה רוצה לראות
--- Page 1 ---
טקסט.

WORD_COUNT: [1] = 1`;
    const report = scanChipSafety(md);
    expect(report.advisoryFail).toBe(true);
    expect(report.hits.some((h) => h.reason === 'remaining_slash_gender')).toBe(true);
  });
});
