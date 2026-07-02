import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  stripGoldenSourceHeader,
  validateStoryForV3Import,
} from '../story-bank-v3-import';

const FOX_BEDTIME = path.join(
  process.cwd(),
  'story-bank/v5-fixed-v2/fox_uri_bedtime.md'
);
const KOKO_CALIBRATION = path.join(
  process.cwd(),
  'story-bank/calibration-sources/chameleon_koko_adventure.md'
);

describe('story-bank-v3-import', () => {
  it('stripGoldenSourceHeader removes v5 comment block and keeps YAML+pages', () => {
    const raw = fs.readFileSync(FOX_BEDTIME, 'utf8');
    const stripped = stripGoldenSourceHeader(raw);
    expect(stripped.startsWith('---\ntitle:')).toBe(true);
    expect(stripped).toContain('--- Page 1 ---');
    expect(stripped).not.toMatch(/^# Story:/m);
  });

  it('validateStoryForV3Import passes fox_uri_bedtime (strict gate)', () => {
    const md = stripGoldenSourceHeader(fs.readFileSync(FOX_BEDTIME, 'utf8'));
    const result = validateStoryForV3Import(md);
    expect(result.errors).toEqual([]);
    expect(result.companionId).toBe('fox_uri');
    expect(result.direction).toBe('bedtime');
    expect(result.pageCount).toBe(8);
  });

  it('chameleon calibration: strict gate fails; warn mode records warnings only', () => {
    const md = stripGoldenSourceHeader(fs.readFileSync(KOKO_CALIBRATION, 'utf8'));
    const strict = validateStoryForV3Import(md);
    expect(strict.errors.some((e) => e.includes('איתי'))).toBe(true);

    const warn = validateStoryForV3Import(md, { personalizationGate: 'warn' });
    expect(warn.errors).toEqual([]);
    expect(warn.personalizationWarnings.length).toBeGreaterThan(0);
  });

  it('legacy promote-phase1-v3-approved.ts must not exist (non-portable bypass removed)', () => {
    expect(
      fs.existsSync(path.join(process.cwd(), 'scripts/promote-phase1-v3-approved.ts'))
    ).toBe(false);
  });
});
