import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { normalizePartialGenderChips } from '../story-gen/chip-normalize';
import { scanChipSafety } from '../story-gen/chip-safety';
import { applyWritersRoomArtifactPatches } from '../story-gen/writers-room-artifact-patches';

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

  it('converts safe regular /ה slash (מדגים/ה → chip) per Step 4.1 converter', () => {
    const input = '--- Page 1 ---\nטקסט עם מַדְגִּים/ה ועוד.\n\nWORD_COUNT: [4] = 4';
    const { markdown, report } = normalizePartialGenderChips(input);
    expect(markdown).toContain('{מדגים|מדגימה}');
    expect(report.unrepaired).toHaveLength(0);
    expect(report.advisoryFail).toBe(false);
    expect(report.fixes.some((f) => f.reason === 'safe_slash_regular')).toBe(true);
  });

  it('does not guess feminine for irregular full-slash forms (fail-closed)', () => {
    const input = '--- Page 1 ---\nטקסט עם מדגים/מדגימות ועוד.\n\nWORD_COUNT: [4] = 4';
    const { markdown, report } = normalizePartialGenderChips(input);
    expect(markdown).toContain('מדגים/מדגימות');
    expect(report.unrepaired.some((u) => u.token.includes('מדגים/מדגימות'))).toBe(true);
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

  it('keeps generic feminine fallback disabled in chip-normalize source', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/story-gen/chip-normalize.ts'), 'utf8');
    expect(src).not.toMatch(/fullChipForStem/);
    expect(src).toMatch(/safeConvertSlashGender/);
    expect(src).toMatch(/fail-closed|NO blind/i);
  });

  it('applies S5 neutral stakes rewrite without slash forms', () => {
    const before =
      'stakes: הילד/ה רוצה לראות את הזיקוקים אך הבּוּמים גדולים מדי; אם בורח/ת מפסיד/ה את היופי, אם נשאר/ת בלי גבול — מציף.';
    const { markdown, report } = applyWritersRoomArtifactPatches(
      'tubi_s5_ha_zikukim_adv',
      `---\n${before}\n`
    );
    expect(report.patchCount).toBeGreaterThan(0);
    expect(markdown).toContain('אם יוצאים מהר מדי');
    expect(markdown).not.toContain('בורח/ת');
  });

  it('applies S2 p6 bare-verb fix with explicit chips', () => {
    const before = '{{childName}} מוריד ראש ומאזין.';
    const { markdown } = applyWritersRoomArtifactPatches('tubi_s2_ha_bayit_bed', before);
    expect(markdown).toContain('{מוריד|מורידה}');
    expect(markdown).toContain('{מאזין|מאזינה}');
  });

  it('applies S2 neutral uncomfortableTruth without future-tense slash chips', () => {
    const before =
      'uncomfortableTruth: עמוד 4 — {{childName}} מְפַחֵד/ת שֶׁאִם יִסְגֹּר/תִסְגֹּר יִפְסְפֵּס/תִפְסְפֵּס אֶת אִמָּא.';
    const { markdown } = applyWritersRoomArtifactPatches('tubi_s2_ha_bayit_bed', before);
    expect(markdown).toContain('קול אמא נשאר רחוק');
    expect(markdown).not.toContain('יִסְגֹּר/ת');
  });
});
