import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  deriveBookShotPlan,
  isBookShotPlanValid,
  resolveBookShotPlan,
  validateBookShotPlan,
} from '../index';

const ROOT = process.cwd();
const BUNNY_V3 = path.join(ROOT, 'story-bank/v3-approved/bunny_ometz_bedtime.md');
const BOLLY_V5 = path.join(ROOT, 'story-bank/v5-fixed-v2/bolly_armadillo_bedtime.md');

function loadPageBeats(filePath: string) {
  const md = fs.readFileSync(filePath, 'utf8');
  const pages: Array<{ page: number; imageDirection: string; bookPageText: string }> = [];
  for (const m of md.matchAll(/--- Page (\d+) ---\r?\n([\s\S]*?)(?=\r?\n--- Page |\r?\nWORD_COUNT:|$)/g)) {
    const block = m[2];
    const dir = block.match(/^imageDirection:\s*(.+)$/m)?.[1]?.trim() ?? '';
    const text = block
      .split('\n')
      .filter((line) => !line.startsWith('imageDirection:'))
      .join('\n')
      .trim();
    pages.push({ page: Number(m[1]), imageDirection: dir, bookPageText: text });
  }
  return pages;
}

function fixtureBeats(count: 8 | 12 | 16) {
  return Array.from({ length: count }, (_, i) => {
    const page = i + 1;
    const isFirst = page === 1;
    const isFinal = page === count;
    const isAction = page === Math.max(2, Math.floor(count * 0.45));
    const isEmotional = page === Math.max(3, Math.floor(count * 0.7));
    return {
      page,
      imageDirection: isFirst
        ? 'clinic room establishing as nurse opens door'
        : isAction
          ? 'bunny standing on chair shouting heroically'
          : isEmotional
            ? 'child hands trembling whispering quiet truth'
            : isFinal
              ? 'warm knock-knock rhythm hands and ears nurse smiling'
              : 'nurse with thermometer medium clinic scene',
      bookPageText: isEmotional ? 'גם הידיים שלי קצת רועדות' : `beat ${page}`,
    };
  });
}

describe('BookShotPlan', () => {
  it('validates 8/12/16-beat fixture books', () => {
    for (const count of [8, 12, 16] as const) {
      const plan = deriveBookShotPlan(fixtureBeats(count));
      expect(plan.pageCount).toBe(count);
      const issues = validateBookShotPlan(plan);
      expect(issues, JSON.stringify(issues)).toEqual([]);
    }
  });

  it('bunny v3 — varied plan with contract slots', () => {
    const plan = resolveBookShotPlan({
      storyFilePath: BUNNY_V3,
      pages: loadPageBeats(BUNNY_V3),
    });
    expect(isBookShotPlanValid(plan)).toBe(true);
    expect(plan.pages.find((p) => p.page === 1)?.shot).toMatch(/establishing_wide|medium_wide/);
    expect(plan.pages.find((p) => p.page === 4)?.shot).toBe('dynamic_angle');
    const emotional = plan.pages.filter((p) => p.shot === 'close_up' || p.shot === 'intimate');
    expect(emotional.length).toBeGreaterThanOrEqual(1);
    expect(emotional.some((p) => p.page === 3 || p.page === 7)).toBe(true);
    const shotTypes = new Set(plan.pages.map((p) => p.shot));
    expect(shotTypes.size).toBeGreaterThanOrEqual(3);
    expect(plan.pages.find((p) => p.page === 8)?.shot).not.toBe('intimate');
  });

  it('legacy bolly golden — valid derived plan', () => {
    const beats = loadPageBeats(BOLLY_V5);
    const plan = deriveBookShotPlan(beats);
    const issues = validateBookShotPlan(plan);
    expect(issues, JSON.stringify(issues)).toEqual([]);
    expect(isBookShotPlanValid(plan)).toBe(true);
    expect(plan.source).toBe('derived');
    expect(new Set(plan.pages.map((p) => p.shot)).size).toBeGreaterThanOrEqual(3);
  });

  it('rejects default-all intimate plans', () => {
    const bad = {
      pageCount: 8,
      source: 'override' as const,
      pages: Array.from({ length: 8 }, (_, i) => ({
        page: i + 1,
        shot: 'intimate' as const,
        rationale: 'bad',
      })),
    };
    const issues = validateBookShotPlan(bad);
    expect(issues.some((i) => i.rule === '7' || i.rule === '1')).toBe(true);
  });
});
